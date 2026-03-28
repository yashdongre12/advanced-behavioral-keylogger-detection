"""
retrain_models.py
-----------------
Full retrain pipeline: builds features from all collected telemetry,
trains Isolation Forest, then trains LSTM.

Run this whenever you have collected significantly more telemetry,
or to update the baseline after a period of normal use.

Usage:
    python retrain_models.py [--skip-if] [--skip-lstm]
"""

import argparse
import sys
import os
import json
import time

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)


def parse_args():
    p = argparse.ArgumentParser(description="Retrain all detection models.")
    p.add_argument("--skip-if",   action="store_true", help="Skip Isolation Forest training")
    p.add_argument("--skip-lstm", action="store_true", help="Skip LSTM training")
    p.add_argument("--min-rows",  type=int, default=30, help="Minimum rows required (default 30)")
    return p.parse_args()


def banner(title: str):
    w = 60
    print(f"\n{'─'*w}")
    print(f"  {title}")
    print(f"{'─'*w}")


def main():
    args = parse_args()
    start = time.time()

    # ── Step 1: Feature engineering ───────────────────────────────────────────
    banner("Step 1 / 3 — Building feature dataset")
    from src.feature_engineering.build_features import (
        build_and_save_tabular,
        build_and_save_sequences,
        build_tabular,
    )

    tabular_path = build_and_save_tabular()
    df = build_tabular()

    if len(df) < args.min_rows:
        print(f"\n[Retrain] ERROR: Only {len(df)} rows available.")
        print(f"  Run 'python collect_data.py' for at least 5 minutes first.")
        sys.exit(1)

    print(f"[Retrain] Dataset: {len(df)} rows × {len(df.columns)} columns")
    seq_path = build_and_save_sequences()

    # ── Step 2: Isolation Forest ───────────────────────────────────────────────
    if not args.skip_if:
        banner("Step 2 / 3 — Training Isolation Forest")
        from src.models.train_isolation_forest import train as train_if
        model, scaler = train_if(min_rows=args.min_rows)
        if model is None:
            print("[Retrain] Isolation Forest training failed — not enough data.")
        else:
            # Print quick metrics
            metrics_path = os.path.join(BASE, "src/models/if_metrics.json")
            if os.path.exists(metrics_path):
                with open(metrics_path) as f:
                    m = json.load(f)
                print(f"  Anomaly count : {m['anomaly_count']} / {m['n_samples']}")
                print(f"  Score mean    : {m['score_mean']:.4f}")
                print(f"  Score std     : {m['score_std']:.4f}")
    else:
        print("[Retrain] Skipping Isolation Forest (--skip-if)")

    # ── Step 3: LSTM ───────────────────────────────────────────────────────────
    if not args.skip_lstm:
        banner("Step 3 / 3 — Training LSTM Autoencoder")
        from src.models.train_lstm import train as train_lstm
        result = train_lstm(min_sequences=args.min_rows)
        if result is None:
            print("[Retrain] LSTM training failed — not enough sequences.")
        else:
            model_obj, threshold = result
            print(f"  Anomaly threshold : {threshold:.6f}")
            # Print metrics
            metrics_path = os.path.join(BASE, "src/models/lstm_metrics.json")
            if os.path.exists(metrics_path):
                with open(metrics_path) as f:
                    m = json.load(f)
                print(f"  Epochs trained   : {m['epochs_trained']}")
                print(f"  Final val loss   : {m['final_val_loss']:.6f}")
    else:
        print("[Retrain] Skipping LSTM (--skip-lstm)")

    # ── Summary ────────────────────────────────────────────────────────────────
    elapsed = time.time() - start
    banner(f"Retraining complete  ({elapsed:.1f}s)")
    print(f"  Models saved to : src/models/")
    print(f"  Logs saved to   : logs/")
    print(f"\n  Start the backend to activate updated models:")
    print(f"    python dashboard.py")


if __name__ == "__main__":
    main()
