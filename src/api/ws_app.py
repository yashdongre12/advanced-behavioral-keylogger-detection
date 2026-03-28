"""
ws_app.py
---------
Extended FastAPI app that adds WebSocket support on top of the REST API.
Clients can connect to ws://localhost:8000/ws/live and receive JSON
detection updates pushed every 3 seconds — no polling required.

Usage (replaces app.py as entrypoint):
    uvicorn src.api.ws_app:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import time
import os
import sys

BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from fastapi import WebSocket, WebSocketDisconnect
from src.api.app import app                       # re-use all REST routes
from src.detection.realtime_detector import get_latest_result
from src.data_collection.system_monitor import get_latest as sys_latest
from src.utils.helpers import jsonify_safe

PUSH_INTERVAL = 3.0    # seconds between WebSocket pushes

# ─── Connection manager ───────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)
        print(f"[WS] Client connected. Total: {len(self._connections)}")

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)
        print(f"[WS] Client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, data: dict):
        payload = json.dumps(data)
        dead = []
        for ws in list(self._connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ─── Background push task ─────────────────────────────────────────────────────
async def _push_loop():
    """Push latest detection result to all WebSocket clients periodically."""
    while True:
        await asyncio.sleep(PUSH_INTERVAL)
        if not manager._connections:
            continue
        try:
            result = get_latest_result()
            sys_m  = sys_latest()
            payload = jsonify_safe({
                "type":              "detection_update",
                "timestamp":         result.get("timestamp"),
                "threat_level":      result.get("threat_level", "Normal"),
                "final_threat_score":result.get("final_threat_score", 0),
                "if_score":          result.get("if_score", 0),
                "if_is_anomaly":     result.get("if_is_anomaly", 0),
                "lstm_anomaly_prob": result.get("lstm_anomaly_prob", 0),
                "lstm_is_anomaly":   result.get("lstm_is_anomaly", 0),
                "reason":            result.get("reason", ""),
                "cpu_percent":       sys_m.get("cpu_total_percent", 0),
                "mem_percent":       sys_m.get("mem_percent", 0),
            })
            await manager.broadcast(payload)
        except Exception as e:
            print(f"[WS] Broadcast error: {e}")


@app.on_event("startup")
async def start_ws_push():
    asyncio.create_task(_push_loop())


# ─── WebSocket endpoints ─────────────────────────────────────────────────────
@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """
    WebSocket endpoint for real-time detection updates.
    Connect from the browser with:
        const ws = new WebSocket('ws://localhost:8000/ws/live');
        ws.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    await manager.connect(websocket)
    try:
        # Send an immediate snapshot on connect
        result = get_latest_result()
        await websocket.send_text(json.dumps(jsonify_safe({
            "type": "initial_snapshot",
            **result,
        })))
        # Keep connection alive; client sends pings if needed
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/system")
async def ws_system(websocket: WebSocket):
    """
    WebSocket endpoint that pushes system metrics only (lighter payload).
    """
    await manager.connect(websocket)
    try:
        while True:
            sys_m = sys_latest()
            await websocket.send_text(json.dumps(jsonify_safe({
                "type":             "system_update",
                "cpu_percent":      sys_m.get("cpu_total_percent", 0),
                "mem_percent":      sys_m.get("mem_percent", 0),
                "disk_read_mb_s":   sys_m.get("disk_read_mb_s", 0),
                "disk_write_mb_s":  sys_m.get("disk_write_mb_s", 0),
                "process_count":    sys_m.get("active_process_count", 0),
                "timestamp":        sys_m.get("timestamp", ""),
            })))
            await asyncio.sleep(PUSH_INTERVAL)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.ws_app:app", host="0.0.0.0", port=8000, reload=False)
