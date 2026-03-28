"""
realtime_detector.py
---------------------
Hybrid detection engine that combines:
  - Isolation Forest (tabular system/process anomaly detection)
  - LSTM Autoencoder (sequential temporal pattern detection)

Runs continuous inference against live monitor data and produces:
  - Isolation Forest anomaly score
  - LSTM reconstruction error / anomaly probability
  - Combined final threat score
  - Threat level: Normal | Low | Medium | High | Critical
  - Human-readable reason string

Saves results to logs/predictions.csv and logs/alerts.csv.
"""

import os
import sys
import csv
import time
import json
import threading
import numpy as np
from collections import deque
from datetime import datetime

BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from src.feature_engineering.build_features import (
    build_live_features,
    build_sequences,
    SEQ_LEN,
    get_feature_columns,
)

PRED_LOG  = os.path.join(BASE, "logs/predictions.csv")
ALERT_LOG = os.path.join(BASE, "logs/alerts.csv")
IF_MODEL  = os.path.join(BASE, "src/models/isolation_forest_model.pkl")
LSTM_MODEL = os.path.join(BASE, "src/models/lstm_model.h5")
SCALER    = os.path.join(BASE, "src/models/scaler.pkl")
LSTM_METRICS = os.path.join(BASE, "src/models/lstm_metrics.json")

DETECTION_INTERVAL = 10.0   # seconds between inference cycles

# ─── State ────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_result_buffer: deque = deque(maxlen=500)
_alert_buffer:  deque = deque(maxlen=200)
_running = False
_thread  = None

# Rolling window of raw feature vectors for LSTM
_feature_window: deque = deque(maxlen=SEQ_LEN * 2)


# ─── CSV helpers ──────────────────────────────────────────────────────────────
PRED_COLS = [
    "timestamp", "if_score", "if_is_anomaly",
    "lstm_mse", "lstm_anomaly_prob", "lstm_is_anomaly",
    "final_threat_score", "threat_level", "reason",
]

ALERT_COLS = [
    "timestamp", "threat_level", "final_threat_score",
    "if_score", "lstm_anomaly_prob",
    "top_process", "top_process_suspicion",
    "cpu_percent", "mem_percent", "reason",
]


def _ensure_logs():
    os.makedirs(os.path.dirname(PRED_LOG), exist_ok=True)
    for path, cols in [(PRED_LOG, PRED_COLS), (ALERT_LOG, ALERT_COLS)]:
        if not os.path.exists(path):
            with open(path, "w", newline="") as f:
                csv.writer(f).writerow(cols)


def _append_pred(row: dict):
    with open(PRED_LOG, "a", newline="") as f:
        csv.writer(f).writerow([row.get(c, "") for c in PRED_COLS])


def _append_alert(row: dict):
    with open(ALERT_LOG, "a", newline="") as f:
        csv.writer(f).writerow([row.get(c, "") for c in ALERT_COLS])


# ─── Model loading (lazy) ────────────────────────────────────────────────────
_if_model  = None
_if_scaler = None
_lstm_model = None
_lstm_threshold = 0.05
_models_loaded = False


def _load_models():
    global _if_model, _if_scaler, _lstm_model, _lstm_threshold, _models_loaded
    import joblib

    if os.path.exists(IF_MODEL) and os.path.exists(SCALER):
        _if_model  = joblib.load(IF_MODEL)
        _if_scaler = joblib.load(SCALER)
        print("[Detector] Isolation Forest loaded.")
    else:
        print("[Detector] Warning: IF model not found. Run train_isolation_forest.py first.")

    if os.path.exists(LSTM_MODEL):
        import tensorflow as tf
        _lstm_model = tf.keras.models.load_model(LSTM_MODEL, compile=False)
        print("[Detector] LSTM model loaded.")
        if os.path.exists(LSTM_METRICS):
            with open(LSTM_METRICS) as f:
                m = json.load(f)
            _lstm_threshold = m.get("anomaly_threshold", _lstm_threshold)
    else:
        print("[Detector] Warning: LSTM model not found. Run train_lstm.py first.")

    _models_loaded = True


