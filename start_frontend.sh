#!/usr/bin/env bash
# start_frontend.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/frontend"
echo "Starting React dashboard at http://localhost:3000"
npm start
