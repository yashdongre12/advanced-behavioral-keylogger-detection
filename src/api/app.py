"""
app.py
------
FastAPI backend that:
  1. Launches all three real-time monitors (keyboard, process, system)
  2. Launches the hybrid ML detector
  3. Serves live telemetry and detection results via REST API
  4. Supports CORS for the React frontend

Run with:
    uvicorn src.api.app:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys

# Suppress TensorFlow C++ informational & warning logs
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import time
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from src.data_collection.keyboard_monitor import (
    start as kb_start, stop as kb_stop,
    get_latest_features as kb_features,
    get_event_count as kb_event_count,
)
from src.data_collection.process_monitor import (
    start as proc_start, stop as proc_stop,
    get_latest_snapshot as proc_snapshot,
    get_top_suspicious as proc_top_sus,
    get_active_count as proc_count,
)
from src.data_collection.system_monitor import (
    start as sys_start, stop as sys_stop,
    get_latest as sys_latest,
    get_history as sys_history,
)
from src.detection.realtime_detector import (
    start as det_start, stop as det_stop,
    get_latest_result as det_latest,
    get_recent_results as det_recent,
    get_recent_alerts as det_alerts,
)
from src.utils.helpers import (
    get_recent_logs, get_all_logs, get_paginated_logs,
    log_path, jsonify_safe, now_iso,
)
from src.utils.report_generator import (
    build_summary_report, save_json_report, save_csv_report, list_reports,
)
from src.api.auth import router as auth_router

# ─── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Keylogger Detection API",
    description="Advanced Behavioral Keylogger Detection System – REST API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register auth router
app.include_router(auth_router)

_start_time = time.time()


# ─── Startup / shutdown ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Start all monitors and detection engine on app startup."""
    kb_start()
    proc_start()
    sys_start()
    # Give monitors a moment to warm up
    await asyncio.sleep(2)
    det_start(
        get_kb_feats=kb_features,
        get_sys_metrics=sys_latest,
        get_proc_snapshot=proc_snapshot,
    )
    print("[API] All monitors and detector started.")


@app.on_event("shutdown")
async def shutdown_event():
    det_stop()
    kb_stop()
    proc_stop()
    sys_stop()


# ─── Health / meta ────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    uptime = round(time.time() - _start_time, 1)
    return {"status": "ok", "uptime_seconds": uptime, "timestamp": now_iso()}


@app.get("/status")
def status():
    det = det_latest()
    sys_m = sys_latest()
    return jsonify_safe({
        "timestamp": now_iso(),
        "threat_level": det.get("threat_level", "Normal"),
        "final_threat_score": det.get("final_threat_score", 0),
        "cpu_percent": sys_m.get("cpu_total_percent", 0),
        "mem_percent": sys_m.get("mem_percent", 0),
        "active_process_count": proc_count(),
        "keyboard_event_count": kb_event_count(),
        "uptime_seconds": round(time.time() - _start_time, 1),
    })


# ─── System endpoints ─────────────────────────────────────────────────────────
@app.get("/system/live")
def system_live():
    """Current system metrics snapshot."""
    return jsonify_safe(sys_latest())


@app.get("/system/history")
def system_history(n: int = Query(60, ge=1, le=500)):
    """Last N system metric snapshots."""
    return jsonify_safe(sys_history(n))


# ─── Process endpoints ────────────────────────────────────────────────────────
@app.get("/process/live")
def process_live():
    """Current process snapshot (all processes)."""
    snap = proc_snapshot()
    return jsonify_safe({"count": len(snap), "processes": snap})


@app.get("/process/suspicious")
def process_suspicious(n: int = Query(10, ge=1, le=50)):
    """Top-N most suspicious processes."""
    return jsonify_safe(proc_top_sus(n))


# ─── Keyboard endpoints ───────────────────────────────────────────────────────
@app.get("/keyboard/live")
def keyboard_live():
    """Latest keyboard behavioral feature vector."""
    feats = kb_features()
    feats["event_count"] = kb_event_count()
    return jsonify_safe(feats)


@app.get("/keyboard/history")
def keyboard_history(n: int = Query(50, ge=1, le=200)):
    """Last N keyboard feature rows from Mongo."""
    rows = get_recent_logs("keyboard_features", n)
    return jsonify_safe({"count": len(rows), "data": rows})


