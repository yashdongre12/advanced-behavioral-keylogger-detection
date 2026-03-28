#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  setup_and_train.sh   — Full pipeline for Linux / macOS
# ─────────────────────────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT"

echo ""
echo "============================================================"
echo "  SENTINEL — Full Setup and Training Pipeline"
echo "============================================================"

echo ""
echo "[1/6] Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "[2/6] Installing frontend (npm) dependencies..."
cd frontend && npm install && cd ..

echo ""
echo "[3/6] Collecting telemetry for 10 minutes..."
echo "      Type normally at your keyboard during this time."
python collect_data.py --duration 600

echo ""
echo "[4/6] Building feature dataset..."
python -m src.feature_engineering.build_features

echo ""
echo "[5/6] Training models..."
python retrain_models.py

echo ""
echo "============================================================"
echo "  Setup complete!"
echo "============================================================"
echo ""
echo "  To run the system:"
echo "    ./start_backend.sh   (in one terminal)"
echo "    ./start_frontend.sh  (in another terminal)"
echo ""
