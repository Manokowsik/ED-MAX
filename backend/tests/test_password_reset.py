"""
Forgot Password & Password Reset Tests:
- Generic response for existing & non-existing emails (enumeration protection)
- Reset token validation
- Valid password reset flow
- Login with new password / old password rejection
- Expired token rejection
- Reused token rejection
- Invalid token rejection
"""

from datetime import datetime, timedelta, timezone
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import AuthService
from tests.conftest import db_execute, password_hash


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _unique_email():
    return f"reset_test_{uuid.uuid4().hex[:8]}@example.com"


class TestPasswordReset:

    def test_generic_response_for_all_emails(self, client, admin_user):
        # Known email
        res1 = client.post("/auth/forgot-password", json={"email": admin_user["email"]})
        assert res1.status_code == 200
        assert "reset instructions have been sent" in res1.json()["message"].lower()

        # Unknown email
        unknown_email = _unique_email()
        res2 = client.post("/auth/forgot-password", json={"email": unknown_email})
        assert res2.status_code == 200
        assert res2.json()["message"] == res1.json()["message"]

    def test_valid_password_reset_flow(self, client):
        email = _unique_email()
        old_pwd = "OldPassword@123"
        new_pwd = "BrandNewPassword@456"

        client.post("/auth/admin-signup", json={
            "name": "Reset Flow Admin",
            "email": email,
            "password": old_pwd,
            "confirm_password": old_pwd
        })

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]
        db_execute("UPDATE users SET is_verified = TRUE WHERE id = %s", (user_id,))

        # Request reset
        forgot_res = client.post("/auth/forgot-password", json={"email": email})
        assert forgot_res.status_code == 200

        # Retrieve reset token hash and override with test token
        raw_token = AuthService.generate_secure_token()
        token_hash = AuthService.hash_token(raw_token)
        db_execute(
            "UPDATE password_resets SET token_hash = %s WHERE user_id = %s AND is_used = FALSE",
            (token_hash, user_id)
        )

        # Validate token
        val_res = client.get(f"/auth/validate-reset-token?token={raw_token}")
        assert val_res.status_code == 200
        assert val_res.json()["email"] == email

        # Reset password
        reset_res = client.post("/auth/reset-password", json={
            "token": raw_token,
            "password": new_pwd,
            "confirm_password": new_pwd
        })
        assert reset_res.status_code == 200

        # Login with old password fails
        login_old = client.post("/auth/login", json={"email": email, "password": old_pwd})
        assert login_old.status_code == 401

        # Login with new password succeeds
        login_new = client.post("/auth/login", json={"email": email, "password": new_pwd})
        assert login_new.status_code == 200

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_expired_reset_token_rejected(self, client, admin_user):
        raw_token = "expired_reset_token"
        token_hash = AuthService.hash_token(raw_token)
        past_time = datetime.now(timezone.utc) - timedelta(minutes=40)

        db_execute(
            """
            INSERT INTO password_resets (user_id, token_hash, expires_at, is_used)
            VALUES (%s, %s, %s, FALSE)
            """,
            (admin_user["id"], token_hash, past_time)
        )

        res = client.post("/auth/reset-password", json={
            "token": raw_token,
            "password": "NewPassword@123",
            "confirm_password": "NewPassword@123"
        })
        assert res.status_code == 400
        assert "expired" in res.json()["detail"].lower()

        db_execute("DELETE FROM password_resets WHERE token_hash = %s", (token_hash,))

    def test_reused_reset_token_rejected(self, client, admin_user):
        raw_token = "reused_reset_token"
        token_hash = AuthService.hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        db_execute(
            """
            INSERT INTO password_resets (user_id, token_hash, expires_at, is_used)
            VALUES (%s, %s, %s, TRUE)
            """,
            (admin_user["id"], token_hash, expires_at)
        )

        res = client.post("/auth/reset-password", json={
            "token": raw_token,
            "password": "NewPassword@123",
            "confirm_password": "NewPassword@123"
        })
        assert res.status_code == 400
        assert "used" in res.json()["detail"].lower()

        db_execute("DELETE FROM password_resets WHERE token_hash = %s", (token_hash,))
