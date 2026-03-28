# 🛡️ Advanced Behavioral Keylogger Detection System

A real-time cybersecurity system that monitors keyboard behavior, background processes, and system resource usage, then uses a **hybrid Isolation Forest + LSTM** machine learning pipeline to detect advanced keylogger-like behavioral patterns.

---

## Architecture Overview

```
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
              FastAPI Backend
                    │
           React.js Dashboard
```

---

## Project Structure

```
keylogger_detection/
│
├── src/
│   ├── data_collection/
│   │   ├── keyboard_monitor.py      ← pynput keyboard event capture
│   │   ├── process_monitor.py       ← psutil process scanning
│   │   └── system_monitor.py        ← CPU, memory, disk, network metrics
│   ├── feature_engineering/
│   │   └── build_features.py        ← tabular + sequential feature pipeline
│   ├── models/
│   │   ├── train_isolation_forest.py
│   │   ├── train_lstm.py
│   │   ├── isolation_forest_model.pkl    (generated after training)
│   │   ├── lstm_model.h5                 (generated after training)
│   │   └── scaler.pkl                    (generated after training)
│   ├── detection/
│   │   └── realtime_detector.py     ← hybrid inference engine
│   ├── api/
│   │   └── app.py                   ← FastAPI REST server
│   └── utils/
│       └── helpers.py
│
├── frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.js
│   │   │   ├── StatCard.js
│   │   │   └── ThreatBadge.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js         ← KPI cards + CPU/MEM/threat charts
│   │   │   ├── Processes.js         ← live process table + suspicion scores
│   │   │   ├── Keyboard.js          ← typing analytics + behavioral charts
│   │   │   ├── Detection.js         ← IF/LSTM scores + reason analysis
│   │   │   ├── Alerts.js            ← paginated alert history + filters
│   │   │   └── History.js           ← long-term trend analytics
│   │   ├── services/api.js          ← Axios API client
│   │   ├── App.js
│   │   └── index.css                ← dark cybersecurity theme
│   └── package.json
│
├── logs/                            ← auto-created at runtime
│   ├── keyboard_logs.csv
│   ├── keyboard_features.csv
│   ├── process_logs.csv
│   ├── system_logs.csv
│   ├── tabular_features.csv
│   ├── predictions.csv
│   └── alerts.csv
│
├── requirements.txt
└── README.md
```

---

## Prerequisites

- **Python 3.10+** (3.11 recommended)
- **Node.js 18+** and npm
- Windows 10/11 (pynput keyboard monitoring works best on Windows)
- At least 4 GB RAM (TensorFlow LSTM training)

---

## Installation

### 1. Clone / set up project root

```bash
cd keylogger_detection
```

### 2. Create Python virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

> **Note:** If you have no GPU, replace `tensorflow==2.16.1` with `tensorflow-cpu==2.16.1` in `requirements.txt` before running pip install.

### 4. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Step-by-Step Workflow

### Step 1 — Collect Telemetry (collect data for at least 5–10 minutes)

Start all three monitors simultaneously. The fastest way is to just launch the API (Step 4), which starts all monitors automatically. Alternatively, run each monitor standalone:

```bash
# From project root with venv active

# Keyboard monitor (type normally for a few minutes)
python -m src.data_collection.keyboard_monitor

# Process monitor (runs in background)
python -m src.data_collection.process_monitor

# System monitor (runs in background)
python -m src.data_collection.system_monitor
```

Data is saved to `logs/` automatically.

### Step 2 — Build Features

```bash
python -m src.feature_engineering.build_features
```

This reads `logs/keyboard_features.csv`, `logs/system_logs.csv`, and `logs/process_logs.csv`, merges them into time-bucketed feature rows, and saves:
- `logs/tabular_features.csv` — for Isolation Forest
- `logs/sequence_features.npy` — for LSTM

### Step 3 — Train Isolation Forest

```bash
python -m src.models.train_isolation_forest
```

Requires at least **30 rows** in `logs/tabular_features.csv`. Saves:
- `src/models/isolation_forest_model.pkl`
- `src/models/scaler.pkl`
- `src/models/if_metrics.json`

### Step 4 — Train LSTM Autoencoder

```bash
python -m src.models.train_lstm
```

