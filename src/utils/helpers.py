"""
helpers.py
----------
Utility helpers: CSV reading, pagination, safe JSON serialisation,
threat colour mapping, and log path resolution.
"""

import os
import json
import math
from datetime import datetime
from src.utils.db import db

BASE = os.path.join(os.path.dirname(__file__), "../../")
LOGS = os.path.join(BASE, "logs")


# ─── Safe JSON serialisation ──────────────────────────────────────────────────
def safe_json(obj):
    """Convert numpy/float/int types to native Python for JSON serialisation."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    if hasattr(obj, "item"):   # numpy scalar
        return obj.item()
    if hasattr(obj, "tolist"):  # numpy array
        return obj.tolist()
    return obj


def jsonify_safe(data):
    return json.loads(json.dumps(data, default=safe_json))


# ─── Threat colour / badge mapping ───────────────────────────────────────────
THREAT_COLOURS = {
    "Normal":   "#22c55e",   # green
    "Low":      "#84cc16",   # lime
    "Medium":   "#f59e0b",   # amber
    "High":     "#ef4444",   # red
    "Critical": "#7c3aed",   # purple
}

THREAT_BADGE_CLASS = {
    "Normal":   "badge-normal",
    "Low":      "badge-low",
    "Medium":   "badge-medium",
    "High":     "badge-high",
    "Critical": "badge-critical",
}


def threat_colour(level: str) -> str:
    return THREAT_COLOURS.get(level, "#6b7280")


# ─── MongoDB Pagination & Helpers ──────────────────────────────────────────────
def get_recent_logs(collection_name: str, n: int = 100) -> list[dict]:
    """Read last N rows from a MongoDB collection, chronologically ordered."""
    if db is None: return []
    try:
        cursor = db[collection_name].find({}, {"_id": 0}).sort("timestamp", -1).limit(n)
        docs = list(cursor)
        docs.reverse()
        return docs
    except Exception:
        return []


def get_all_logs(collection_name: str) -> list[dict]:
    if db is None: return []
    try:
        return list(db[collection_name].find({}, {"_id": 0}).sort("timestamp", 1))
    except Exception:
        return []


def get_paginated_logs(collection_name: str, page: int = 1, per_page: int = 50, filter_query: dict = None) -> dict:
    if db is None:
        return {"total": 0, "page": page, "per_page": per_page, "pages": 1, "data": []}
        
    q = filter_query or {}
    try:
        total = db[collection_name].count_documents(q)
        skip = (page - 1) * per_page
        cursor = db[collection_name].find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(per_page)
        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if per_page else 1,
            "data": list(cursor),
        }
    except Exception:
        return {"total": 0, "page": page, "per_page": per_page, "pages": 1, "data": []}

# ─── Log path resolver ────────────────────────────────────────────────────────
def log_path(filename: str) -> str:
    return os.path.join(LOGS, filename)


# ─── Timestamp helpers ────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now().isoformat()


def format_uptime(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"
