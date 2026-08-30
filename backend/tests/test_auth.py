"""
Authentication tests: login, JWT validation, role enforcement.
"""

import uuid
import pytest
import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import JWT_SECRET_KEY, JWT_ALGORITHM
from tests.conftest import db_execute, password_hash


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ============================================================
# Login Tests
# ============================================================

class TestLogin:

    def test_login_success_admin(self, client, admin_user):
        """Admin can login with correct credentials."""
        response = client.post("/auth/login", json={
            "email": admin_user["email"],
            "password": admin_user["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "ADMIN"
        assert data["user"]["email"] == admin_user["email"]

    def test_login_success_student(self, client, student_user):
        """Student can login with correct credentials."""
        response = client.post("/auth/login", json={
            "email": student_user["email"],
            "password": student_user["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "STUDENT"

    def test_login_wrong_password(self, client, admin_user):
        """Login with wrong password returns 401."""
        response = client.post("/auth/login", json={
            "email": admin_user["email"],
            "password": "WrongPassword999"
        })
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]

    def test_login_wrong_email(self, client):
        """Login with non-existent email returns 401."""
        response = client.post("/auth/login", json={
            "email": "nobody@doesnotexist.com",
            "password": "SomePassword123"
        })
        assert response.status_code == 401

    def test_login_invalid_email_format(self, client):
        """Login with malformed email returns 422."""
        response = client.post("/auth/login", json={
            "email": "not-an-email",
            "password": "SomePassword123"
        })
        assert response.status_code == 422

    def test_login_missing_fields(self, client):
        """Login with missing fields returns 422."""
        response = client.post("/auth/login", json={"email": "test@test.com"})
        assert response.status_code == 422


# ============================================================
# JWT Validation Tests
# ============================================================

class TestJWTValidation:

    def test_invalid_jwt_rejected(self, client):
        """A garbage token is rejected with 401."""
        response = client.get(
            "/courses/",
            headers={"Authorization": "Bearer notavalidtoken"}
        )
        assert response.status_code == 401

    def test_missing_auth_rejected(self, client):
        """No Authorization header is rejected with 401 from HTTPBearer."""
        response = client.get("/courses/")
        assert response.status_code == 401

    def test_expired_jwt_rejected(self, client):
        """An expired JWT is rejected with 401."""
        from datetime import datetime, timedelta, timezone
        expired_payload = {
            "sub": "9999",
            "email": "test@test.com",
            "role": "ADMIN",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)
        }
        expired_token = jwt.encode(expired_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        response = client.get(
            "/courses/",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401

    def test_wrong_secret_rejected(self, client):
        """A token signed with a different secret is rejected."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone
        payload = {
            "sub": "9999",
            "email": "hacker@test.com",
            "role": "ADMIN",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        bad_token = pyjwt.encode(payload, "wrong_secret", algorithm="HS256")
        response = client.get(
            "/courses/",
            headers={"Authorization": f"Bearer {bad_token}"}
        )
        assert response.status_code == 401


# ============================================================
# Role Authorization Tests
# ============================================================

class TestRoleAuthorization:

    def test_student_cannot_access_admin_courses_list(self, client, student_user):
        """Students cannot call GET /courses/ (admin endpoint)."""
        response = client.get("/courses/", headers=student_user["headers"])
        assert response.status_code == 403

    def test_student_cannot_create_course(self, client, student_user):
        """Students cannot create courses."""
        response = client.post(
            "/courses/",
            json={"title": "Hacked Course", "description": "Bad"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_student_cannot_create_student(self, client, student_user):
        """Students cannot create other students."""
        response = client.post(
            "/admin/students",
            json={"name": "Hacker", "email": "hacker@x.com", "password": "Test123"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_admin_cannot_use_student_endpoints(self, client, admin_user):
        """Admins cannot call student-only endpoints."""
        response = client.get(
            f"/students/1/dashboard",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_unauthenticated_course_list_rejected(self, client):
        """GET /courses/ without token returns 401."""
        response = client.get("/courses/")
        assert response.status_code == 401
