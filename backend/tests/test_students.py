"""
Student management tests: create, list, activate/deactivate.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import db_execute


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


class TestStudentCreation:

    def test_create_student_success(self, client, admin_user):
        """Admin can create a new student."""
        suffix = uuid.uuid4().hex[:8]
        response = client.post(
            "/admin/students",
            json={
                "name": f"New Student {suffix}",
                "email": f"newstudent_{suffix}@example.com",
                "password": "Password123!"
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student"]["role"] in ("STUDENT", "student")
        assert data["student"]["is_active"] is True
        # Cleanup
        db_execute("DELETE FROM users WHERE id = %s", (data["student"]["id"],))

    def test_create_student_duplicate_email(self, client, admin_user, student_user):
        """Creating a student with an existing email returns 400."""
        response = client.post(
            "/admin/students",
            json={
                "name": "Duplicate",
                "email": student_user["email"],
                "password": "Password123!"
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 400
        assert "Email already exists" in response.json()["detail"]

    def test_create_student_requires_admin(self, client, student_user):
        """Student cannot create another student."""
        response = client.post(
            "/admin/students",
            json={
                "name": "Hacker",
                "email": "hacker@hack.com",
                "password": "Password123!"
            },
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_create_student_unauthenticated(self, client):
        """Unauthenticated request to create student returns 401."""
        response = client.post(
            "/admin/students",
            json={
                "name": "Nobody",
                "email": "nobody@test.com",
                "password": "Password123!"
            }
        )
        assert response.status_code == 401


class TestStudentList:

    def test_get_students_success(self, client, admin_user, student_user):
        """Admin can list students."""
        response = client.get("/admin/students", headers=admin_user["headers"])
        assert response.status_code == 200
        data = response.json()
        assert "students" in data
        assert isinstance(data["students"], list)
        # Verify no passwords in response
        for student in data["students"]:
            assert "password" not in student
            assert "password_hash" not in student

    def test_get_students_requires_admin(self, client, student_user):
        """Student cannot list all students."""
        response = client.get("/admin/students", headers=student_user["headers"])
        assert response.status_code == 403


class TestStudentActivation:

    @pytest.fixture(scope="class")
    def temp_student(self, admin_user):
        """Create a temporary student for activation tests."""
        suffix = uuid.uuid4().hex[:8]
        result = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, organization_id)
            VALUES (%s, %s, 'hash', 'STUDENT', TRUE, %s)
            RETURNING id
            """,
            (f"Temp {suffix}", f"temp_{suffix}@example.com", admin_user["organization_id"]),
            fetch=True
        )
        student_id = result[0][0]
        yield student_id
        db_execute("DELETE FROM users WHERE id = %s", (student_id,))

    def test_deactivate_student(self, client, admin_user, temp_student):
        """Admin can deactivate a student."""
        response = client.patch(
            f"/admin/students/{temp_student}/deactivate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["student"]["is_active"] is False

    def test_activate_student(self, client, admin_user, temp_student):
        """Admin can re-activate a student."""
        response = client.patch(
            f"/admin/students/{temp_student}/activate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["student"]["is_active"] is True

    def test_activate_nonexistent_student(self, client, admin_user):
        """Activating a non-existent student returns 404."""
        response = client.patch(
            "/admin/students/99999999/activate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_deactivate_requires_admin(self, client, student_user):
        """Student cannot deactivate another student."""
        response = client.patch(
            f"/admin/students/{student_user['id']}/deactivate",
            headers=student_user["headers"]
        )
        assert response.status_code == 403
