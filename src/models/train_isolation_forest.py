"""
train_isolation_forest.py
--------------------------
Trains an Isolation Forest model on real collected behavioral telemetry.
Isolation Forest is well-suited for unsupervised anomaly detection on
tabular data without requiring labelled attack samples.

Usage:
    python -m src.models.train_isolation_forest
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
import json
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

# ─── Path setup ───────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from src.feature_engineering.build_features import (
    build_tabular,
    build_scaled_matrix,
    get_feature_columns,
    TABULAR_OUT,
    SCALER_OUT,
)

MODEL_OUT    = os.path.join(BASE, "src/models/isolation_forest_model.pkl")
METRICS_OUT  = os.path.join(BASE, "src/models/if_metrics.json")
PRED_LOG     = os.path.join(BASE, "logs/predictions.csv")

# ─── Hyperparameters ──────────────────────────────────────────────────────────
IF_PARAMS = {
    "n_estimators": 200,        # More trees → more stable scores
    "max_samples": "auto",
    "contamination": 0.05,      # ~5% of baseline data assumed anomalous
    "max_features": 1.0,
    "bootstrap": False,
    "random_state": 42,
    "n_jobs": -1,
}


def train(min_rows: int = 30):
    """
    Build features, train Isolation Forest, save model and metrics.
    """
    print("[IsolationForest] Loading telemetry data...")
    df = build_tabular()

    if len(df) < min_rows:
        print(f"[IsolationForest] Only {len(df)} rows available. "
              f"Need at least {min_rows}. Collect more data first.")
        return None, None

    feature_cols = [c for c in get_feature_columns() if c in df.columns]
    X_raw = df[feature_cols].values.astype(np.float32)

    # Scale
    scaler = MinMaxScaler()
    X = scaler.fit_transform(X_raw)

    os.makedirs(os.path.dirname(SCALER_OUT), exist_ok=True)
    joblib.dump(scaler, SCALER_OUT)
    print(f"[IsolationForest] Scaler saved → {SCALER_OUT}")

    print(f"[IsolationForest] Training on {len(X)} samples × {X.shape[1]} features...")
    model = IsolationForest(**IF_PARAMS)
    model.fit(X)

    # Evaluation on training data
    scores = model.score_samples(X)         # Raw anomaly score (lower = more anomalous)
    labels = model.predict(X)               # 1 = normal, -1 = anomaly

    anomaly_count = (labels == -1).sum()
    normal_count  = (labels == 1).sum()
    threshold     = np.percentile(scores, 5)

    metrics = {
        "trained_at": datetime.now().isoformat(),
        "n_samples": int(len(X)),
        "n_features": int(X.shape[1]),
        "feature_names": feature_cols,
        "anomaly_count": int(anomaly_count),
        "normal_count": int(normal_count),
        "contamination": IF_PARAMS["contamination"],
        "score_mean": float(np.mean(scores)),
        "score_std": float(np.std(scores)),
        "score_min": float(np.min(scores)),
        "score_max": float(np.max(scores)),
        "threshold_p5": float(threshold),
    }

    # Save model
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    print(f"[IsolationForest] Model saved → {MODEL_OUT}")

    # Save metrics
    with open(METRICS_OUT, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[IsolationForest] Metrics saved → {METRICS_OUT}")
    print(f"[IsolationForest] Anomaly count: {anomaly_count} / {len(X)}")

    # Write predictions to log
    _log_predictions(df, scores, labels)
    return model, scaler


def _log_predictions(df: pd.DataFrame, scores: np.ndarray, labels: np.ndarray):
    """Append IF predictions to the predictions log CSV."""
    os.makedirs(os.path.dirname(PRED_LOG), exist_ok=True)
    header = not os.path.exists(PRED_LOG)
    with open(PRED_LOG, "a", newline="") as f:
        import csv
        writer = csv.writer(f)
        if header:
            writer.writerow(["timestamp", "model", "raw_score", "label", "is_anomaly"])
        for i, (score, label) in enumerate(zip(scores, labels)):
            ts = df["timestamp"].iloc[i].isoformat() if "timestamp" in df.columns else ""
            writer.writerow([ts, "isolation_forest", round(float(score), 5),
                             int(label), 1 if label == -1 else 0])
    print(f"[IsolationForest] Predictions logged → {PRED_LOG}")


def load_model():
    """Load saved Isolation Forest model and scaler."""
    if not os.path.exists(MODEL_OUT):
        raise FileNotFoundError(f"Model not found at {MODEL_OUT}. Run train() first.")
    model = joblib.load(MODEL_OUT)
    scaler = joblib.load(SCALER_OUT) if os.path.exists(SCALER_OUT) else None
    return model, scaler


def predict(X_raw: np.ndarray, model=None, scaler=None) -> dict:
    """
    Run inference on a raw feature matrix.
    Returns anomaly score and label for each row.
    """
    if model is None or scaler is None:
        model, scaler = load_model()

    X = scaler.transform(X_raw) if scaler else X_raw
    scores = model.score_samples(X)
    labels = model.predict(X)

    return {
        "scores": scores.tolist(),
        "labels": labels.tolist(),
        "is_anomaly": [1 if l == -1 else 0 for l in labels],
    }


if __name__ == "__main__":
    train()
