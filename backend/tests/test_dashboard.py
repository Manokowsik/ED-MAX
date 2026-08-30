"""
Admin dashboard tests.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import db_execute


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


class TestAdminDashboard:

    def test_get_dashboard_success(self, client, admin_user, test_course):
        """Admin can retrieve the dashboard with stats."""
        response = client.get(
            "/admin/dashboard",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "summary" in data
        assert "total_courses" in data["summary"]
        assert "total_students" in data["summary"]
        assert "total_enrollments" in data["summary"]
        
        assert "courses" in data
        assert isinstance(data["courses"], list)
        
        assert "recent_quiz_attempts" in data
        assert isinstance(data["recent_quiz_attempts"], list)

    def test_dashboard_requires_admin(self, client, student_user):
        """Students cannot view the admin dashboard."""
        response = client.get(
            "/admin/dashboard",
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_dashboard_unauthenticated(self, client):
        """Unauthenticated requests cannot view the admin dashboard."""
        response = client.get("/admin/dashboard")
        assert response.status_code == 401
