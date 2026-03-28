"""
system_monitor.py
-----------------
Real-time system resource monitoring using psutil.
Tracks CPU%, memory%, disk I/O, and active process count at regular
intervals and saves to a structured CSV log.
"""

import time
import csv
import threading
import os
import psutil
from datetime import datetime
from collections import deque

# ─── Configuration ────────────────────────────────────────────────────────────
LOG_PATH = os.path.join(os.path.dirname(__file__), "../../logs/system_logs.csv")
POLL_INTERVAL = 2.0
_MAX_BUFFER = 1000

# ─── State ────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_metrics_buffer: deque = deque(maxlen=_MAX_BUFFER)
_running = False
_thread = None

COLUMNS = [
    "timestamp",
    "cpu_total_percent",
    "cpu_per_core",
    "mem_percent",
    "mem_used_mb",
    "mem_total_mb",
    "swap_percent",
    "disk_read_mb_s",
    "disk_write_mb_s",
    "net_sent_mb_s",
    "net_recv_mb_s",
    "active_process_count",
    "load_avg_1m",
]


def _ensure_log():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    if not os.path.exists(LOG_PATH):
        with open(LOG_PATH, "w", newline="") as f:
            csv.writer(f).writerow(COLUMNS)


def _append_row(row: list):
    with open(LOG_PATH, "a", newline="") as f:
        csv.writer(f).writerow(row)


# ─── Snapshot collection ──────────────────────────────────────────────────────
_prev_disk = psutil.disk_io_counters()
_prev_net = psutil.net_io_counters()
_prev_time = time.time()


def _collect_metrics() -> dict:
    global _prev_disk, _prev_net, _prev_time

    now = time.time()
    elapsed = now - _prev_time
    _prev_time = now

    # CPU
    cpu_total = psutil.cpu_percent(interval=None)
    cpu_per_core = psutil.cpu_percent(percpu=True, interval=None)

    # Memory
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # Disk I/O delta
    disk = psutil.disk_io_counters()
    if disk and _prev_disk and elapsed > 0:
        disk_read = (disk.read_bytes - _prev_disk.read_bytes) / elapsed / (1024 * 1024)
        disk_write = (disk.write_bytes - _prev_disk.write_bytes) / elapsed / (1024 * 1024)
    else:
        disk_read = disk_write = 0.0
    _prev_disk = disk

    # Network I/O delta
    net = psutil.net_io_counters()
    if net and _prev_net and elapsed > 0:
        net_sent = (net.bytes_sent - _prev_net.bytes_sent) / elapsed / (1024 * 1024)
        net_recv = (net.bytes_recv - _prev_net.bytes_recv) / elapsed / (1024 * 1024)
    else:
        net_sent = net_recv = 0.0
    _prev_net = net

    # Process count
    proc_count = len(psutil.pids())

    # Load average (Windows returns 0.0 for each)
    try:
        load_avg = psutil.getloadavg()[0]
    except AttributeError:
        load_avg = 0.0

    return {
        "timestamp": datetime.now().isoformat(),
        "cpu_total_percent": round(cpu_total, 2),
        "cpu_per_core": str(cpu_per_core),
        "mem_percent": round(mem.percent, 2),
        "mem_used_mb": round(mem.used / (1024 * 1024), 2),
        "mem_total_mb": round(mem.total / (1024 * 1024), 2),
        "swap_percent": round(swap.percent, 2),
        "disk_read_mb_s": round(max(disk_read, 0.0), 4),
        "disk_write_mb_s": round(max(disk_write, 0.0), 4),
        "net_sent_mb_s": round(max(net_sent, 0.0), 4),
        "net_recv_mb_s": round(max(net_recv, 0.0), 4),
        "active_process_count": proc_count,
        "load_avg_1m": round(load_avg, 3),
    }


# ─── Main loop ────────────────────────────────────────────────────────────────
def _monitor_loop():
    # Warm-up CPU reading
    psutil.cpu_percent(interval=None)
    psutil.cpu_percent(percpu=True, interval=None)
    time.sleep(1)

    while _running:
        start = time.time()
        metrics = _collect_metrics()

        with _lock:
            _metrics_buffer.append(metrics)

        _append_row([metrics[c] for c in COLUMNS])

        elapsed = time.time() - start
        time.sleep(max(0, POLL_INTERVAL - elapsed))


# ─── Public API ───────────────────────────────────────────────────────────────
def start():
    global _running, _thread
    _ensure_log()
    _running = True
    _thread = threading.Thread(target=_monitor_loop, daemon=True)
    _thread.start()
    print("[SystemMonitor] Started.")


def stop():
    global _running
    _running = False
    print("[SystemMonitor] Stopped.")


def get_latest() -> dict:
    with _lock:
        if _metrics_buffer:
            return dict(_metrics_buffer[-1])
    return {}


def get_history(n: int = 60) -> list:
    """Return last N system metric snapshots."""
    with _lock:
        return list(_metrics_buffer)[-n:]


if __name__ == "__main__":
    start()
    print("Monitoring system. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(3)
            m = get_latest()
            print(f"CPU={m.get('cpu_total_percent')}%  MEM={m.get('mem_percent')}%  "
                  f"Procs={m.get('active_process_count')}")
    except KeyboardInterrupt:
        stop()
