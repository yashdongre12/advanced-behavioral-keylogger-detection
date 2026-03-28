"""
collect_data.py
---------------
Convenience script that starts ALL three real-time monitors in the same
process. Run this for 5–10 minutes of normal computer use to build the
baseline telemetry dataset before training the ML models.

Usage:
    python collect_data.py [--duration 600]

    --duration  INT   seconds to collect (default: 600 = 10 minutes)
                      Use 0 to run until Ctrl+C.
"""

import argparse
import signal
import sys
import time
import os

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

from src.data_collection.keyboard_monitor import (
    start as kb_start, stop as kb_stop, get_latest_features, get_event_count,
)
from src.data_collection.process_monitor import (
    start as proc_start, stop as proc_stop, get_active_count, get_top_suspicious,
)
from src.data_collection.system_monitor import (
    start as sys_start, stop as sys_stop, get_latest,
)


def parse_args():
    p = argparse.ArgumentParser(description="Collect behavioral telemetry.")
    p.add_argument("--duration", type=int, default=600,
                   help="Collection duration in seconds (0 = infinite)")
    return p.parse_args()


def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║  SENTINEL — Telemetry Collection Mode                        ║
║  Collecting: keyboard · processes · system                   ║
╚══════════════════════════════════════════════════════════════╝
  - Type normally to generate keyboard behavioral data.
  - All telemetry is saved to the logs/ directory.
  - Press Ctrl+C to stop collection early.
""")


def print_status(elapsed: float, duration: int):
    sys_m  = get_latest()
    kb_f   = get_latest_features()
    procs  = get_active_count()
    top    = get_top_suspicious(1)
    sus    = top[0] if top else {}

    remaining = f"{max(0, duration - elapsed):.0f}s" if duration > 0 else "∞"

    print(f"\r  [{elapsed:6.0f}s / {remaining:>6}]  "
          f"CPU {sys_m.get('cpu_total_percent',0):5.1f}%  "
          f"MEM {sys_m.get('mem_percent',0):5.1f}%  "
          f"KB-events {get_event_count():5d}  "
          f"Procs {procs:4d}  "
          f"TopSus [{sus.get('name','—'):20s} {sus.get('suspicion_score',0):.2f}]",
          end="", flush=True)


def main():
    args = parse_args()
    print_banner()

    # Start all monitors
    kb_start()
    proc_start()
    sys_start()

    start_time = time.time()
    stop_flag  = [False]

    def on_signal(sig, frame):
        print("\n\n[Collector] Signal received — stopping...")
        stop_flag[0] = True

    signal.signal(signal.SIGINT,  on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    print("  Monitors running. Status updates every 5 seconds:\n")

    try:
        while not stop_flag[0]:
            elapsed = time.time() - start_time
            print_status(elapsed, args.duration)

            if args.duration > 0 and elapsed >= args.duration:
                print(f"\n\n[Collector] Duration reached ({args.duration}s). Stopping.")
                break

            time.sleep(5)
    finally:
        kb_stop()
        proc_stop()
        sys_stop()

        elapsed = time.time() - start_time
        print(f"\n\n[Collector] Collection finished after {elapsed:.0f}s.")
        print(f"  Keyboard events logged : {get_event_count()}")
        print(f"  Active processes seen  : {get_active_count()}")
        print(f"\n  Log files saved to: logs/")
        print("  Next steps:")
        print("    python -m src.feature_engineering.build_features")
        print("    python -m src.models.train_isolation_forest")
        print("    python -m src.models.train_lstm")


if __name__ == "__main__":
    main()
