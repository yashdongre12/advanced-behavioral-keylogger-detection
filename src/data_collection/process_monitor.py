"""
process_monitor.py
------------------
Real-time background process monitoring using psutil.
Collects process metadata, CPU/memory usage, detects silent background
processes, and logs newly spawned processes.
"""

import time
import csv
import threading
import os
import psutil
from datetime import datetime
from collections import deque

# ─── Configuration ────────────────────────────────────────────────────────────
LOG_PATH = os.path.join(os.path.dirname(__file__), "../../logs/process_logs.csv")
POLL_INTERVAL = 3.0   # seconds between full process sweeps
_MAX_BUFFER = 500

# ─── State ────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_process_buffer: deque = deque(maxlen=_MAX_BUFFER)
_known_pids: set = set()
_running = False
_thread = None


# ─── CSV helpers ──────────────────────────────────────────────────────────────
COLUMNS = [
    "timestamp", "pid", "ppid", "name", "exe",
    "cpu_percent", "mem_percent", "rss_mb",
    "num_threads", "status", "create_time",
    "is_background", "suspicion_score"
]


def _ensure_log():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    if not os.path.exists(LOG_PATH):
        with open(LOG_PATH, "w", newline="") as f:
            csv.writer(f).writerow(COLUMNS)


def _append_rows(rows: list):
    with open(LOG_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(rows)


# ─── Suspicion heuristics ─────────────────────────────────────────────────────
# Known legitimate system process names (lower-case)
_WHITELIST = {
    "system idle process", "system", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe", "svchost.exe",
    "dwm.exe", "explorer.exe", "taskhostw.exe", "runtimebroker.exe",
    "spoolsv.exe", "searchindexer.exe", "audiodg.exe", "conhost.exe",
    "dllhost.exe", "msdtc.exe", "wuauclt.exe", "wermgr.exe",
}

# Keywords that suggest stealth / monitoring software
_SUSPICIOUS_KEYWORDS = [
    "keylog", "hook", "spy", "capture", "record", "intercept",
    "stealth", "hidden", "inject", "dump", "credential", "passwd",
    "mimikatz", "rat", "remote", "logger",
]


def _suspicion_score(proc_info: dict) -> float:
    """
    Heuristic suspicion score [0.0–1.0] based on process characteristics.
    This is a rule-based pre-filter; ML models refine this further.
    """
    score = 0.0
    name_lower = proc_info["name"].lower()
    exe_lower = (proc_info["exe"] or "").lower()

    # Name matches suspicious keyword
    for kw in _SUSPICIOUS_KEYWORDS:
        if kw in name_lower or kw in exe_lower:
            score += 0.4
            break

    # Not whitelisted and has no visible window (background)
    if proc_info["is_background"] and name_lower not in _WHITELIST:
        score += 0.2

    # Very high CPU from a single background process
    if proc_info["cpu_percent"] > 30 and proc_info["is_background"]:
        score += 0.2

    # No executable path (hidden / packed)
    if not proc_info["exe"]:
        score += 0.15

    # Very high thread count for a non-system process
    if proc_info["num_threads"] > 50 and name_lower not in _WHITELIST:
        score += 0.1

    return min(round(score, 3), 1.0)


def _collect_process(proc: psutil.Process) -> dict | None:
    """Safely collect all fields from a psutil Process object."""
    try:
        with proc.oneshot():
            name = proc.name()
            pid = proc.pid
            ppid = proc.ppid()
            status = proc.status()
            num_threads = proc.num_threads()
            create_time = proc.create_time()

            try:
                exe = proc.exe()
            except (psutil.AccessDenied, psutil.NoSuchProcess, PermissionError):
                exe = None

            try:
                cpu = proc.cpu_percent(interval=None)
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                cpu = 0.0

            try:
                mem = proc.memory_percent()
                rss = proc.memory_info().rss / (1024 * 1024)  # MB
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                mem = 0.0
                rss = 0.0

            # "Background" heuristic: no terminal / window handle on Windows
            try:
                connections = proc.connections()
            except Exception:
                connections = []

            is_background = (status == "sleeping" and num_threads < 5) or (
                name.lower() not in _WHITELIST
            )

        info = {
            "timestamp": datetime.now().isoformat(),
            "pid": pid,
            "ppid": ppid,
            "name": name,
            "exe": exe,
            "cpu_percent": round(cpu, 3),
            "mem_percent": round(mem, 3),
            "rss_mb": round(rss, 3),
            "num_threads": num_threads,
            "status": status,
            "create_time": datetime.fromtimestamp(create_time).isoformat(),
            "is_background": is_background,
            "suspicion_score": 0.0,  # filled below
        }
        info["suspicion_score"] = _suspicion_score(info)
        return info

    except (psutil.NoSuchProcess, psutil.ZombieProcess, psutil.AccessDenied):
        return None


# ─── Main monitoring loop ─────────────────────────────────────────────────────
def _monitor_loop():
    # Warm up CPU percentages (first call is always 0)
    for p in psutil.process_iter(["pid"]):
        try:
            p.cpu_percent(interval=None)
        except Exception:
            pass
    time.sleep(1)

    while _running:
        start = time.time()
        snapshot = []
        current_pids = set()

        for proc in psutil.process_iter(["pid"]):
            if not _running:
                break
            info = _collect_process(proc)
            if info:
                snapshot.append(info)
                current_pids.add(info["pid"])

        with _lock:
            new_pids = current_pids - _known_pids
            _known_pids.clear()
            _known_pids.update(current_pids)

            # Tag newly-spawned processes with extra suspicion bump
            for info in snapshot:
                if info["pid"] in new_pids:
                    info["suspicion_score"] = min(info["suspicion_score"] + 0.1, 1.0)

            _process_buffer.extend(snapshot)

        _append_rows([[v for v in info.values()] for info in snapshot])

        elapsed = time.time() - start
        time.sleep(max(0, POLL_INTERVAL - elapsed))


# ─── Public API ───────────────────────────────────────────────────────────────
def start():
    global _running, _thread
    _ensure_log()
    _running = True
    _thread = threading.Thread(target=_monitor_loop, daemon=True)
    _thread.start()
    print("[ProcessMonitor] Started.")


def stop():
    global _running
    _running = False
    print("[ProcessMonitor] Stopped.")


def get_latest_snapshot() -> list:
    """Return the most recent process list."""
    with _lock:
        if not _process_buffer:
            return []
        # Group by PID and return most recent record per PID
        seen = {}
        for item in reversed(list(_process_buffer)):
            if item["pid"] not in seen:
                seen[item["pid"]] = item
        return list(seen.values())


def get_top_suspicious(n: int = 5) -> list:
    """Return top-N most suspicious processes."""
    snap = get_latest_snapshot()
    return sorted(snap, key=lambda x: x["suspicion_score"], reverse=True)[:n]


def get_active_count() -> int:
    """Return number of active processes in latest snapshot."""
    return len(get_latest_snapshot())


if __name__ == "__main__":
    start()
    print("Monitoring processes. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(5)
            top = get_top_suspicious(3)
            for p in top:
                print(f"  [{p['suspicion_score']}] {p['name']} (PID {p['pid']}) CPU={p['cpu_percent']}%")
    except KeyboardInterrupt:
        stop()
