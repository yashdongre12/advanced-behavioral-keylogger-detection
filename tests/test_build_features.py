"""
tests/test_build_features.py
-----------------------------
Unit tests for the feature engineering pipeline.
Tests the live feature builder and sequence builder without requiring
CSV logs on disk.
"""

import sys, os
import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.feature_engineering.build_features import (
    build_live_features,
    build_sequences,
    get_feature_columns,
    SEQ_LEN,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────
def sample_kb_feats():
    return {
        "typing_speed_kps": 3.5,
        "avg_hold_ms": 85.0,
        "avg_inter_key_ms": 180.0,
        "burst_score": 0.12,
        "backspace_ratio": 0.05,
        "enter_ratio": 0.03,
        "special_key_ratio": 0.08,
        "repeat_key_ratio": 0.04,
    }


def sample_sys_metrics():
    return {
        "cpu_total_percent": 22.5,
        "mem_percent": 54.0,
        "disk_read_mb_s": 0.5,
        "disk_write_mb_s": 0.2,
        "active_process_count": 180,
    }


def sample_proc_snapshot():
    return [
        {"name": "chrome.exe",  "cpu_percent": 5.0,  "mem_percent": 2.0, "suspicion_score": 0.0, "is_background": False},
        {"name": "unknown.exe", "cpu_percent": 12.0, "mem_percent": 0.5, "suspicion_score": 0.35,"is_background": True},
        {"name": "svchost.exe", "cpu_percent": 0.2,  "mem_percent": 0.1, "suspicion_score": 0.0, "is_background": True},
    ]


# ── Tests: build_live_features ─────────────────────────────────────────────────
class TestBuildLiveFeatures:

    def test_returns_ndarray(self):
        X = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        assert isinstance(X, np.ndarray)

    def test_shape_is_1_x_n_features(self):
        X    = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        cols = get_feature_columns()
        assert X.shape == (1, len(cols))

    def test_dtype_is_float32(self):
        X = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        assert X.dtype == np.float32

    def test_empty_proc_snapshot_handled(self):
        X = build_live_features(sample_kb_feats(), sample_sys_metrics(), [])
        assert X.shape[0] == 1
        assert not np.any(np.isnan(X))

    def test_empty_kb_feats_handled(self):
        X = build_live_features({}, sample_sys_metrics(), sample_proc_snapshot())
        assert X.shape[0] == 1

    def test_no_nan_or_inf_in_output(self):
        X = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        assert not np.any(np.isnan(X))
        assert not np.any(np.isinf(X))

    def test_suspicious_proc_count_nonzero(self):
        # sample_proc_snapshot has one suspicious process (score=0.35 > 0.3)
        X    = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        cols = get_feature_columns()
        idx  = cols.index("suspicious_proc_count")
        assert X[0, idx] >= 1.0

    def test_cpu_field_maps_correctly(self):
        X    = build_live_features(sample_kb_feats(), sample_sys_metrics(), sample_proc_snapshot())
        cols = get_feature_columns()
        idx  = cols.index("cpu_total_percent")
        assert X[0, idx] == pytest.approx(22.5, abs=0.1)


# ── Tests: build_sequences ─────────────────────────────────────────────────────
class TestBuildSequences:

    def _random_scaled(self, n_rows: int, n_features: int = 14) -> np.ndarray:
        rng = np.random.default_rng(42)
        return rng.random((n_rows, n_features), dtype=np.float32)

    def test_returns_ndarray(self):
        X   = self._random_scaled(50)
        seq = build_sequences(X, seq_len=20)
        assert isinstance(seq, np.ndarray)

    def test_output_shape_correct(self):
        n_rows, n_feats, seq_len = 50, 14, 20
        X   = self._random_scaled(n_rows, n_feats)
        seq = build_sequences(X, seq_len=seq_len)
        expected_samples = n_rows - seq_len + 1
        assert seq.shape == (expected_samples, seq_len, n_feats)

    def test_insufficient_data_returns_empty(self):
        X   = self._random_scaled(5)   # less than SEQ_LEN
        seq = build_sequences(X, seq_len=SEQ_LEN)
        assert seq.size == 0

    def test_exactly_seq_len_rows_returns_one_sequence(self):
        X   = self._random_scaled(SEQ_LEN)
        seq = build_sequences(X, seq_len=SEQ_LEN)
        assert seq.shape[0] == 1

    def test_sequences_are_overlapping(self):
        n_rows, seq_len = 30, 10
        X    = self._random_scaled(n_rows, n_features=5)
        seq  = build_sequences(X, seq_len=seq_len)
        # First element of seq[1] should equal second element of seq[0]
        assert np.allclose(seq[1, 0, :], seq[0, 1, :])

    def test_dtype_float32(self):
        X   = self._random_scaled(40)
        seq = build_sequences(X, seq_len=20)
        assert seq.dtype == np.float32
