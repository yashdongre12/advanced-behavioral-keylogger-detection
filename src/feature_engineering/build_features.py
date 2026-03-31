"""
build_features.py
-----------------
Feature engineering pipeline that:
  1. Reads real telemetry from CSV logs
  2. Merges keyboard, process, and system signals
  3. Builds a flat tabular feature set for Isolation Forest
  4. Builds rolling-window sequential features for LSTM
  5. Saves engineered feature files ready for model training
"""

import os
import csv
import json
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler
import joblib

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "../../")
LOGS = os.path.join(BASE, "logs")

SEQUENCE_OUT  = os.path.join(LOGS, "sequence_features.npy")
SCALER_OUT    = os.path.join(BASE, "src/models/scaler.pkl")

# LSTM window length (number of timesteps per sample)
SEQ_LEN = 20

# ─── Feature column lists ─────────────────────────────────────────────────────
KB_COLS = [
    "typing_speed_kps", "avg_hold_ms", "avg_inter_key_ms",
    "burst_score", "backspace_ratio", "enter_ratio",
    "special_key_ratio", "repeat_key_ratio",
]

SYS_COLS = [
    "cpu_total_percent", "mem_percent",
    "disk_read_mb_s", "disk_write_mb_s",
    "active_process_count",
]

# Aggregated process features per timestamp bucket
PROC_AGG_COLS = [
    "max_proc_cpu", "mean_proc_cpu", "max_proc_mem",
    "suspicious_proc_count", "new_proc_rate", "bg_proc_ratio",
]


# ─── Load helpers ─────────────────────────────────────────────────────────────
def _load_mongo(collection_name: str) -> pd.DataFrame:
    from src.utils.db import db
    if db is None:
        print(f"[FeatureEng] Warning: Cannot connect to MongoDB for {collection_name}.")
        return pd.DataFrame()
        
    cursor = db[collection_name].find({}, {"_id": 0})
    df = pd.DataFrame(list(cursor))
    if df.empty:
        return df
        
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)
    return df


# ─── Process aggregation ──────────────────────────────────────────────────────
def _aggregate_processes(proc_df: pd.DataFrame, freq: str = "5s") -> pd.DataFrame:
    """
    Aggregate per-process rows into per-time-bucket features.
    """
    if proc_df.empty:
        return pd.DataFrame(columns=["timestamp"] + PROC_AGG_COLS)

    proc_df = proc_df.copy()
    proc_df["bucket"] = proc_df["timestamp"].dt.floor(freq)
    proc_df["cpu_percent"] = pd.to_numeric(proc_df["cpu_percent"], errors="coerce").fillna(0)
    proc_df["mem_percent"] = pd.to_numeric(proc_df["mem_percent"], errors="coerce").fillna(0)
    proc_df["suspicion_score"] = pd.to_numeric(proc_df["suspicion_score"], errors="coerce").fillna(0)
    proc_df["is_background"] = proc_df["is_background"].astype(str).str.lower().isin(["true", "1"])

    agg = proc_df.groupby("bucket").agg(
        max_proc_cpu=("cpu_percent", "max"),
        mean_proc_cpu=("cpu_percent", "mean"),
        max_proc_mem=("mem_percent", "max"),
        suspicious_proc_count=("suspicion_score", lambda x: (x > 0.3).sum()),
        bg_proc_ratio=("is_background", "mean"),
    ).reset_index().rename(columns={"bucket": "timestamp"})

    # new_proc_rate: count of distinct PIDs per bucket
    pid_counts = proc_df.groupby("bucket")["pid"].nunique().reset_index()
    pid_counts.columns = ["timestamp", "new_proc_rate"]
    agg = agg.merge(pid_counts, on="timestamp", how="left")
    return agg


# ─── Merge all signals ────────────────────────────────────────────────────────
def build_tabular(freq: str = "5s") -> pd.DataFrame:
    """
    Merge keyboard, system, and process data into a single tabular DataFrame.
    Each row = one 5-second time bucket.
    """
    kb_df   = _load_mongo("keyboard_features")
    sys_df  = _load_mongo("system_logs")
    proc_df = _load_mongo("process_logs")

    # Floor timestamps to bucket
    for df in [kb_df, sys_df]:
        if not df.empty and "timestamp" in df.columns:
            df["timestamp"] = df["timestamp"].dt.floor(freq)

    # Aggregate keyboard features (mean per bucket)
    if not kb_df.empty:
        kb_agg = kb_df.groupby("timestamp")[KB_COLS].mean().reset_index()
    else:
        kb_agg = pd.DataFrame(columns=["timestamp"] + KB_COLS)

    # Aggregate system metrics (mean per bucket)
    if not sys_df.empty:
        sys_agg = sys_df.groupby("timestamp")[SYS_COLS].mean().reset_index()
    else:
        sys_agg = pd.DataFrame(columns=["timestamp"] + SYS_COLS)

    # Aggregate process info
    proc_agg = _aggregate_processes(proc_df, freq)

    # Merge all three on timestamp
    merged = kb_agg.merge(sys_agg, on="timestamp", how="outer")
    merged = merged.merge(proc_agg, on="timestamp", how="outer")
    merged = merged.sort_values("timestamp").reset_index(drop=True)
    merged = merged.fillna(0)

    return merged


