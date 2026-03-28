@echo off
:: ──────────────────────────────────────────────────────────────────────────
::  start_backend.bat  — Starts the FastAPI backend (Windows)
::  Run from the project root directory.
:: ──────────────────────────────────────────────────────────────────────────
echo.
echo   SENTINEL — Starting Backend API
echo   ────────────────────────────────
echo   API docs:  http://localhost:8000/docs
echo   Press Ctrl+C to stop.
echo.

set PYTHONPATH=%~dp0
cd /d %~dp0
python -m uvicorn src.api.ws_app:app --host 0.0.0.0 --port 8000 --reload
pause
