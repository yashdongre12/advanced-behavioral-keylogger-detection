"""
tests/test_realtime_detector.py
--------------------------------
Unit tests for the hybrid detection engine's scoring and threat
classification functions. No ML models are loaded.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Patch model loading so tests run without trained models
import unittest.mock as mock


class TestThreatScoring:
    """Tests for _combine_scores and _heuristic_score."""

    def setup_method(self):
        """Import after patching to avoid model-load side effects."""
        import importlib
        # Import the module symbols directly (no model loading triggered)
        from src.detection import realtime_detector as rd
        self.rd = rd

    def _sys(self, cpu=20.0, mem=50.0):
        return {"cpu_total_percent": cpu, "mem_percent": mem}

    def _procs(self, suspicion=0.0, n=5):
        return [{"name": f"proc_{i}", "cpu_percent": 1.0,
                 "mem_percent": 0.5, "suspicion_score": suspicion,
                 "is_background": False} for i in range(n)]

    def _kb(self, burst=0.0, repeat=0.0):
        return {"burst_score": burst, "repeat_key_ratio": repeat}

    # ── Threat level classification ─────────────────────────────────────────
    def test_zero_scores_give_normal_level(self):
        score, level, _ = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.0, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert level == "Normal"
        assert score < 20

    def test_high_if_anomaly_increases_score(self):
        score_clean, _, _ = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.0, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        score_anomaly, _, _ = self.rd._combine_scores(
            if_score=-0.45, if_anomaly=1,
            lstm_prob=0.0, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert score_anomaly > score_clean

    def test_high_lstm_prob_increases_score(self):
        score_low, _, _ = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.05, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        score_high, _, _ = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.9, lstm_anomaly=1,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert score_high > score_low

    def test_critical_level_when_all_flags_set(self):
        _, level, _ = self.rd._combine_scores(
            if_score=-0.5, if_anomaly=1,
            lstm_prob=0.95, lstm_anomaly=1,
            sys_metrics=self._sys(cpu=90, mem=95),
            proc_snapshot=self._procs(suspicion=0.9),
            kb_feats=self._kb(burst=0.8, repeat=0.7)
        )
        assert level in ("High", "Critical")

    def test_score_bounded_0_to_100(self):
        for if_score, if_anom, lstm_prob, lstm_anom in [
            (0.1, 0, 0.0, 0),
            (-0.5, 1, 0.95, 1),
            (-0.2, 1, 0.4, 0),
        ]:
            score, _, _ = self.rd._combine_scores(
                if_score=if_score, if_anomaly=if_anom,
                lstm_prob=lstm_prob, lstm_anomaly=lstm_anom,
                sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
            )
            assert 0 <= score <= 100, f"Score {score} out of range for inputs {if_score},{lstm_prob}"

    # ── Heuristic scoring ───────────────────────────────────────────────────
    def test_high_cpu_triggers_heuristic(self):
        low  = self.rd._heuristic_score(self._sys(cpu=20),  self._procs(), self._kb())
        high = self.rd._heuristic_score(self._sys(cpu=90),  self._procs(), self._kb())
        assert high > low

    def test_suspicious_process_triggers_heuristic(self):
        clean = self.rd._heuristic_score(self._sys(), self._procs(suspicion=0.0), self._kb())
        sus   = self.rd._heuristic_score(self._sys(), self._procs(suspicion=0.8), self._kb())
        assert sus > clean

    def test_burst_typing_triggers_heuristic(self):
        normal = self.rd._heuristic_score(self._sys(), self._procs(), self._kb(burst=0.0))
        burst  = self.rd._heuristic_score(self._sys(), self._procs(), self._kb(burst=0.8))
        assert burst > normal

    def test_heuristic_clamped_to_one(self):
        score = self.rd._heuristic_score(
            self._sys(cpu=95, mem=98),
            self._procs(suspicion=1.0),
            self._kb(burst=0.9, repeat=0.9)
        )
        assert score <= 1.0

    # ── Reason generation ───────────────────────────────────────────────────
    def test_reason_string_not_empty(self):
        _, _, reason = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.0, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert isinstance(reason, str) and len(reason) > 0

    def test_reason_mentions_anomaly_when_if_flags(self):
        _, _, reason = self.rd._combine_scores(
            if_score=-0.4, if_anomaly=1,
            lstm_prob=0.0, lstm_anomaly=0,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert "Isolation Forest" in reason or "anomaly" in reason.lower()

    def test_reason_mentions_lstm_when_lstm_flags(self):
        _, _, reason = self.rd._combine_scores(
            if_score=0.05, if_anomaly=0,
            lstm_prob=0.88, lstm_anomaly=1,
            sys_metrics=self._sys(), proc_snapshot=self._procs(), kb_feats=self._kb()
        )
        assert "LSTM" in reason