def build_and_save_tabular() -> str:
    """Build tabular features and save to MongoDB."""
    df = build_tabular()
    from src.utils.db import db
    if db is not None and not df.empty:
        df_mongo = df.copy()
        df_mongo["timestamp"] = df_mongo["timestamp"].astype(str)
        db.tabular_features.delete_many({}) # Replace with new master mapping
        db.tabular_features.insert_many(df_mongo.to_dict("records"))
    print(f"[FeatureEng] Tabular features saved: {len(df)} rows to MongoDB")
    return "db.tabular_features"


def get_feature_columns() -> list:
    return KB_COLS + SYS_COLS + PROC_AGG_COLS


def build_scaled_matrix(df: pd.DataFrame | None = None) -> tuple:
    """
    Return (X_scaled, scaler) where X_scaled is a numpy array
    of the tabular feature columns.
    """
    if df is None:
        df = build_tabular()

    feature_cols = [c for c in get_feature_columns() if c in df.columns]
    X = df[feature_cols].values.astype(np.float32)

    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    os.makedirs(os.path.dirname(SCALER_OUT), exist_ok=True)
    joblib.dump(scaler, SCALER_OUT)
    print(f"[FeatureEng] Scaler saved to {SCALER_OUT}")
    return X_scaled, scaler


# ─── Sequence builder for LSTM ────────────────────────────────────────────────
def build_sequences(X_scaled: np.ndarray, seq_len: int = SEQ_LEN) -> np.ndarray:
    """
    Create overlapping windows for LSTM training.
    Returns shape: (n_samples, seq_len, n_features)
    """
    if len(X_scaled) < seq_len:
        print(f"[FeatureEng] Not enough rows ({len(X_scaled)}) for seq_len={seq_len}.")
        return np.array([])

    sequences = []
    for i in range(len(X_scaled) - seq_len + 1):
        sequences.append(X_scaled[i:i + seq_len])
    arr = np.array(sequences, dtype=np.float32)
    print(f"[FeatureEng] Built {len(arr)} sequences of shape {arr.shape}")
    return arr


def build_and_save_sequences() -> str:
    """Build sequence features for LSTM and save as .npy file."""
    X_scaled, _ = build_scaled_matrix()
    sequences = build_sequences(X_scaled)
    if sequences.size > 0:
        np.save(SEQUENCE_OUT, sequences)
        print(f"[FeatureEng] Sequences saved → {SEQUENCE_OUT}")
    return SEQUENCE_OUT


# ─── Live feature builder (for real-time inference) ───────────────────────────
def build_live_features(
    kb_feats: dict,
    sys_metrics: dict,
    proc_snapshot: list,
) -> np.ndarray:
    """
    Build a single feature vector from live monitors for real-time inference.
    Returns shape: (1, n_features)
    """
    row = {}

    for col in KB_COLS:
        row[col] = float(kb_feats.get(col, 0.0))

    for col in SYS_COLS:
        row[col] = float(sys_metrics.get(col, 0.0))

    if proc_snapshot:
        cpu_vals = [p.get("cpu_percent", 0) for p in proc_snapshot]
        mem_vals = [p.get("mem_percent", 0) for p in proc_snapshot]
        sus_vals = [p.get("suspicion_score", 0) for p in proc_snapshot]
        bg_vals  = [1 if p.get("is_background") else 0 for p in proc_snapshot]

        row["max_proc_cpu"]          = max(cpu_vals)
        row["mean_proc_cpu"]         = sum(cpu_vals) / len(cpu_vals)
        row["max_proc_mem"]          = max(mem_vals)
        row["suspicious_proc_count"] = sum(1 for s in sus_vals if s > 0.3)
        row["new_proc_rate"]         = len(proc_snapshot)
        row["bg_proc_ratio"]         = sum(bg_vals) / len(bg_vals)
    else:
        for col in PROC_AGG_COLS:
            row[col] = 0.0

    all_cols = get_feature_columns()
    return np.array([[row.get(c, 0.0) for c in all_cols]], dtype=np.float32)


if __name__ == "__main__":
    print("Building tabular features...")
    build_and_save_tabular()
    print("Building sequence features...")
    build_and_save_sequences()
