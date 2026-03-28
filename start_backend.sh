#!/usr/bin/env bash
# start_backend.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$ROOT"
cd "$ROOT"
echo "Starting backend at http://localhost:8000"
python -m uvicorn src.api.ws_app:app --host 0.0.0.0 --port 8000 --reload
