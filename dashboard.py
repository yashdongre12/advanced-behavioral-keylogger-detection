"""
dashboard.py
------------
Convenience launcher that starts the FastAPI backend in a subprocess.
Run this from the project root:

    python dashboard.py

The React frontend must be started separately (see README).
"""

import subprocess
import sys
import os

# Suppress TensorFlow C++ informational & warning logs
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import time
import signal
import webbrowser
import threading

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
API_HOST     = "0.0.0.0"
API_PORT     = 8000
FRONTEND_URL = "http://localhost:3000"
BACKEND_URL  = f"http://localhost:{API_PORT}/health"


def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║        SENTINEL — Advanced Behavioral Keylogger Detection    ║
║        Isolation Forest + LSTM Hybrid Detection System       ║
╚══════════════════════════════════════════════════════════════╝

  Backend API:   http://localhost:8000
  Frontend:      http://localhost:3000  (start separately)
  API Docs:      http://localhost:8000/docs
  Health Check:  http://localhost:8000/health

  Press Ctrl+C to stop.
""")


def open_browser():
    """Open the frontend dashboard after a short delay."""
    time.sleep(4)
    try:
        webbrowser.open(FRONTEND_URL)
    except Exception:
        pass


def main():
    print_banner()

    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT

    # Start FastAPI backend
    api_cmd = [
        sys.executable, "-m", "uvicorn",
        "src.api.app:app",
        "--host", API_HOST,
        "--port", str(API_PORT),
        "--reload",
    ]

    print(f"[Dashboard] Starting backend: {' '.join(api_cmd)}")
    api_proc = subprocess.Popen(api_cmd, cwd=PROJECT_ROOT, env=env)

    # Try to open browser
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    def shutdown(sig, frame):
        print("\n[Dashboard] Shutting down...")
        api_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("[Dashboard] Backend running. Start the React frontend with:")
    print("             cd frontend && npm start\n")

    try:
        api_proc.wait()
    except KeyboardInterrupt:
        api_proc.terminate()


if __name__ == "__main__":
    main()
