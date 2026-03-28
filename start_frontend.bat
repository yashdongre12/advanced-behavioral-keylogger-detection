@echo off
:: ──────────────────────────────────────────────────────────────────────────
::  start_frontend.bat  — Starts the React frontend (Windows)
:: ──────────────────────────────────────────────────────────────────────────
echo.
echo   SENTINEL — Starting React Dashboard
echo   ────────────────────────────────────
echo   Dashboard: http://localhost:3000
echo   Press Ctrl+C to stop.
echo.

cd /d %~dp0frontend
npm start
pause