Requires at least **30 sequences** (≈ 50+ rows of telemetry). Saves:
- `src/models/lstm_model.h5`
- `src/models/lstm_metrics.json` (includes anomaly threshold)

Training uses early stopping, so it will stop automatically when validation loss plateaus.

### Step 5 — Launch Backend API

```bash
uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload
```

The API starts all monitors automatically on startup and launches the detection engine. You will see:

```
[KeyboardMonitor] Started.
[ProcessMonitor] Started.
[SystemMonitor] Started.
[Detector] Isolation Forest loaded.
[Detector] LSTM model loaded.
[Detector] Real-time detection started.
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Step 6 — Launch React Frontend

```bash
cd frontend
npm start
```

Open **http://localhost:3000** in your browser.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health + uptime |
| GET | `/status` | Current threat level + KPIs |
| GET | `/system/live` | Live system metrics snapshot |
| GET | `/system/history?n=60` | Last N system snapshots |
| GET | `/process/live` | All running processes |
| GET | `/process/suspicious?n=10` | Top-N suspicious processes |
| GET | `/keyboard/live` | Live keyboard feature vector |
| GET | `/keyboard/history?n=50` | Historical keyboard features |
| GET | `/predictions/live` | Latest ML detection result |
| GET | `/predictions/recent?n=50` | Recent detection results |
| GET | `/alerts/live` | Most recent alert |
| GET | `/alerts/recent?n=50` | Recent in-memory alerts |
| GET | `/alerts/history?page=1&per_page=50&level=High` | Paginated alert log |
| GET | `/history/metrics?n=100` | Historical system metrics for charts |
| GET | `/history/threats?n=100` | Historical threat scores for charts |
| GET | `/history/keyboard?n=100` | Historical keyboard features |
| GET | `/download/{log_name}` | Download raw CSV log file |

---

## Dashboard Pages

| Page | Description |
|------|-------------|
| **Dashboard** | KPI cards (CPU, MEM, Processes, Threat Score) + live charts |
| **Processes** | Live process table with suspicion scores, search, sort |
| **Keyboard** | Typing speed, hold durations, burst score, backspace ratio |
| **Detection** | IF score, LSTM anomaly probability, combined threat score + reasons |
| **Alerts** | Full alert history with level filtering and CSV download |
| **Analytics** | Long-term trend charts for all signals |

---

## Threat Level Scale

| Level | Score Range | Meaning |
|-------|-------------|---------|
| Normal | 0–19 | All systems nominal |
| Low | 20–39 | Minor anomaly detected |
| Medium | 40–59 | Moderate suspicious activity |
| High | 60–79 | Significant anomaly, investigate |
| Critical | 80–100 | Strong keylogger-like behavior detected |

---

## Detection Logic

### Isolation Forest
- Trained on real tabular behavioral features (keyboard + system + process aggregates)
- Contamination parameter set to 5% (assumes ~5% of baseline contains noise)
- Raw score normalised to [0–1]; lower raw score = more anomalous

### LSTM Autoencoder
- Learns normal temporal patterns from rolling windows (default: 20 timesteps)
- At inference: reconstruction error > threshold → anomaly
- Threshold = 95th percentile of training reconstruction MSE

### Hybrid Score
```
final_score = 0.40 × IF_norm + 0.40 × LSTM_prob + 0.20 × heuristic
```

Heuristic factors: CPU spike, memory pressure, suspicious process score, burst typing, repeat key ratio.

---

## Important Notes

1. **Run as Administrator on Windows** — pynput keyboard monitoring and process inspection may require elevated privileges.
2. **Collect ≥ 5 minutes of data** before training — too few samples produce an unreliable model.
3. **Re-train periodically** — as your baseline typing/system behavior changes, re-train for better accuracy.
4. **No synthetic data** — this system only uses real local telemetry. There are no fake attack samples.
5. **LSTM requires TensorFlow** — first run will be slower as TF initialises. GPU is not required.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `pynput` fails on Linux | Install `python3-xlib` or run with display access |
| TensorFlow install fails | Try `pip install tensorflow-cpu` instead |
| `Not enough rows` error | Collect more telemetry (type and let monitors run) |
| Frontend can't reach API | Ensure backend is on port 8000 and CORS is enabled |
| `ModuleNotFoundError` | Run all commands from the project root with venv active |

---

## License

For academic / final year project use. Do not deploy without proper security review.