# ─── Scoring helpers ──────────────────────────────────────────────────────────
def _run_isolation_forest(X_raw: np.ndarray) -> dict:
    if _if_model is None:
        return {"if_score": 0.0, "if_is_anomaly": 0}
    try:
        X = _if_scaler.transform(X_raw) if _if_scaler else X_raw
        score  = float(_if_model.score_samples(X)[0])
        label  = int(_if_model.predict(X)[0])
        return {"if_score": round(score, 5), "if_is_anomaly": 1 if label == -1 else 0}
    except Exception as e:
        print(f"[Detector] IF error: {e}")
        return {"if_score": 0.0, "if_is_anomaly": 0}


def _run_lstm(feature_history: list) -> dict:
    if _lstm_model is None or len(feature_history) < SEQ_LEN:
        return {"lstm_mse": 0.0, "lstm_anomaly_prob": 0.0, "lstm_is_anomaly": 0}
    try:
        arr = np.array(feature_history[-SEQ_LEN:], dtype=np.float32)
        arr = arr.reshape(1, SEQ_LEN, -1)
        pred = _lstm_model.predict(arr, verbose=0)
        mse  = float(np.mean(np.power(arr - pred, 2)))
        prob = min(1.0, mse / (_lstm_threshold + 1e-9))
        return {
            "lstm_mse": round(mse, 6),
            "lstm_anomaly_prob": round(prob, 4),
            "lstm_is_anomaly": 1 if mse > _lstm_threshold else 0,
        }
    except Exception as e:
        print(f"[Detector] LSTM error: {e}")
        return {"lstm_mse": 0.0, "lstm_anomaly_prob": 0.0, "lstm_is_anomaly": 0}


def _combine_scores(if_score: float, if_anomaly: int,
                    lstm_prob: float, lstm_anomaly: int,
                    sys_metrics: dict, proc_snapshot: list,
                    kb_feats: dict) -> tuple:
    """
    Combine IF and LSTM scores into a [0-100] final threat score.
    Returns (threat_score, threat_level, reason_string).
    """
    # Normalise IF score to [0,1] — more negative = more anomalous
    # Typical range: [-0.5, 0.1]; lower bound gives 1.0 suspicion
    if_norm = max(0.0, min(1.0, (-if_score + 0.1) / 0.6))

    # Weighted blend: 40% IF + 40% LSTM + 20% heuristics
    heuristic = _heuristic_score(sys_metrics, proc_snapshot, kb_feats)
    combined  = 0.40 * if_norm + 0.40 * lstm_prob + 0.20 * heuristic
    score_100 = round(combined * 100, 2)

    if score_100 < 20:
        level = "Normal"
    elif score_100 < 40:
        level = "Low"
    elif score_100 < 60:
        level = "Medium"
    elif score_100 < 80:
        level = "High"
    else:
        level = "Critical"

    reason = _build_reason(if_anomaly, lstm_anomaly, lstm_prob,
                           sys_metrics, proc_snapshot, kb_feats, score_100)
    return score_100, level, reason


def _heuristic_score(sys_metrics: dict, proc_snapshot: list, kb_feats: dict) -> float:
    score = 0.0
    if sys_metrics.get("cpu_total_percent", 0) > 85:
        score += 0.3
    if sys_metrics.get("mem_percent", 0) > 90:
        score += 0.2
    top_sus = max((p.get("suspicion_score", 0) for p in proc_snapshot), default=0)
    score += top_sus * 0.3
    if kb_feats.get("burst_score", 0) > 0.6:
        score += 0.1
    if kb_feats.get("repeat_key_ratio", 0) > 0.4:
        score += 0.1
    return min(score, 1.0)


def _build_reason(if_anomaly, lstm_anomaly, lstm_prob,
                  sys_metrics, proc_snapshot, kb_feats, score) -> str:
    reasons = []
    if if_anomaly:
        reasons.append("Isolation Forest detected tabular anomaly in system/process behavior")
    if lstm_anomaly:
        reasons.append(f"LSTM detected anomalous temporal sequence (prob={lstm_prob:.2f})")
    if sys_metrics.get("cpu_total_percent", 0) > 85:
        reasons.append(f"Abnormal CPU spike ({sys_metrics['cpu_total_percent']}%)")
    if sys_metrics.get("mem_percent", 0) > 90:
        reasons.append(f"High memory pressure ({sys_metrics['mem_percent']}%)")
    top_proc = max(proc_snapshot, key=lambda p: p.get("suspicion_score", 0), default={})
    if top_proc.get("suspicion_score", 0) > 0.4:
        reasons.append(f"Suspicious background process: {top_proc.get('name','?')} "
                       f"(score={top_proc.get('suspicion_score',0):.2f})")
    if kb_feats.get("burst_score", 0) > 0.6:
        reasons.append("High keystroke burst frequency (possible automated input)")
    if kb_feats.get("repeat_key_ratio", 0) > 0.4:
        reasons.append("Elevated repeated key ratio")
    if not reasons:
        reasons.append("All signals within normal range")
    return "; ".join(reasons)


