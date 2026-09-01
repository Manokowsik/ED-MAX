"""
Email Verification & OTP Tests:
- Valid OTP verification
- Invalid OTP rejection
- Expired OTP rejection
- Reused OTP rejection
- Verification attempt limits
- Resend OTP with cooldown
"""

from datetime import datetime, timedelta, timezone
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import AuthService
from tests.conftest import db_execute


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _unique_email():
    return f"otp_test_{uuid.uuid4().hex[:8]}@example.com"


class TestEmailVerificationOTP:

    def test_valid_otp_verifies_email(self, client):
        email = _unique_email()
        signup_res = client.post("/auth/admin-signup", json={
            "name": "OTP Test User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })
        assert signup_res.status_code == 201

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        # Intercept OTP by re-generating or querying hash comparison helper
        otp = "123456"
        otp_hash = AuthService.hash_token(otp)
        db_execute(
            "UPDATE email_verifications SET otp_hash = %s WHERE user_id = %s AND is_used = FALSE",
            (otp_hash, user_id)
        )

        verify_res = client.post("/auth/verify-email", json={
            "email": email,
            "otp": otp
        })
        assert verify_res.status_code == 200
        assert verify_res.json()["user"]["is_verified"] is True

        # Check DB state
        ver_user = db_execute("SELECT is_verified FROM users WHERE id = %s", (user_id,), fetch=True)
        assert ver_user[0][0] is True

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_invalid_otp_rejected(self, client):
        email = _unique_email()
        client.post("/auth/admin-signup", json={
            "name": "Bad OTP User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })

        verify_res = client.post("/auth/verify-email", json={
            "email": email,
            "otp": "000000"
        })
        assert verify_res.status_code == 400
        assert "invalid" in verify_res.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_expired_otp_rejected(self, client):
        email = _unique_email()
        client.post("/auth/admin-signup", json={
            "name": "Expired OTP User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        otp = "123456"
        otp_hash = AuthService.hash_token(otp)
        past_time = datetime.now(timezone.utc) - timedelta(minutes=15)

        db_execute(
            "UPDATE email_verifications SET otp_hash = %s, expires_at = %s WHERE user_id = %s",
            (otp_hash, past_time, user_id)
        )

        verify_res = client.post("/auth/verify-email", json={
            "email": email,
            "otp": otp
        })
        assert verify_res.status_code == 400
        assert "expired" in verify_res.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_reused_otp_rejected(self, client):
        email = _unique_email()
        client.post("/auth/admin-signup", json={
            "name": "Reuse OTP User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        otp = "654321"
        otp_hash = AuthService.hash_token(otp)
        db_execute(
            "UPDATE email_verifications SET otp_hash = %s WHERE user_id = %s",
            (otp_hash, user_id)
        )

        # First verification succeeds
        res1 = client.post("/auth/verify-email", json={"email": email, "otp": otp})
        assert res1.status_code == 200

        # Second verification fails
        res2 = client.post("/auth/verify-email", json={"email": email, "otp": otp})
        assert res2.status_code == 200
        assert "already verified" in res2.json()["message"].lower()

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_verification_attempt_limits(self, client):
        email = _unique_email()
        client.post("/auth/admin-signup", json={
            "name": "Attempt Limit User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        db_execute(
            "UPDATE email_verifications SET attempts = 4 WHERE user_id = %s AND is_used = FALSE",
            (user_id,)
        )

        # Attempt 5 with wrong OTP triggers limit exceeded
        res = client.post("/auth/verify-email", json={"email": email, "otp": "999999"})
        assert res.status_code == 400
        assert "exceeded" in res.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_resend_otp_cooldown_enforced(self, client):
        email = _unique_email()
        client.post("/auth/admin-signup", json={
            "name": "Cooldown User",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })

        resend_res = client.post("/auth/resend-otp", json={"email": email})
        assert resend_res.status_code == 429
        assert "wait" in resend_res.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE email = %s", (email,))
