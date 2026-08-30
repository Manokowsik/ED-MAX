"""
Progress tests: module completion, course progress, ownership enforcement.
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


@pytest.fixture(scope="module")
def progress_enrollment(student_user, test_course, test_module):
    """Ensure student is enrolled for progress tests (self-contained)."""
    # Re-ensure enrollment exists
    db_execute(
        """
        INSERT INTO enrollments (student_id, course_id, status, assigned_at)
        VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        """,
        (student_user["id"], test_course["id"])
    )
    # Clear any existing progress
    db_execute(
        "DELETE FROM module_progress WHERE student_id = %s AND module_id = %s",
        (student_user["id"], test_module["id"])
    )
    yield {
        "student_id": student_user["id"],
        "course_id": test_course["id"],
        "module_id": test_module["id"]
    }
    # Leave enrollment for other tests; cleanup done by session fixtures


class TestModuleCompletion:

    def test_complete_module_success(self, client, student_user, test_module, progress_enrollment):
        """Enrolled student can mark a module as completed."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/complete",
            headers=student_user["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
        data = response.json()
        assert data["progress"]["completed"] is True
        assert data["progress"]["student_id"] == student_user["id"]
        assert data["progress"]["module_id"] == test_module["id"]
        assert "course" in data

    def test_complete_module_idempotent(self, client, student_user, test_module, progress_enrollment):
        """Completing an already-completed module is idempotent."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/complete",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["progress"]["completed"] is True

    def test_complete_module_requires_quiz_pass(self, client, student_user, test_module, progress_enrollment):
        """Cannot complete a module if it has a quiz and the student hasn't passed it."""
        # 1. Clear any existing progress
        db_execute(
            "DELETE FROM module_progress WHERE student_id = %s AND module_id = %s",
            (student_user["id"], test_module["id"])
        )
        
        # 2. Add a quiz to the module
        result = db_execute(
            """
            INSERT INTO quizzes (module_id, title, description, passing_score)
            VALUES (%s, 'Blocker Quiz', 'Desc', 60)
            RETURNING id
            """,
            (test_module["id"],),
            fetch=True
        )
        quiz_id = result[0][0]

        # 3. Attempt completion (should fail with 403)
        response = client.post(
            f"/courses/modules/{test_module['id']}/complete",
            headers=student_user["headers"]
        )
        assert response.status_code == 403
        assert "pass the module quiz" in response.json()["detail"].lower()

        # 4. Cleanup quiz
        db_execute("DELETE FROM quizzes WHERE id = %s", (quiz_id,))

    def test_complete_module_not_enrolled(self, client, admin_user, test_module):
        """Admin (not a student) cannot complete a module."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/complete",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_complete_module_not_found(self, client, student_user):
        """Completing a non-existent module returns 404."""
        response = client.post(
            "/courses/modules/99999999/complete",
            headers=student_user["headers"]
        )
        assert response.status_code == 404

    def test_complete_module_unauthenticated(self, client, test_module):
        """Unauthenticated request to complete module is rejected (401)."""
        response = client.post(f"/courses/modules/{test_module['id']}/complete")
        assert response.status_code == 401


class TestStudentProgress:

    def test_student_dashboard(self, client, student_user, progress_enrollment):
        """Student can view their own dashboard."""
        response = client.get(
            f"/students/{student_user['id']}/dashboard",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student"]["id"] == student_user["id"]
        assert "statistics" in data
        assert "courses" in data
        assert data["statistics"]["total_courses"] >= 1

    def test_student_dashboard_ownership(self, client, student_user):
        """Student cannot view another student's dashboard."""
        suffix = uuid.uuid4().hex[:8]
        result = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active)
            VALUES (%s, %s, 'hash', 'STUDENT', TRUE)
            RETURNING id
            """,
            (f"Other {suffix}", f"other_{suffix}@example.com"),
            fetch=True
        )
        other_id = result[0][0]

        response = client.get(
            f"/students/{other_id}/dashboard",
            headers=student_user["headers"]
        )
        assert response.status_code == 403

        db_execute("DELETE FROM users WHERE id = %s", (other_id,))

    def test_admin_cannot_use_student_dashboard(self, client, admin_user, student_user):
        """Admin cannot call student dashboard endpoint (wrong role)."""
        response = client.get(
            f"/students/{student_user['id']}/dashboard",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_course_progress_calculation(self, client, student_user, test_module, progress_enrollment):
        """Completing all modules of a course sets progress to 100%."""
        # Mark the test module as complete
        client.post(
            f"/courses/modules/{test_module['id']}/complete",
            headers=student_user["headers"]
        )

        response = client.get(
            f"/students/{student_user['id']}/dashboard",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()

        course_data = next(
            (c for c in data["courses"] if c["course_id"] == progress_enrollment["course_id"]),
            None
        )
        assert course_data is not None, f"Expected course {progress_enrollment['course_id']} in {data['courses']}"
        # With 1 module completed out of 1, progress should be 100%
        if course_data["total_modules"] == 1:
            assert course_data["progress_percentage"] == 100
