"""
tests/test_process_monitor.py
------------------------------
Unit tests for the process monitor's suspicion scoring heuristic.
No actual psutil calls are made — we test the scoring function directly.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.data_collection.process_monitor import _suspicion_score


def make_proc(
    name="svchost.exe",
    exe="C:\\Windows\\System32\\svchost.exe",
    cpu_percent=0.5,
    is_background=False,
    num_threads=4,
) -> dict:
    return {
        "name": name,
        "exe": exe,
        "cpu_percent": cpu_percent,
        "is_background": is_background,
        "num_threads": num_threads,
    }


class TestSuspicionScore:

    def test_whitelisted_process_scores_low(self):
        proc  = make_proc(name="explorer.exe", is_background=False)
        score = _suspicion_score(proc)
        assert score < 0.3

    def test_suspicious_keyword_in_name_increases_score(self):
        proc  = make_proc(name="keylogger.exe")
        score = _suspicion_score(proc)
        assert score >= 0.4

    def test_suspicious_keyword_in_exe_path(self):
        proc  = make_proc(name="service.exe", exe="C:\\Users\\Admin\\spy_tool.exe")
        score = _suspicion_score(proc)
        assert score >= 0.4

    def test_background_unknown_process_higher_score(self):
        proc_fg = make_proc(name="unknown_app.exe", is_background=False)
        proc_bg = make_proc(name="unknown_app.exe", is_background=True)
        assert _suspicion_score(proc_bg) > _suspicion_score(proc_fg)

    def test_no_exe_path_adds_suspicion(self):
        proc_with = make_proc(exe="C:\\valid\\path.exe")
        proc_none = make_proc(exe=None)
        assert _suspicion_score(proc_none) > _suspicion_score(proc_with)

    def test_high_cpu_background_process_flagged(self):
        normal = make_proc(cpu_percent=2.0,  is_background=True)
        high   = make_proc(cpu_percent=40.0, is_background=True)
        assert _suspicion_score(high) > _suspicion_score(normal)

    def test_very_high_thread_count_flagged(self):
        normal = make_proc(num_threads=5,  name="unknown.exe")
        high   = make_proc(num_threads=80, name="unknown.exe")
        assert _suspicion_score(high) > _suspicion_score(normal)

    def test_score_clamped_to_one(self):
        # Worst-case process: suspicious keyword + no exe + bg + high cpu + high threads
        proc  = make_proc(
            name="keylog_spy.exe",
            exe=None,
            cpu_percent=50,
            is_background=True,
            num_threads=100,
        )
        score = _suspicion_score(proc)
        assert score <= 1.0

    def test_score_non_negative(self):
        proc  = make_proc()
        score = _suspicion_score(proc)
        assert score >= 0.0

    def test_inject_keyword_flagged(self):
        proc  = make_proc(name="inject_helper.exe")
        score = _suspicion_score(proc)
        assert score >= 0.4

    def test_hook_keyword_in_exe(self):
        proc  = make_proc(name="helper.exe", exe="C:\\Temp\\keyboard_hook_64.dll")
        score = _suspicion_score(proc)
        assert score >= 0.4