# ─── Detection / prediction endpoints ─────────────────────────────────────────
@app.get("/predictions/live")
def predictions_live():
    """Most recent hybrid ML detection result."""
    return jsonify_safe(det_latest())


@app.get("/predictions/recent")
def predictions_recent(n: int = Query(50, ge=1, le=200)):
    """Last N detection results from in-memory buffer."""
    return jsonify_safe({"count": n, "data": det_recent(n)})


# ─── Alert endpoints ──────────────────────────────────────────────────────────
@app.get("/alerts/live")
def alerts_live():
    """Most recent alert (if any)."""
    alerts = det_alerts(1)
    return jsonify_safe(alerts[0] if alerts else {"message": "No alerts"})


@app.get("/alerts/recent")
def alerts_recent(n: int = Query(50, ge=1, le=200)):
    """Last N alerts from in-memory buffer."""
    return jsonify_safe({"count": n, "data": det_alerts(n)})


@app.get("/alerts/history")
def alerts_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    level: Optional[str] = Query(None),
):
    """Paginated alert history from Mongo. Optionally filter by threat level."""
    query = {"threat_level": level} if level else None
    result = get_paginated_logs("alerts", page, per_page, query)
    return jsonify_safe(result)


# ─── Historical analytics endpoints ──────────────────────────────────────────
@app.get("/history/metrics")
def history_metrics(n: int = Query(100, ge=1, le=1000)):
    """Last N rows of system metrics from Mongo for trend charts."""
    rows = get_recent_logs("system_logs", n)
    return jsonify_safe({"count": len(rows), "data": rows})


@app.get("/history/threats")
def history_threats(n: int = Query(100, ge=1, le=1000)):
    """Last N prediction rows from Mongo for threat trend chart."""
    rows = get_recent_logs("predictions", n)
    return jsonify_safe({"count": len(rows), "data": rows})


@app.get("/history/keyboard")
def history_keyboard(n: int = Query(100, ge=1, le=1000)):
    """Last N keyboard feature rows for trend analysis."""
    rows = get_recent_logs("keyboard_features", n)
    return jsonify_safe({"count": len(rows), "data": rows})


# ─── CSV download endpoints ───────────────────────────────────────────────────
@app.get("/download/{log_name}")
def download_log(log_name: str):
    """Download a raw log CSV file exported from MongoDB."""
    allowed = {
        "keyboard_logs.csv": "keyboard_logs", 
        "keyboard_features.csv": "keyboard_features",
        "process_logs.csv": "process_logs", 
        "system_logs.csv": "system_logs",
        "predictions.csv": "predictions", 
        "alerts.csv": "alerts",
    }
    if log_name not in allowed:
        raise HTTPException(status_code=404, detail="Log not found.")
        
    from src.utils.db import db
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed.")
        
    collection = allowed[log_name]
    cursor = db[collection].find({}, {"_id": 0}).sort("timestamp", 1)
    
    import pandas as pd
    from fastapi.responses import PlainTextResponse
    
    df = pd.DataFrame(list(cursor))
    if df.empty:
        raise HTTPException(status_code=404, detail="Log file is empty.")
        
    csv_str = df.to_csv(index=False)
    return PlainTextResponse(
        csv_str, 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={log_name}"}
    )


# ─── Report endpoints ─────────────────────────────────────────────────────────
@app.get("/reports/summary")
def reports_summary():
    """Generate and return a JSON threat summary report from all telemetry."""
    try:
        report = build_summary_report()
        return jsonify_safe(report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/list")
def reports_list():
    """List all previously generated report files."""
    return jsonify_safe(list_reports())


@app.get("/reports/download/json")
def reports_download_json():
    """Generate and download the threat summary as a JSON file."""
    try:
        report = build_summary_report()
        path   = save_json_report(report)
        return FileResponse(path, media_type="application/json",
                            filename=os.path.basename(path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/download/csv")
def reports_download_csv():
    """Generate and download the threat summary as a CSV file."""
    try:
        report = build_summary_report()
        path   = save_csv_report(report)
        return FileResponse(path, media_type="text/csv",
                            filename=os.path.basename(path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.app:app", host="0.0.0.0", port=8000, reload=False)
