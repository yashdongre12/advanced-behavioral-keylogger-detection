"""
keyboard_monitor.py
-------------------
Real-time keyboard behavior monitoring using pynput.
Captures key press/release events and computes behavioral features
such as hold duration, inter-key delay, typing speed, burst frequency,
backspace/enter frequency, and special key usage.
"""

import time
import csv
import threading
import os
from collections import deque
from pynput import keyboard
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────
LOG_PATH = os.path.join(os.path.dirname(__file__), "../../logs/keyboard_logs.csv")
FEATURE_LOG_PATH = os.path.join(os.path.dirname(__file__), "../../logs/keyboard_features.csv")
WINDOW_SIZE = 30          # Number of key events per analysis window
FLUSH_INTERVAL = 5.0      # Seconds between feature flushes


# ─── State ────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_press_times: dict = {}           # key -> press timestamp
_events: deque = deque(maxlen=500)  # raw event buffer
_feature_buffer: deque = deque(maxlen=200)  # computed feature rows
_running = False
_listener = None


# ─── CSV helpers ──────────────────────────────────────────────────────────────
def _ensure_log():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    if not os.path.exists(LOG_PATH):
        with open(LOG_PATH, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "event_type", "key_name",
                "hold_duration_ms", "inter_key_delay_ms"
            ])

    os.makedirs(os.path.dirname(FEATURE_LOG_PATH), exist_ok=True)
    if not os.path.exists(FEATURE_LOG_PATH):
        with open(FEATURE_LOG_PATH, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "typing_speed_kps", "avg_hold_ms",
                "avg_inter_key_ms", "burst_score", "backspace_ratio",
                "enter_ratio", "special_key_ratio", "repeat_key_ratio",
                "window_size"
            ])


def _append_event(row: list):
    with open(LOG_PATH, "a", newline="") as f:
        csv.writer(f).writerow(row)


def _append_feature(row: list):
    with open(FEATURE_LOG_PATH, "a", newline="") as f:
        csv.writer(f).writerow(row)


# ─── Key name normaliser ───────────────────────────────────────────────────────
def _key_name(key) -> str:
    try:
        return key.char if key.char else str(key)
    except AttributeError:
        return str(key)


def _is_special(key) -> bool:
    """Return True if key is a special / control key."""
    return isinstance(key, keyboard.Key)


def _is_backspace(key) -> bool:
    return key == keyboard.Key.backspace


def _is_enter(key) -> bool:
    return key in (keyboard.Key.enter, keyboard.Key.return_)


# ─── Feature computation ──────────────────────────────────────────────────────
def compute_features(events: list) -> dict:
    """
    Given a list of raw event dicts, compute behavioural feature vector.
    Each event has: timestamp, event_type, key_name, hold_duration_ms, inter_key_delay_ms
    """
    if len(events) < 2:
        return {}

    holds = [e["hold_duration_ms"] for e in events if e["hold_duration_ms"] is not None and e["hold_duration_ms"] > 0]
    delays = [e["inter_key_delay_ms"] for e in events if e["inter_key_delay_ms"] is not None and e["inter_key_delay_ms"] > 0]
    keys = [e["key_name"] for e in events]
    n = len(events)

    # Typing speed: keys per second over window duration
    window_duration = events[-1]["timestamp"] - events[0]["timestamp"]
    typing_speed = n / window_duration if window_duration > 0 else 0.0

    avg_hold = sum(holds) / len(holds) if holds else 0.0
    avg_delay = sum(delays) / len(delays) if delays else 0.0

    # Burst score: ratio of delays < 80ms (very fast consecutive presses)
    burst_count = sum(1 for d in delays if d < 80)
    burst_score = burst_count / len(delays) if delays else 0.0

    # Backspace, enter, special key ratios
    backspace_ratio = sum(1 for k in keys if "backspace" in k.lower()) / n
    enter_ratio = sum(1 for k in keys if "enter" in k.lower() or "return" in k.lower()) / n
    special_ratio = sum(1 for k in keys if k.startswith("Key.")) / n

    # Repeat key ratio: proportion of consecutive same-key presses
    repeats = sum(1 for i in range(1, len(keys)) if keys[i] == keys[i - 1])
    repeat_ratio = repeats / (n - 1) if n > 1 else 0.0

    return {
        "timestamp": datetime.now().isoformat(),
        "typing_speed_kps": round(typing_speed, 4),
        "avg_hold_ms": round(avg_hold, 2),
        "avg_inter_key_ms": round(avg_delay, 2),
        "burst_score": round(burst_score, 4),
        "backspace_ratio": round(backspace_ratio, 4),
        "enter_ratio": round(enter_ratio, 4),
        "special_key_ratio": round(special_ratio, 4),
        "repeat_key_ratio": round(repeat_ratio, 4),
        "window_size": n,
    }


