# 🛡️ Advanced Behavioral Keylogger Detection System (ABKDS)

A real-time cybersecurity system that monitors keyboard behavior, background processes, and system resource usage, then uses a **hybrid Isolation Forest + LSTM** machine learning pipeline to detect advanced keylogger-like behavioral patterns. The system is managed via a beautifully designed, secure React dashboard (formerly known as Sentinel).

---

## 🌟 Key Features

- **Real-Time Telemetry Collection**: Seamlessly monitors keyboard events (speed, hold duration, burst typing), active processes, and system resources (CPU, Memory, Disk) using `pynput` and `psutil`.
- **Hybrid Machine Learning Engine**: 
  - **Isolation Forest**: Detects tabular anomalies in aggregated feature states.
  - **LSTM Autoencoder**: Analyzses temporal sequences to catch subtle behavioral changes over time.
- **Secure Authentication**: JWT-based user authentication protecting your detection dashboard and API routes.
- **Modern Interactive Dashboard**: Built with React.js, featuring real-time Chart.js visualizations, process drill-downs, dynamic theming (Dark/Light mode), and toast notifications.
- **Automated Reporting**: Export system health and threat alerts as JSON or CSV directly from the dashboard.

---

## 🏗️ Architecture Overview

```text
Local Machine Telemetry
       │
       ├── KeyboardMonitor  (pynput)       → keyboard_logs.csv, keyboard_features.csv
       ├── ProcessMonitor   (psutil)       → process_logs.csv
       └── SystemMonitor    (psutil)       → system_logs.csv
                    │
                    ▼
         Feature Engineering Pipeline
          └── build_features.py           → tabular_features.csv, sequence_features.npy
                    │
          ┌─────────┴──────────┐
          │                    │
   Isolation Forest       LSTM Autoencoder
   (tabular anomaly)    (temporal sequence)
          │                    │
          └─────────┬──────────┘
                    │
           Hybrid Detection Engine         → predictions.csv, alerts.csv
                    │
              FastAPI Backend (Protected via JWT)
                    │
           React.js Dashboard (ABKDS / Sentinel)
```

---

## 📂 Project Structure

```text
keylogger_detection/
│
├── src/
│   ├── data_collection/             ← pynput/psutil hardware monitors
│   ├── feature_engineering/         ← tabular & sequential feature pipeline
│   ├── models/                      ← Isolation Forest & LSTM training scripts
│   ├── detection/                   ← Real-time hybrid inference engine
│   ├── api/                         ← FastAPI REST server (app.py) & Auth (auth.py)
│   └── utils/                       ← Report generation and generic helpers
│
├── frontend/                        ← React Dashboard source code
│   ├── public/
│   └── src/
│       ├── components/              ← UI Widgets (StatCards, ThreatBadges)
│       ├── pages/                   ← Dashboard, Processes, Keyboard, Alerts views
│       └── services/                ← Axios API clients (api.js, auth.js)
│
├── tests/                           ← Pytest unit and integration tests
├── logs/                            ← Auto-created runtime telemetry storage
│
├── .env.example                     ← Environment variables template
├── requirements.txt                 ← Python backend dependencies
└── README.md                        ← You are here
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (you can copy from `.env.example`). This controls API ports, ML hyperparameters, and security settings:

```env
# API Server Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Telemetry Intervals
DETECTION_INTERVAL_SECONDS=3
PROCESS_POLL_INTERVAL_SECONDS=3

# Machine Learning Hyperparameters
IF_CONTAMINATION=0.05
LSTM_EPOCHS=50
LSTM_BATCH_SIZE=32
LSTM_SEQ_LEN=20

# Threat Thresholds
THRESHOLD_LOW=20
THRESHOLD_HIGH=60

# Security (Required for Dashboard Access)
SENTINEL_ADMIN_PASSWORD=your_secure_password
```

---

## 📋 Prerequisites

- **Python 3.10+** (3.11 recommended)
- **Node.js 18+** and npm
- Windows 10/11 (Keyboard monitoring relies heavily on OS-level hooks, fully supported on Windows)
- At least 4 GB RAM (For TensorFlow LSTM training)

---

## 🚀 Installation & Local Deployment

### 1. Setup Backend & Python Environment

```bash
# Navigate to project root
cd keylogger_detection

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS / Linux (Limited support)

# Install dependencies (use tensorflow-cpu if you lack a GPU)
pip install -r requirements.txt
```

### 2. Setup Frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Workflow: Data Collection & Model Training

To train the models on your specific typing behavior, you need local telemetry data:

```bash
# From the project root with the venv active

# 1. Run monitors to collect baseline data (Type normally for at least 5-10 minutes)
python -m src.data_collection.keyboard_monitor
python -m src.data_collection.process_monitor
python -m src.data_collection.system_monitor

# 2. Build Tabular and Sequential Features
python -m src.feature_engineering.build_features

# 3. Train Models
python -m src.models.train_isolation_forest
python -m src.models.train_lstm
```

> **IMPORTANT**: The LSTM requires a minimum amount of built sequences based on the `.env` `LSTM_SEQ_LEN`. If you receive a dimensional error, you need to collect more background data!

---

## 🏃 Running the System

### Start the REST API Backend

```bash
# Starts monitors, loads models, and runs the FastAPI server
uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

### Start the React Frontend

```bash
# Keep the backend running in another terminal, then run:
cd frontend
npm start
```
The dashboard will open at **http://localhost:3000**.

> **Note on Local Deployment:** For continuous, background execution (a "Local Production Deployment"), we recommend compiling the frontend (`npm run build`), serving the static files via FastAPI, and launching `uvicorn` silently via a Windows Background Task so no terminal windows remain open on your desktop.

---

## 🧪 Testing

The repository uses `pytest` to validate core behavior.

```bash
# Run all tests
pytest tests/
```

---

## 🧠 Detection Logic & Threat Scale

### Hybrid Score Calculation
```text
Final Score = 0.40 × (Anomaly Rate) + 0.40 × (LSTM Prob) + 0.20 × (Heuristics)
```
*Heuristics heavily weigh sudden CPU/Memory spikes and suspicious undocumented processes.*

| Level | Score Range | Recommended Action |
|-------|-------------|--------------------|
| **Normal** | 0–19 | Minimal anomaly, system safe. |
| **Low** | 20–39 | Small behavioral drift (e.g., fatigue typing). |
| **Medium** | 40–59 | Moderate process irregularity or typing mismatch. |
| **High** | 60–79 | Significant anomaly; inspect running processes. |
| **Critical** | 80–100 | Strong keylogger indication. Immediate lockdown recommended. |

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `pynput` fails on Linux | Install `python3-xlib` or run script with X-server display permissions. |
| TensorFlow install fails / Slow | Ensure `tensorflow-cpu` is used if no CUDA GPU is present. |
| Model throws `ValueError: Found array with 0 sample(s)` | You haven't collected enough local telemetry data. Run monitors for longer. |
| Can't login to dashboard | Ensure you've set `SENTINEL_ADMIN_PASSWORD` in your `.env` file. |

---

## 📄 License

**Proprietary and Confidential.** All rights reserved. Do not deploy the agent engine into untrusted enterprise networks without undergoing a proper security review.
