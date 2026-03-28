@echo off
:: ──────────────────────────────────────────────────────────────────────────
::  setup_and_train.bat
::  Runs the complete pipeline: install → collect → features → train models
::  Run once after cloning / downloading the project.
:: ──────────────────────────────────────────────────────────────────────────
setlocal
set ROOT=%~dp0
cd /d %ROOT%

echo.
echo ============================================================
echo   SENTINEL — Full Setup and Training Pipeline
echo ============================================================

:: 1. Install Python deps
echo.
echo [1/6] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 ( echo ERROR: pip install failed. & pause & exit /b 1 )

:: 2. Install frontend deps
echo.
echo [2/6] Installing frontend (npm) dependencies...
cd frontend
npm install
cd ..
if errorlevel 1 ( echo ERROR: npm install failed. & pause & exit /b 1 )

:: 3. Collect telemetry
echo.
echo [3/6] Collecting telemetry for 10 minutes...
echo       Type normally at your keyboard during this time.
set PYTHONPATH=%ROOT%
python collect_data.py --duration 600
if errorlevel 1 ( echo ERROR: Data collection failed. & pause & exit /b 1 )

:: 4. Build features
echo.
echo [4/6] Building feature dataset...
python -m src.feature_engineering.build_features
if errorlevel 1 ( echo ERROR: Feature engineering failed. & pause & exit /b 1 )

:: 5. Train models
echo.
echo [5/6] Training models...
python retrain_models.py
if errorlevel 1 ( echo ERROR: Model training failed. & pause & exit /b 1 )

:: 6. Done
echo.
echo ============================================================
echo   Setup complete!
echo ============================================================
echo.
echo   To run the system:
echo     start_backend.bat   (in one terminal)
echo     start_frontend.bat  (in another terminal)
echo.
pause
endlocal