# ─── Detection loop ────────────────────────────────────────────────────────────
def _detection_loop(get_kb_feats, get_sys_metrics, get_proc_snapshot):
    while _running:
        start = time.time()
        try:
            kb    = get_kb_feats()
            sys_m = get_sys_metrics()
            procs = get_proc_snapshot()

            # Build feature vector
            X_raw = build_live_features(kb, sys_m, procs)

            # Store in rolling window for LSTM
            with _lock:
                _feature_window.append(X_raw[0].tolist())
                feat_history = list(_feature_window)

            # Run models
            if_result   = _run_isolation_forest(X_raw)
            lstm_result = _run_lstm(feat_history)

            # Combine
            threat_score, threat_level, reason = _combine_scores(
                if_result["if_score"],
                if_result["if_is_anomaly"],
                lstm_result["lstm_anomaly_prob"],
                lstm_result["lstm_is_anomaly"],
                sys_m, procs, kb
            )

            ts = datetime.now().isoformat()
            result = {
                "timestamp": ts,
                **if_result,
                **lstm_result,
                "final_threat_score": threat_score,
                "threat_level": threat_level,
                "reason": reason,
                "cpu_percent": sys_m.get("cpu_total_percent", 0),
                "mem_percent": sys_m.get("mem_percent", 0),
                "kb_features": kb,
            }

            with _lock:
                _result_buffer.append(result)

            _append_pred(result)

            # Generate alert if threat >= Low
            top_proc = max(procs, key=lambda p: p.get("suspicion_score", 0), default={})
            if threat_level in ("Low", "Medium", "High", "Critical"):
                alert = {
                    "timestamp": ts,
                    "threat_level": threat_level,
                    "final_threat_score": threat_score,
                    "if_score": if_result["if_score"],
                    "lstm_anomaly_prob": lstm_result["lstm_anomaly_prob"],
                    "top_process": top_proc.get("name", ""),
                    "top_process_suspicion": top_proc.get("suspicion_score", 0),
                    "cpu_percent": result["cpu_percent"],
                    "mem_percent": result["mem_percent"],
                    "reason": reason,
                }
                with _lock:
                    _alert_buffer.append(alert)
                _append_alert(alert)

        except Exception as e:
            print(f"[Detector] Inference error: {e}")

        elapsed = time.time() - start
        time.sleep(max(0, DETECTION_INTERVAL - elapsed))


# ─── Public API ───────────────────────────────────────────────────────────────
def start(get_kb_feats, get_sys_metrics, get_proc_snapshot):
    """
    Start the detection loop.

    Parameters
    ----------
    get_kb_feats      : callable → dict  (latest keyboard features)
    get_sys_metrics   : callable → dict  (latest system metrics)
    get_proc_snapshot : callable → list  (latest process list)
    """
    global _running, _thread
    _ensure_logs()
    _load_models()
    _running = True
    _thread = threading.Thread(
        target=_detection_loop,
        args=(get_kb_feats, get_sys_metrics, get_proc_snapshot),
        daemon=True,
    )
    _thread.start()
    print("[Detector] Real-time detection started.")


def stop():
    global _running
    _running = False
    print("[Detector] Stopped.")


def get_latest_result() -> dict:
    with _lock:
        if _result_buffer:
            return dict(_result_buffer[-1])
    return {
        "timestamp": datetime.now().isoformat(),
        "if_score": 0.0, "if_is_anomaly": 0,
        "lstm_mse": 0.0, "lstm_anomaly_prob": 0.0, "lstm_is_anomaly": 0,
        "final_threat_score": 0.0, "threat_level": "Normal",
        "reason": "No data yet", "cpu_percent": 0, "mem_percent": 0,
    }


def get_recent_results(n: int = 50) -> list:
    with _lock:
        return list(_result_buffer)[-n:]


def get_recent_alerts(n: int = 50) -> list:
    with _lock:
        return list(_alert_buffer)[-n:]
