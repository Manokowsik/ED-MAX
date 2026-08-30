"""
Course enrollment tests: assign, duplicate, invalid student/course, student retrieval.
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


class TestCourseAssignment:

    def test_assign_course_success(self, client, admin_user, student_user, test_course):
        """Admin can assign a course to a student."""
        # Ensure not already enrolled
        db_execute(
            "DELETE FROM enrollments WHERE student_id = %s AND course_id = %s",
            (student_user["id"], test_course["id"])
        )

        response = client.post(
            f"/courses/{test_course['id']}/assign",
            json={"student_id": student_user["id"]},
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert data["enrollment"]["student_id"] == student_user["id"]
        assert data["enrollment"]["course_id"] == test_course["id"]
        assert data["enrollment"]["status"] == "ASSIGNED"

    def test_assign_course_duplicate(self, client, admin_user, student_user, test_course):
        """Assigning a student to a course they're already in returns 409."""
        response = client.post(
            f"/courses/{test_course['id']}/assign",
            json={"student_id": student_user["id"]},
            headers=admin_user["headers"]
        )
        assert response.status_code == 409

    def test_assign_course_invalid_student(self, client, admin_user, test_course):
        """Assigning a non-existent student returns 404."""
        response = client.post(
            f"/courses/{test_course['id']}/assign",
            json={"student_id": 99999999},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_assign_course_invalid_course(self, client, admin_user, student_user):
        """Assigning a non-existent course returns 404."""
        response = client.post(
            "/courses/99999999/assign",
            json={"student_id": student_user["id"]},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_assign_course_requires_admin(self, client, student_user, test_course):
        """Students cannot assign courses."""
        response = client.post(
            f"/courses/{test_course['id']}/assign",
            json={"student_id": student_user["id"]},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestEnrollmentRetrieval:

    def test_student_assigned_courses(self, client, admin_user, student_user, test_enrollment):
        """Admin can view student's assigned courses."""
        response = client.get(
            f"/admin/students/{student_user['id']}/courses",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "courses" in data
        course_ids = [c["id"] for c in data["courses"]]
        assert test_enrollment["course_id"] in course_ids

    def test_student_assigned_courses_requires_admin(self, client, student_user):
        """Students cannot view other students' assigned courses."""
        response = client.get(
            f"/admin/students/{student_user['id']}/courses",
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_student_own_courses(self, client, student_user, test_enrollment):
        """Students can view their own courses."""
        response = client.get(
            f"/courses/student/{student_user['id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "courses" in data
        course_ids = [c["course_id"] for c in data["courses"]]
        assert test_enrollment["course_id"] in course_ids

    def test_student_cannot_view_other_students_courses(
        self, client, student_user, admin_user, test_enrollment
    ):
        """Student cannot view another student's courses."""
        # Create another student
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
            f"/courses/student/{other_id}",
            headers=student_user["headers"]
        )
        assert response.status_code == 403

        db_execute("DELETE FROM users WHERE id = %s", (other_id,))


class TestCourseUnassignment:

    def test_unassign_course_success(self, client, admin_user, student_user, test_course):
        """Admin can remove a course assignment."""
        # Ensure enrolled
        db_execute(
            """
            INSERT INTO enrollments (student_id, course_id, status, assigned_at)
            VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """,
            (student_user["id"], test_course["id"])
        )

        response = client.delete(
            f"/courses/{test_course['id']}/assign/{student_user['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200

    def test_unassign_not_enrolled(self, client, admin_user, student_user, test_course):
        """Unassigning a non-enrolled student returns 404."""
        response = client.delete(
            f"/courses/{test_course['id']}/assign/{student_user['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_unassign_requires_admin(self, client, student_user, test_course):
        """Students cannot unassign courses."""
        response = client.delete(
            f"/courses/{test_course['id']}/assign/{student_user['id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 403