# ─── Listener callbacks ───────────────────────────────────────────────────────
def _on_press(key):
    ts = time.time()
    name = _key_name(key)
    with _lock:
        _press_times[name] = ts
        # Calculate inter-key delay from last event
        last_ts = _events[-1]["timestamp"] if _events else None
        delay = round((ts - last_ts) * 1000, 2) if last_ts else None

        event = {
            "timestamp": ts,
            "event_type": "press",
            "key_name": name,
            "hold_duration_ms": None,
            "inter_key_delay_ms": delay,
        }
        _events.append(event)
    _append_event([
        datetime.fromtimestamp(ts).isoformat(), "press", name, "", delay or ""
    ])


def _on_release(key):
    ts = time.time()
    name = _key_name(key)
    with _lock:
        press_ts = _press_times.pop(name, None)
        hold = round((ts - press_ts) * 1000, 2) if press_ts else None

        event = {
            "timestamp": ts,
            "event_type": "release",
            "key_name": name,
            "hold_duration_ms": hold,
            "inter_key_delay_ms": None,
        }
        _events.append(event)

        # Update hold_duration in the most recent press event for same key
        for e in reversed(list(_events)):
            if e["event_type"] == "press" and e["key_name"] == name and e["hold_duration_ms"] is None:
                e["hold_duration_ms"] = hold
                break

    _append_event([
        datetime.fromtimestamp(ts).isoformat(), "release", name, hold or "", ""
    ])


# ─── Background feature-flush thread ─────────────────────────────────────────
def _feature_flush_loop():
    while _running:
        time.sleep(FLUSH_INTERVAL)
        with _lock:
            events_snapshot = [e for e in list(_events) if e["event_type"] == "press"]

        if len(events_snapshot) >= 5:
            feats = compute_features(events_snapshot[-WINDOW_SIZE:])
            if feats:
                _feature_buffer.append(feats)
                _append_feature(list(feats.values()))


# ─── Public API ───────────────────────────────────────────────────────────────
def start():
    """Start keyboard monitoring in a non-blocking background thread."""
    global _running, _listener
    _ensure_log()
    _running = True

    _listener = keyboard.Listener(on_press=_on_press, on_release=_on_release)
    _listener.start()

    flush_thread = threading.Thread(target=_feature_flush_loop, daemon=True)
    flush_thread.start()
    print("[KeyboardMonitor] Started.")


def stop():
    """Stop the keyboard listener."""
    global _running, _listener
    _running = False
    if _listener:
        _listener.stop()
    print("[KeyboardMonitor] Stopped.")


def get_latest_features() -> dict:
    """Return the most recently computed feature vector."""
    with _lock:
        if _feature_buffer:
            return dict(_feature_buffer[-1])
    return {}


def get_event_count() -> int:
    """Return total press events collected."""
    with _lock:
        return sum(1 for e in _events if e["event_type"] == "press")


if __name__ == "__main__":
    start()
    print("Monitoring keyboard. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(10)
            print("Latest features:", get_latest_features())
    except KeyboardInterrupt:
        stop()
