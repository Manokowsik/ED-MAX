"""
Student management tests: create, list, activate/deactivate.
Now covers multi-org scenarios (one-email = one account).
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


class TestStudentCreation:

    def test_create_student_success(self, client, admin_user):
        """Admin can create a brand-new student."""
        suffix = uuid.uuid4().hex[:8]
        response = client.post(
            "/admin/students",
            json={
                "name": f"New Student {suffix}",
                "email": f"newstudent_{suffix}@example.com",
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student"]["role"] in ("STUDENT", "student")
        assert data["student"]["is_active"] is False

        # Cleanup
        db_execute("DELETE FROM users WHERE id = %s", (data["student"]["id"],))

    def test_create_student_same_org_returns_already_member(self, client, admin_user, student_user):
        """Adding an existing student (same org, no course_id) returns 400 with clear message."""
        response = client.post(
            "/admin/students",
            json={
                "name": "Duplicate",
                "email": student_user["email"],
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 400
        assert "already part of your organization" in response.json()["detail"]

    def test_create_student_cross_org_sends_invitation(self, client, admin_user):
        """
        Admin B adding a student that belongs to Admin A's org should NOT raise an error.
        Instead, it adds a membership and sends an org invitation (HTTP 200).
        """
        suffix = uuid.uuid4().hex[:8]

        # Create a separate org (simulating "Admin B's org")
        org_b_res = db_execute(
            "INSERT INTO organizations (name) VALUES (%s) RETURNING id",
            (f"Org B {suffix}",),
            fetch=True
        )
        org_b_id = org_b_res[0][0]

        # Create Admin B token scoped to org_b
        from app.core.security import create_access_token
        token_b = create_access_token(
            user_id=admin_user["id"],
            email=admin_user["email"],
            role="ADMIN",
            organization_id=org_b_id
        )
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Create a student in Admin A's org first
        st_email = f"crossorg_{suffix}@example.com"
        st_res = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, is_verified, organization_id)
            VALUES ('Cross Org Student', %s, 'hash', 'STUDENT', TRUE, TRUE, %s)
            RETURNING id
            """,
            (st_email, admin_user["organization_id"]),
            fetch=True
        )
        student_id = st_res[0][0]

        # Also insert the initial membership in org A
        db_execute(
            "INSERT INTO organization_memberships (user_id, organization_id, is_active) VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
            (student_id, admin_user["organization_id"])
        )

        # Admin B now tries to add the same student → should succeed with 200 + invitation_sent
        response = client.post(
            "/admin/students",
            json={"name": "Cross Org Student", "email": st_email},
            headers=headers_b
        )
        assert response.status_code == 200
        data = response.json()
        # Should have sent an org invitation, not an activation
        assert data.get("already_existed") is True
        assert "invitation" in data["message"].lower() or "organization" in data["message"].lower()

        # Student should now appear in org B's student list
        list_res = client.get("/admin/students", headers=headers_b)
        assert list_res.status_code == 200
        student_ids = [s["id"] for s in list_res.json()["students"]]
        assert student_id in student_ids

        # Cleanup
        db_execute("DELETE FROM users WHERE id = %s", (student_id,))
        db_execute("DELETE FROM organizations WHERE id = %s", (org_b_id,))

    def test_create_student_non_student_role_blocked(self, client, admin_user):
        """Trying to add an admin/instructor email as a student must return 400."""
        # admin_user itself is an ADMIN role
        response = client.post(
            "/admin/students",
            json={
                "name": "Admin As Student",
                "email": admin_user["email"],
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "different role" in detail or "not a student" in detail.lower()

    def test_create_student_requires_admin(self, client, student_user):
        """Student cannot create another student."""
        response = client.post(
            "/admin/students",
            json={"name": "Hacker", "email": "hacker@hack.com"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_create_student_unauthenticated(self, client):
        """Unauthenticated request to create student returns 401."""
        response = client.post(
            "/admin/students",
            json={"name": "Nobody", "email": "nobody@test.com"}
        )
        assert response.status_code == 401

    def test_create_student_email_case_insensitive(self, client, admin_user, student_user):
        """Email lookup is case-insensitive — same-org duplicate with different case returns 400."""
        response = client.post(
            "/admin/students",
            json={
                "name": "Case Duplicate",
                "email": student_user["email"].upper(),
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 400
        assert "already part of your organization" in response.json()["detail"]


class TestStudentList:

    def test_get_students_success(self, client, admin_user, student_user):
        """Admin can list students in their org."""
        response = client.get("/admin/students", headers=admin_user["headers"])
        assert response.status_code == 200
        data = response.json()
        assert "students" in data
        assert isinstance(data["students"], list)
        # The student_user fixture inserts a membership, so they must appear
        student_ids = [s["id"] for s in data["students"]]
        assert student_user["id"] in student_ids
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
        """Create a temporary student for activation tests (with membership row)."""
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

        # Must have a membership row for the admin router to find them
        db_execute(
            """
            INSERT INTO organization_memberships (user_id, organization_id, is_active)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (user_id, organization_id) DO NOTHING
            """,
            (student_id, admin_user["organization_id"])
        )

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
