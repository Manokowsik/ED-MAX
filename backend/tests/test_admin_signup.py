"""
Admin Signup tests: registration, validation, security, and non-regression.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import db_execute, password_hash


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _unique_email():
    return f"signup_test_{uuid.uuid4().hex[:8]}@example.com"


# ============================================================
# Successful Signup
# ============================================================

class TestAdminSignupSuccess:

    def test_successful_admin_signup(self, client):
        """A valid signup request creates an admin user and returns 201."""
        email = _unique_email()

        response = client.post("/auth/admin-signup", json={
            "name": "New Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 201
        data = response.json()

        assert data["message"] == "Admin account created successfully"
        assert data["user"]["email"] == email
        assert data["user"]["name"] == "New Admin"
        assert data["user"]["role"] == "ADMIN"
        assert data["user"]["is_active"] is True
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_created_user_has_admin_role_in_db(self, client):
        """The database row has role = 'ADMIN'."""
        email = _unique_email()

        client.post("/auth/admin-signup", json={
            "name": "DB Check Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        rows = db_execute(
            "SELECT role FROM users WHERE email = %s",
            (email,),
            fetch=True
        )
        assert len(rows) == 1
        assert rows[0][0] == "ADMIN"

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_password_stored_hashed_not_plaintext(self, client):
        """Password is hashed in the database, not stored as plaintext."""
        email = _unique_email()
        raw_password = "SecurePass@123"

        client.post("/auth/admin-signup", json={
            "name": "Hash Check Admin",
            "email": email,
            "password": raw_password,
            "confirm_password": raw_password
        })

        rows = db_execute(
            "SELECT password_hash FROM users WHERE email = %s",
            (email,),
            fetch=True
        )
        assert len(rows) == 1
        stored_hash = rows[0][0]

        # Must not be plaintext
        assert stored_hash != raw_password

        # Must verify correctly
        assert password_hash.verify(raw_password, stored_hash)

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_newly_created_admin_can_login(self, client):
        """After signup, the admin can log in via /auth/login."""
        email = _unique_email()
        password = "SecurePass@123"

        client.post("/auth/admin-signup", json={
            "name": "Login Test Admin",
            "email": email,
            "password": password,
            "confirm_password": password
        })

        login_response = client.post("/auth/login", json={
            "email": email,
            "password": password
        })

        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["user"]["role"] == "ADMIN"

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))


# ============================================================
# Validation Errors
# ============================================================

class TestAdminSignupValidation:

    def test_duplicate_email_rejected(self, client):
        """Signing up with an existing email returns 409."""
        email = _unique_email()

        # First signup
        client.post("/auth/admin-signup", json={
            "name": "First Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        # Duplicate
        response = client.post("/auth/admin-signup", json={
            "name": "Duplicate Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_invalid_email_format_rejected(self, client):
        """Malformed email returns 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "Bad Email Admin",
            "email": "not-an-email",
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 422

    def test_password_mismatch_rejected(self, client):
        """Mismatched passwords return 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "Mismatch Admin",
            "email": _unique_email(),
            "password": "SecurePass@123",
            "confirm_password": "DifferentPass@456"
        })

        assert response.status_code == 422
        body = response.json()
        # Pydantic v2 puts errors under "detail"
        assert any(
            "match" in str(err).lower()
            for err in (body.get("detail") or [])
        )

    def test_short_password_rejected(self, client):
        """Password shorter than 8 characters returns 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "Short Pwd Admin",
            "email": _unique_email(),
            "password": "Short1",
            "confirm_password": "Short1"
        })

        assert response.status_code == 422

    def test_missing_name_rejected(self, client):
        """Missing name returns 422."""
        response = client.post("/auth/admin-signup", json={
            "email": _unique_email(),
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 422

    def test_missing_email_rejected(self, client):
        """Missing email returns 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "No Email Admin",
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 422

    def test_missing_password_rejected(self, client):
        """Missing password returns 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "No Pwd Admin",
            "email": _unique_email()
        })

        assert response.status_code == 422

    def test_empty_name_rejected(self, client):
        """Whitespace-only name returns 422."""
        response = client.post("/auth/admin-signup", json={
            "name": "   ",
            "email": _unique_email(),
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        assert response.status_code == 422


# ============================================================
# Security
# ============================================================

class TestAdminSignupSecurity:

    def test_client_cannot_override_role(self, client):
        """Even if the client sends role='STUDENT', the backend assigns ADMIN."""
        email = _unique_email()

        response = client.post("/auth/admin-signup", json={
            "name": "Role Override Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123",
            "role": "STUDENT"  # Should be ignored
        })

        assert response.status_code == 201
        assert response.json()["user"]["role"] == "ADMIN"

        # Verify in DB
        rows = db_execute(
            "SELECT role FROM users WHERE email = %s",
            (email,),
            fetch=True
        )
        assert rows[0][0] == "ADMIN"

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_password_hash_not_in_response(self, client):
        """No password or hash appears in the signup response."""
        email = _unique_email()

        response = client.post("/auth/admin-signup", json={
            "name": "No Hash Admin",
            "email": email,
            "password": "SecurePass@123",
            "confirm_password": "SecurePass@123"
        })

        body = response.text
        assert "password_hash" not in body

        # Cleanup
        db_execute("DELETE FROM users WHERE email = %s", (email,))


# ============================================================
# Non-Regression: Existing Auth Still Works
# ============================================================

class TestExistingAuthUnchanged:

    def test_existing_admin_login_still_works(self, client, admin_user):
        """The pre-existing admin fixture can still log in."""
        response = client.post("/auth/login", json={
            "email": admin_user["email"],
            "password": admin_user["password"]
        })
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "ADMIN"

    def test_existing_student_login_still_works(self, client, student_user):
        """The pre-existing student fixture can still log in."""
        response = client.post("/auth/login", json={
            "email": student_user["email"],
            "password": student_user["password"]
        })
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "STUDENT"

    def test_protected_admin_route_still_enforced(self, client, student_user):
        """Students still cannot access admin-only endpoints."""
        response = client.get("/courses/", headers=student_user["headers"])
        assert response.status_code == 403

    def test_protected_student_route_still_enforced(self, client, admin_user):
        """Admins still cannot access student-only endpoints."""
        response = client.get(
            f"/students/{admin_user['id']}/dashboard",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_unauthenticated_access_still_rejected(self, client):
        """Unauthenticated requests to protected endpoints still return 401."""
        response = client.get("/courses/")
        assert response.status_code == 401
