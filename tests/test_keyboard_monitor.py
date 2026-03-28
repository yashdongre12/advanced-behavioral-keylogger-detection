"""
tests/test_keyboard_monitor.py
-------------------------------
Unit tests for keyboard_monitor.compute_features().
No pynput listener is started — only pure feature computation is tested.
"""

import sys, os, time, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.data_collection.keyboard_monitor import compute_features


def make_events(n: int, inter_key_ms: float = 150, hold_ms: float = 80) -> list:
    """Build a synthetic list of press-event dicts at regular intervals."""
    events = []
    base_ts = time.time()
    for i in range(n):
        ts = base_ts + i * (inter_key_ms / 1000)
        events.append({
            "timestamp": ts,
            "event_type": "press",
            "key_name": f"key_{i % 26}",
            "hold_duration_ms": hold_ms,
            "inter_key_delay_ms": inter_key_ms if i > 0 else None,
        })
    return events


class TestComputeFeatures:

    def test_returns_empty_for_single_event(self):
        events = make_events(1)
        assert compute_features(events) == {}

    def test_returns_dict_with_expected_keys(self):
        events = make_events(20)
        feats  = compute_features(events)
        expected_keys = {
            "timestamp", "typing_speed_kps", "avg_hold_ms",
            "avg_inter_key_ms", "burst_score", "backspace_ratio",
            "enter_ratio", "special_key_ratio", "repeat_key_ratio", "window_size",
        }
        assert expected_keys.issubset(set(feats.keys()))

    def test_window_size_matches_input(self):
        events = make_events(15)
        feats  = compute_features(events)
        assert feats["window_size"] == 15

    def test_typing_speed_reasonable(self):
        # 20 events over ~3 seconds → ~6–7 kps
        events = make_events(20, inter_key_ms=150)
        feats  = compute_features(events)
        assert 0 < feats["typing_speed_kps"] < 50

    def test_burst_score_zero_for_slow_typing(self):
        # 500ms between keys → no bursts
        events = make_events(20, inter_key_ms=500)
        feats  = compute_features(events)
        assert feats["burst_score"] == pytest.approx(0.0)

    def test_burst_score_high_for_fast_typing(self):
        # 30ms between keys → all qualify as bursts (< 80ms)
        events = make_events(20, inter_key_ms=30)
        feats  = compute_features(events)
        assert feats["burst_score"] > 0.8

    def test_backspace_ratio_computed(self):
        events = make_events(10)
        # Override some keys to backspace
        events[2]["key_name"] = "Key.backspace"
        events[5]["key_name"] = "Key.backspace"
        feats = compute_features(events)
        assert feats["backspace_ratio"] == pytest.approx(2 / 10)

    def test_repeat_key_ratio_detected(self):
        # All same key → maximum repeat ratio
        events = [
            {
                "timestamp": time.time() + i * 0.1,
                "event_type": "press",
                "key_name": "a",
                "hold_duration_ms": 80,
                "inter_key_delay_ms": 100,
            }
            for i in range(10)
        ]
        feats = compute_features(events)
        assert feats["repeat_key_ratio"] == pytest.approx(1.0)

    def test_no_repeat_ratio_for_unique_keys(self):
        events = [
            {
                "timestamp": time.time() + i * 0.15,
                "event_type": "press",
                "key_name": chr(ord('a') + i),   # all unique
                "hold_duration_ms": 80,
                "inter_key_delay_ms": 150,
            }
            for i in range(10)
        ]
        feats = compute_features(events)
        assert feats["repeat_key_ratio"] == pytest.approx(0.0)

    def test_avg_hold_matches_input(self):
        hold_ms = 120.0
        events  = make_events(15, hold_ms=hold_ms)
        feats   = compute_features(events)
        assert abs(feats["avg_hold_ms"] - hold_ms) < 1.0
