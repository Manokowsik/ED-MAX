"""
Module and training content tests.
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


class TestModuleCreation:

    def test_create_module_success(self, client, admin_user, test_course):
        """Admin can create a module in a course."""
        response = client.post(
            f"/courses/{test_course['id']}/modules",
            json={
                "title": "Module A",
                "description": "Module A Description",
                "module_order": 1
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert data["module"]["course_id"] == test_course["id"]
        assert data["module"]["title"] == "Module A"
        assert data["module"]["is_published"] is False
        # Cleanup
        db_execute("DELETE FROM course_modules WHERE id = %s", (data["module"]["id"],))

    def test_create_module_with_authoring_fields(self, client, admin_user, test_course):
        """Admin can create a module with objectives, key takeaways, and published status."""
        response = client.post(
            f"/courses/{test_course['id']}/modules",
            json={
                "title": "Control Flow Module",
                "description": "Learn if/else and loops",
                "module_order": 2,
                "objectives": ["Understand condition evaluation", "Apply loops"],
                "key_takeaways": ["If statements check booleans"],
                "is_published": True
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()["module"]
        assert data["title"] == "Control Flow Module"
        assert data["objectives"] == ["Understand condition evaluation", "Apply loops"]
        assert data["key_takeaways"] == ["If statements check booleans"]
        assert data["is_published"] is True

        db_execute("DELETE FROM course_modules WHERE id = %s", (data["id"],))

    def test_create_module_invalid_course(self, client, admin_user):
        """Creating a module in a non-existent course returns 404."""
        response = client.post(
            "/courses/99999999/modules",
            json={"title": "X", "description": "Y", "module_order": 1},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_create_module_requires_admin(self, client, student_user, test_course):
        """Students cannot create modules."""
        response = client.post(
            f"/courses/{test_course['id']}/modules",
            json={"title": "Hacked Module", "description": "X", "module_order": 1},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestModuleUpdate:

    def test_update_module_success(self, client, admin_user, test_module):
        """Admin can update a module."""
        response = client.put(
            f"/courses/modules/{test_module['id']}",
            json={"title": "Updated Module"},
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["module"]["title"] == "Updated Module"

    def test_update_module_publish_toggle(self, client, admin_user, test_module):
        """Admin can toggle module published status."""
        response = client.put(
            f"/courses/modules/{test_module['id']}",
            json={"is_published": True, "objectives": ["New Obj"]},
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
        mod = response.json()["module"]
        assert mod["is_published"] is True
        assert mod["objectives"] == ["New Obj"]

    def test_update_module_no_fields(self, client, admin_user, test_module):
        """Updating with no fields returns 400."""
        response = client.put(
            f"/courses/modules/{test_module['id']}",
            json={},
            headers=admin_user["headers"]
        )
        assert response.status_code == 400

    def test_update_module_not_found(self, client, admin_user):
        """Updating a non-existent module returns 404."""
        response = client.put(
            "/courses/modules/99999999",
            json={"title": "X"},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_update_module_requires_admin(self, client, student_user, test_module):
        """Students cannot update modules."""
        response = client.put(
            f"/courses/modules/{test_module['id']}",
            json={"title": "Hacked"},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestModuleDelete:

    def test_delete_module_success(self, client, admin_user, test_course):
        """Admin can delete an empty module."""
        result = db_execute(
            """
            INSERT INTO course_modules (course_id, title, description, module_order)
            VALUES (%s, 'Delete Me', 'Temp', 99)
            RETURNING id
            """,
            (test_course["id"],),
            fetch=True
        )
        module_id = result[0][0]

        response = client.delete(
            f"/courses/modules/{module_id}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200

    def test_delete_module_with_content_fails(self, client, admin_user, test_module):
        """Deleting a module with training content returns 409."""
        # Add a content to the module
        result = db_execute(
            """
            INSERT INTO training_contents (module_id, content_type, content, content_order)
            VALUES (%s, 'TEXT', 'Temporary content', 1)
            RETURNING id
            """,
            (test_module["id"],),
            fetch=True
        )
        content_id = result[0][0]

        response = client.delete(
            f"/courses/modules/{test_module['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 409

        # Cleanup
        db_execute("DELETE FROM training_contents WHERE id = %s", (content_id,))

    def test_delete_nonexistent_module(self, client, admin_user):
        """Deleting a non-existent module returns 404."""
        response = client.delete(
            "/courses/modules/99999999",
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_delete_module_requires_admin(self, client, student_user, test_module):
        """Students cannot delete modules."""
        response = client.delete(
            f"/courses/modules/{test_module['id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 403


class TestTrainingContent:

    def test_create_content_text(self, client, admin_user, test_module):
        """Admin can create TEXT content for a module with a title."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/content",
            json={
                "content_type": "TEXT",
                "title": "Introduction Lesson",
                "content": "This is some training text content.",
                "content_order": 1
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert data["content"]["content_type"] == "TEXT"
        assert data["content"]["title"] == "Introduction Lesson"
        assert data["content"]["module_id"] == test_module["id"]
        db_execute("DELETE FROM training_contents WHERE id = %s", (data["content"]["id"],))

    def test_create_content_video(self, client, admin_user, test_module):
        """Admin can create VIDEO content with a title."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/content",
            json={
                "content_type": "VIDEO",
                "title": "Demo Video",
                "content": "https://example.com/video.mp4",
                "content_order": 2
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        assert response.json()["content"]["content_type"] == "VIDEO"
        assert response.json()["content"]["title"] == "Demo Video"
        db_execute(
            "DELETE FROM training_contents WHERE id = %s",
            (response.json()["content"]["id"],)
        )

    def test_create_content_invalid_type(self, client, admin_user, test_module):
        """Creating content with invalid type returns 400."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/content",
            json={
                "content_type": "PDF",
                "content": "something",
                "content_order": 1
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 400

    def test_create_content_requires_admin(self, client, student_user, test_module):
        """Students cannot create training content."""
        response = client.post(
            f"/courses/modules/{test_module['id']}/content",
            json={"content_type": "TEXT", "content": "X", "content_order": 1},
            headers=student_user["headers"]
        )
        assert response.status_code == 403

    def test_update_content_success(self, client, admin_user, test_module):
        """Admin can update training content title and content."""
        result = db_execute(
            """
            INSERT INTO training_contents (module_id, content_type, title, content, content_order)
            VALUES (%s, 'TEXT', 'Old Title', 'Original content', 10)
            RETURNING id
            """,
            (test_module["id"],),
            fetch=True
        )
        content_id = result[0][0]

        response = client.put(
            f"/courses/modules/{test_module['id']}/content/{content_id}",
            json={"title": "New Title", "content": "Updated content"},
            headers=admin_user["headers"]
        )
        assert response.status_code == 200

        db_execute("DELETE FROM training_contents WHERE id = %s", (content_id,))

    def test_delete_content_success(self, client, admin_user, test_module):
        """Admin can delete training content."""
        result = db_execute(
            """
            INSERT INTO training_contents (module_id, content_type, content, content_order)
            VALUES (%s, 'TEXT', 'Delete me', 99)
            RETURNING id
            """,
            (test_module["id"],),
            fetch=True
        )
        content_id = result[0][0]

        response = client.delete(
            f"/courses/modules/{test_module['id']}/content/{content_id}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
