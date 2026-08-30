"""
Course management tests: create, retrieve, update, activate/deactivate, authorization.
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


class TestCourseCreation:

    def test_create_course_success(self, client, admin_user):
        """Admin can create a course."""
        suffix = uuid.uuid4().hex[:6]
        response = client.post(
            "/courses/",
            json={
                "title": f"Test Course {suffix}",
                "description": "A test course"
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert "course" in data
        assert data["course"]["is_active"] is True
        assert data["course"]["created_by"] == admin_user["id"]
        # Cleanup
        db_execute("DELETE FROM courses WHERE id = %s", (data["course"]["id"],))

    def test_create_course_requires_admin(self, client, student_user):
        """Students cannot create courses."""
        response = client.post(
            "/courses/",
            json={"title": "Bad Course", "description": "Bad"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_create_course_unauthenticated(self, client):
        """Unauthenticated cannot create course (returns 401)."""
        response = client.post(
            "/courses/",
            json={"title": "Bad Course", "description": "Bad"}
        )
        assert response.status_code == 401


class TestCourseRetrieval:

    def test_get_courses_success(self, client, admin_user, test_course):
        """Admin can list all courses."""
        response = client.get("/courses/", headers=admin_user["headers"])
        assert response.status_code == 200
        data = response.json()
        assert "courses" in data
        ids = [c["id"] for c in data["courses"]]
        assert test_course["id"] in ids

    def test_get_course_detail_success(self, client, admin_user, test_course):
        """Admin can retrieve a specific course."""
        response = client.get(
            f"/courses/{test_course['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["course"]["id"] == test_course["id"]
        assert "modules" in data["course"]
        assert "students" in data["course"]

    def test_get_course_not_found(self, client, admin_user):
        """Non-existent course returns 404."""
        response = client.get("/courses/99999999", headers=admin_user["headers"])
        assert response.status_code == 404

    def test_get_courses_requires_admin(self, client, student_user):
        """Students cannot call the admin course list endpoint."""
        response = client.get("/courses/", headers=student_user["headers"])
        assert response.status_code == 403


class TestCourseUpdate:

    def test_update_course_success(self, client, admin_user, test_course):
        """Admin can update a course."""
        response = client.put(
            f"/courses/{test_course['id']}",
            json={"title": "Updated Title", "description": "Updated Description"},
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["course"]["title"] == "Updated Title"

    def test_update_course_no_fields(self, client, admin_user, test_course):
        """Updating with no fields returns 400."""
        response = client.put(
            f"/courses/{test_course['id']}",
            json={},
            headers=admin_user["headers"]
        )
        assert response.status_code == 400

    def test_update_course_not_found(self, client, admin_user):
        """Updating a non-existent course returns 404."""
        response = client.put(
            "/courses/99999999",
            json={"title": "X"},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_update_course_requires_admin(self, client, student_user, test_course):
        """Students cannot update courses."""
        response = client.put(
            f"/courses/{test_course['id']}",
            json={"title": "Hacked"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestCourseActivation:

    def test_deactivate_course(self, client, admin_user, test_course):
        """Admin can deactivate a course."""
        response = client.patch(
            f"/courses/{test_course['id']}/deactivate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["course"]["is_active"] is False

    def test_activate_course(self, client, admin_user, test_course):
        """Admin can activate a course."""
        response = client.patch(
            f"/courses/{test_course['id']}/activate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["course"]["is_active"] is True

    def test_activate_nonexistent_course(self, client, admin_user):
        """Activating a non-existent course returns 404."""
        response = client.patch(
            "/courses/99999999/activate",
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_deactivate_requires_admin(self, client, student_user, test_course):
        """Students cannot deactivate courses."""
        response = client.patch(
            f"/courses/{test_course['id']}/deactivate",
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestCourseProgress:

    def test_get_course_progress(self, client, admin_user, test_course):
        """Admin can retrieve course progress."""
        response = client.get(
            f"/courses/{test_course['id']}/progress",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "statistics" in data
        assert "students" in data

    def test_course_progress_requires_admin(self, client, student_user, test_course):
        """Students cannot view course progress."""
        response = client.get(
            f"/courses/{test_course['id']}/progress",
            headers=student_user["headers"]
        )
        assert response.status_code == 403
