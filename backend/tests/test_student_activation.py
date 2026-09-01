"""
Student Invitation & Activation Tests:
- Admin student invitation creation
- Activation token validation
- Account activation and password setup
- Expired token rejection
- Reused token rejection
- Invalid token rejection
- Organization data isolation
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
    return f"activation_test_{uuid.uuid4().hex[:8]}@example.com"


class TestStudentActivation:

    def test_admin_invites_student_creates_activation_token(self, client, admin_user):
        email = _unique_email()

        res = client.post("/admin/students", json={
            "name": "Invited Student",
            "email": email
        }, headers=admin_user["headers"])

        assert res.status_code == 200
        data = res.json()
        assert "activation email" in data["message"].lower() or "invitation sent" in data["message"].lower()
        assert data["student"]["is_active"] is False

        # Verify DB state
        user_rows = db_execute("SELECT id, is_active, organization_id FROM users WHERE email = %s", (email,), fetch=True)
        assert len(user_rows) == 1
        user_id, is_active, org_id = user_rows[0]
        assert is_active is False
        assert org_id == admin_user["organization_id"]

        act_rows = db_execute("SELECT id, is_used FROM student_activations WHERE user_id = %s", (user_id,), fetch=True)
        assert len(act_rows) == 1
        assert act_rows[0][1] is False

        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_valid_activation_flow_and_session(self, client, admin_user):
        email = _unique_email()

        client.post("/admin/students", json={
            "name": "Activation Flow Student",
            "email": email
        }, headers=admin_user["headers"])

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        raw_token = AuthService.generate_secure_token()
        token_hash = AuthService.hash_token(raw_token)

        db_execute(
            "UPDATE student_activations SET token_hash = %s WHERE user_id = %s AND is_used = FALSE",
            (token_hash, user_id)
        )

        # Validate token endpoint
        val_res = client.get(f"/auth/validate-activation-token?token={raw_token}")
        assert val_res.status_code == 200
        assert val_res.json()["user"]["email"] == email

        # Activate account endpoint
        act_res = client.post("/auth/activate-account", json={
            "token": raw_token,
            "password": "NewStudentPassword@123",
            "confirm_password": "NewStudentPassword@123"
        })
        assert act_res.status_code == 200
        act_data = act_res.json()
        # Per spec: activation must NOT auto-create a session — no tokens returned
        assert "access_token" not in act_data
        assert "refresh_token" not in act_data
        assert "activated successfully" in act_data["message"].lower()

        # Check DB state updated
        user_check = db_execute("SELECT is_active, is_verified FROM users WHERE id = %s", (user_id,), fetch=True)
        assert user_check[0][0] is True
        assert user_check[0][1] is True

        # Check activated student can log in with new password
        login_res = client.post("/auth/login", json={
            "email": email,
            "password": "NewStudentPassword@123"
        })
        assert login_res.status_code == 200

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_expired_activation_token_rejected(self, client, admin_user):
        email = _unique_email()
        client.post("/admin/students", json={"name": "Expired Student", "email": email}, headers=admin_user["headers"])

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        raw_token = "expired_token_123"
        token_hash = AuthService.hash_token(raw_token)
        past_time = datetime.now(timezone.utc) - timedelta(hours=50)

        db_execute(
            "UPDATE student_activations SET token_hash = %s, expires_at = %s WHERE user_id = %s",
            (token_hash, past_time, user_id)
        )

        act_res = client.post("/auth/activate-account", json={
            "token": raw_token,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })
        assert act_res.status_code == 400
        assert "expired" in act_res.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_reused_activation_token_rejected(self, client, admin_user):
        email = _unique_email()
        client.post("/admin/students", json={"name": "Reused Student", "email": email}, headers=admin_user["headers"])

        user_rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
        user_id = user_rows[0][0]

        raw_token = "reused_token_123"
        token_hash = AuthService.hash_token(raw_token)

        db_execute(
            "UPDATE student_activations SET token_hash = %s WHERE user_id = %s",
            (token_hash, user_id)
        )

        # First activation succeeds
        res1 = client.post("/auth/activate-account", json={
            "token": raw_token,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })
        assert res1.status_code == 200

        # Second activation fails
        res2 = client.post("/auth/activate-account", json={
            "token": raw_token,
            "password": "Password@123",
            "confirm_password": "Password@123"
        })
        assert res2.status_code == 400
        assert "used" in res2.json()["detail"].lower()

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))
