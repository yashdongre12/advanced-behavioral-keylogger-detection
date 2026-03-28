"""
tests/test_auth.py
-------------------
Unit tests for the auth module: token issuance, verification, and expiry.
"""

import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api.auth import (
    _issue_token, verify_token, _active_tokens,
    _hash_password,
)


class TestTokenLifecycle:

    def test_issue_token_returns_string(self):
        token, expiry = _issue_token()
        assert isinstance(token, str) and len(token) > 20

    def test_issued_token_is_valid(self):
        token, _ = _issue_token()
        assert verify_token(token) is True

    def test_unknown_token_is_invalid(self):
        assert verify_token("not_a_real_token_xyz") is False

    def test_expired_token_is_rejected(self):
        token, _ = _issue_token()
        # Manually set expiry to the past
        _active_tokens[token] = time.time() - 10
        assert verify_token(token) is False
        # Should also be cleaned up
        assert token not in _active_tokens

    def test_multiple_tokens_are_independent(self):
        t1, _ = _issue_token()
        t2, _ = _issue_token()
        assert t1 != t2
        assert verify_token(t1)
        assert verify_token(t2)


class TestPasswordHashing:

    def test_same_password_same_hash(self):
        assert _hash_password("abc123") == _hash_password("abc123")

    def test_different_passwords_different_hashes(self):
        assert _hash_password("abc123") != _hash_password("xyz789")

    def test_hash_is_deterministic(self):
        h1 = _hash_password("sentinel2024")
        h2 = _hash_password("sentinel2024")
        assert h1 == h2

    def test_hash_non_empty(self):
        h = _hash_password("test")
        assert isinstance(h, str) and len(h) > 0
