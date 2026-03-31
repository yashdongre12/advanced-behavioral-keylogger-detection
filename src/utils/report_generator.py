"""
report_generator.py
-------------------
Generates structured threat summary reports from accumulated telemetry.
Produces:
  - JSON summary  (machine-readable)
  - CSV report    (spreadsheet-friendly)

Used by the /reports/summary and /reports/download API endpoints.
"""

import os
import sys
import csv
import json
import math
from datetime import datetime

BASE = os.path.join(os.path.dirname(__file__), "../../")
sys.path.insert(0, BASE)

from src.utils.helpers import get_all_logs, now_iso

REPORTS_DIR = os.path.join(BASE, "logs/reports")


def _safe_float(v, default=0.0):
    try:
        f = float(v)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return default


def _pct_level(rows: list, level: str) -> int:
    return sum(1 for r in rows if r.get("threat_level") == level)


# ─── Build report data ────────────────────────────────────────────────────────
def build_summary_report() -> dict:
    """
    Read all log CSVs and aggregate into a single summary dict.
    """
    predictions = get_all_logs("predictions")
    alerts      = get_all_logs("alerts")
    sys_logs    = get_all_logs("system_logs")
    kb_feats    = get_all_logs("keyboard_features")
    proc_logs   = get_all_logs("process_logs")

    # ── Threat level distribution ──────────────────────────────────────────
    levels = ["Normal", "Low", "Medium", "High", "Critical"]
    threat_dist = {lv: _pct_level(predictions, lv) for lv in levels}
    total_preds = len(predictions)

    # ── Score statistics ────────────────────────────────────────────────────
    scores = [_safe_float(r.get("final_threat_score")) for r in predictions]
    if_scores = [_safe_float(r.get("if_score")) for r in predictions]
    lstm_probs = [_safe_float(r.get("lstm_anomaly_prob")) for r in predictions]

    def stats(vals):
        if not vals:
            return {"min": 0, "max": 0, "mean": 0, "std": 0}
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals)
        return {
            "min":  round(min(vals), 4),
            "max":  round(max(vals), 4),
            "mean": round(mean, 4),
            "std":  round(math.sqrt(variance), 4),
        }

    # ── System resource statistics ──────────────────────────────────────────
    cpu_vals = [_safe_float(r.get("cpu_total_percent")) for r in sys_logs]
    mem_vals = [_safe_float(r.get("mem_percent")) for r in sys_logs]

    # ── Keyboard statistics ──────────────────────────────────────────────────
    speed_vals = [_safe_float(r.get("typing_speed_kps")) for r in kb_feats]
    burst_vals = [_safe_float(r.get("burst_score")) for r in kb_feats]

    # ── Top suspicious processes ─────────────────────────────────────────────
    sus_scores = {}
    for row in proc_logs:
        name  = row.get("name", "unknown")
        score = _safe_float(row.get("suspicion_score"))
        if score > sus_scores.get(name, 0):
            sus_scores[name] = score
    top_sus = sorted(sus_scores.items(), key=lambda x: x[1], reverse=True)[:10]

    # ── Alert breakdown ──────────────────────────────────────────────────────
    alert_by_level = {lv: _pct_level(alerts, lv) for lv in levels}
    alert_reasons  = {}
    for a in alerts:
        reason = (a.get("reason") or "").split(";")[0].strip()[:80]
        alert_reasons[reason] = alert_reasons.get(reason, 0) + 1
    top_reasons = sorted(alert_reasons.items(), key=lambda x: x[1], reverse=True)[:5]

    # ── Time window ──────────────────────────────────────────────────────────
    all_timestamps = (
        [r["timestamp"] for r in predictions if r.get("timestamp")] +
        [r["timestamp"] for r in sys_logs    if r.get("timestamp")]
    )
    first_ts = min(all_timestamps) if all_timestamps else None
    last_ts  = max(all_timestamps) if all_timestamps else None

    return {
        "generated_at": now_iso(),
        "time_window": {
            "first_record": first_ts,
            "last_record":  last_ts,
        },
        "overview": {
            "total_predictions":     total_preds,
            "total_alerts":          len(alerts),
            "total_system_samples":  len(sys_logs),
            "total_keyboard_windows":len(kb_feats),
            "total_processes_seen":  len(set(r.get("name","") for r in proc_logs)),
        },
        "threat_distribution": threat_dist,
        "threat_score_stats":      stats(scores),
        "if_score_stats":          stats(if_scores),
        "lstm_probability_stats":  stats(lstm_probs),
        "system_cpu_stats":        stats(cpu_vals),
        "system_memory_stats":     stats(mem_vals),
        "keyboard_speed_stats":    stats(speed_vals),
        "keyboard_burst_stats":    stats(burst_vals),
        "alerts_by_level":         alert_by_level,
        "top_alert_reasons":       [{"reason": r, "count": c} for r, c in top_reasons],
        "top_suspicious_processes":[{"name": n, "max_suspicion_score": s} for n, s in top_sus],
    }


def save_json_report(report: dict = None) -> str:
    """Save the summary report as a JSON file. Returns the file path."""
    if report is None:
        report = build_summary_report()
    os.makedirs(REPORTS_DIR, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(REPORTS_DIR, f"threat_report_{ts}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    return path


def save_csv_report(report: dict = None) -> str:
    """Save the summary report as a flat CSV file. Returns the file path."""
    if report is None:
        report = build_summary_report()
    os.makedirs(REPORTS_DIR, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(REPORTS_DIR, f"threat_report_{ts}.csv")

    rows = []

    def _add(section, key, value):
        rows.append({"section": section, "metric": key, "value": value})

    # Overview
    for k, v in report["overview"].items():
        _add("Overview", k, v)

    # Threat distribution
    for k, v in report["threat_distribution"].items():
        _add("Threat Distribution", k, v)

    # Stats sections
    for section_key in ["threat_score_stats", "if_score_stats",
                        "lstm_probability_stats", "system_cpu_stats",
                        "system_memory_stats"]:
        label = section_key.replace("_", " ").title()
        for k, v in report[section_key].items():
            _add(label, k, v)

    # Alert reasons
    for item in report["top_alert_reasons"]:
        _add("Top Alert Reasons", item["reason"][:60], item["count"])

    # Suspicious processes
    for item in report["top_suspicious_processes"]:
        _add("Top Suspicious Processes", item["name"], item["max_suspicion_score"])

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["section", "metric", "value"])
        writer.writeheader()
        writer.writerows(rows)

    return path


def list_reports() -> list[dict]:
    """Return metadata for all previously generated reports."""
    if not os.path.exists(REPORTS_DIR):
        return []
    files = []
    for fname in sorted(os.listdir(REPORTS_DIR), reverse=True):
        fpath = os.path.join(REPORTS_DIR, fname)
        files.append({
            "filename":   fname,
            "path":       fpath,
            "size_kb":    round(os.path.getsize(fpath) / 1024, 1),
            "created_at": datetime.fromtimestamp(
                os.path.getctime(fpath)
            ).isoformat(),
        })
    return files


if __name__ == "__main__":
    print("Generating report...")
    report = build_summary_report()
    jp = save_json_report(report)
    cp = save_csv_report(report)
    print(f"JSON: {jp}")
    print(f"CSV:  {cp}")
    print(json.dumps(report["overview"], indent=2))
