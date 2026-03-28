"""
train_lstm.py
--------------
Trains an LSTM autoencoder on sequential behavioral telemetry.
The model learns normal temporal patterns; high reconstruction error
at inference time indicates anomalous (potentially keylogger-like) behavior.

Uses an UNSUPERVISED autoencoder approach — no attack labels required.

Usage:
    python -m src.models.train_lstm
"""

import os
import sys
import numpy as np
import json
from datetime import datetime

# ─── Path setup ───────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from src.feature_engineering.build_features import (
    build_and_save_sequences,
    build_scaled_matrix,
    build_sequences,
    SEQUENCE_OUT,
    SEQ_LEN,
)

MODEL_OUT   = os.path.join(BASE, "src/models/lstm_model.h5")
METRICS_OUT = os.path.join(BASE, "src/models/lstm_metrics.json")

# ─── Hyperparameters ──────────────────────────────────────────────────────────
LSTM_UNITS   = 64
DENSE_UNITS  = 32
DROPOUT      = 0.2
BATCH_SIZE   = 32
EPOCHS       = 50
PATIENCE     = 8       # Early stopping patience
VALIDATION   = 0.15

# Threshold: 95th percentile of training reconstruction error
THRESHOLD_PERCENTILE = 95


def build_model(seq_len: int, n_features: int):
    """
    LSTM Autoencoder architecture.
    Encoder compresses the sequence; decoder reconstructs it.
    High reconstruction loss at inference → anomalous sequence.
    """
    import tensorflow as tf
    from tensorflow.keras import layers, models

    inp = layers.Input(shape=(seq_len, n_features), name="encoder_input")

    # Encoder
    enc = layers.LSTM(LSTM_UNITS, return_sequences=True, name="encoder_lstm1")(inp)
    enc = layers.Dropout(DROPOUT)(enc)
    enc = layers.LSTM(DENSE_UNITS, return_sequences=False, name="encoder_lstm2")(enc)
    enc = layers.Dropout(DROPOUT)(enc)

    # Bottleneck (latent)
    latent = layers.Dense(DENSE_UNITS // 2, activation="relu", name="latent")(enc)

    # Decoder — repeat vector then decode
    dec = layers.RepeatVector(seq_len, name="repeat")(latent)
    dec = layers.LSTM(DENSE_UNITS, return_sequences=True, name="decoder_lstm1")(dec)
    dec = layers.Dropout(DROPOUT)(dec)
    dec = layers.LSTM(LSTM_UNITS, return_sequences=True, name="decoder_lstm2")(dec)
    out = layers.TimeDistributed(layers.Dense(n_features), name="output")(dec)

    model = models.Model(inp, out, name="LSTM_Autoencoder")
    model.compile(optimizer="adam", loss="mse")
    return model


def train(min_sequences: int = 30):
    """
    Build sequences, train LSTM autoencoder, save model and anomaly threshold.
    """
    print("[LSTM] Building feature sequences from telemetry...")
    X_scaled, _ = build_scaled_matrix()
    sequences = build_sequences(X_scaled)

    if len(sequences) < min_sequences:
        print(f"[LSTM] Only {len(sequences)} sequences available. "
              f"Need at least {min_sequences}. Collect more data first.")
        return None

    n_samples, seq_len, n_features = sequences.shape
    print(f"[LSTM] Training on {n_samples} sequences × {seq_len} steps × {n_features} features")

    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

    # Shuffle and split
    idx = np.random.permutation(n_samples)
    sequences = sequences[idx]
    val_size  = int(n_samples * VALIDATION)
    X_val  = sequences[:val_size]
    X_train = sequences[val_size:]

    model = build_model(seq_len, n_features)
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=PATIENCE,
                      restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                          patience=4, verbose=1),
    ]

    history = model.fit(
        X_train, X_train,     # Autoencoder: target == input
        validation_data=(X_val, X_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1,
    )

    # Compute reconstruction error on training data
    X_pred = model.predict(sequences, batch_size=BATCH_SIZE, verbose=0)
    mse_per_sample = np.mean(np.power(sequences - X_pred, 2), axis=(1, 2))
    threshold = float(np.percentile(mse_per_sample, THRESHOLD_PERCENTILE))
    print(f"[LSTM] Anomaly threshold (p{THRESHOLD_PERCENTILE}): {threshold:.6f}")

    # Save model
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    model.save(MODEL_OUT)
    print(f"[LSTM] Model saved → {MODEL_OUT}")

    # Save metrics + threshold
    metrics = {
        "trained_at": datetime.now().isoformat(),
        "n_train": int(len(X_train)),
        "n_val": int(len(X_val)),
        "seq_len": int(seq_len),
        "n_features": int(n_features),
        "epochs_trained": int(len(history.history["loss"])),
        "final_train_loss": float(history.history["loss"][-1]),
        "final_val_loss": float(history.history["val_loss"][-1]),
        "mse_mean": float(np.mean(mse_per_sample)),
        "mse_std": float(np.std(mse_per_sample)),
        "anomaly_threshold": threshold,
        "threshold_percentile": THRESHOLD_PERCENTILE,
    }
    with open(METRICS_OUT, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[LSTM] Metrics saved → {METRICS_OUT}")
    return model, threshold


def load_model():
    """Load saved LSTM model and anomaly threshold."""
    import tensorflow as tf
    if not os.path.exists(MODEL_OUT):
        raise FileNotFoundError(f"LSTM model not found at {MODEL_OUT}. Run train() first.")
    model = tf.keras.models.load_model(MODEL_OUT)

    threshold = 0.05  # default fallback
    if os.path.exists(METRICS_OUT):
        with open(METRICS_OUT) as f:
            metrics = json.load(f)
        threshold = metrics.get("anomaly_threshold", threshold)

    return model, threshold


def predict(sequences: np.ndarray, model=None, threshold: float = None) -> dict:
    """
    Run inference on a batch of sequences.
    Returns per-sample reconstruction error and anomaly flag.
    """
    if model is None:
        model, threshold = load_model()

    X_pred = model.predict(sequences, batch_size=BATCH_SIZE, verbose=0)
    mse = np.mean(np.power(sequences - X_pred, 2), axis=(1, 2))
    is_anomaly = (mse > threshold).astype(int)

    return {
        "reconstruction_error": mse.tolist(),
        "threshold": threshold,
        "is_anomaly": is_anomaly.tolist(),
        "anomaly_prob": [
            min(1.0, float(e / (threshold + 1e-9))) for e in mse
        ],
    }


if __name__ == "__main__":
    train()
