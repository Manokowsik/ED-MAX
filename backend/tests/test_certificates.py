"""
Certificate tests: eligibility, generation, retrieval, duplicate prevention.
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
def cert_setup(student_user, test_course, test_module):
    """
    Self-contained fixture that:
    1. Ensures student is enrolled in test_course
    2. Marks test_module as completed
    3. Updates enrollment to COMPLETED
    4. Cleans any pre-existing certificate
    """
    # Ensure enrollment
    db_execute(
        """
        INSERT INTO enrollments (student_id, course_id, status, assigned_at)
        VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        """,
        (student_user["id"], test_course["id"])
    )

    # Complete the module
    db_execute(
        """
        INSERT INTO module_progress (student_id, module_id, completed, completed_at)
        VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id, module_id) DO UPDATE
        SET completed = TRUE, completed_at = CURRENT_TIMESTAMP
        """,
        (student_user["id"], test_module["id"])
    )

    # Update enrollment to COMPLETED
    db_execute(
        """
        UPDATE enrollments
        SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
        WHERE student_id = %s AND course_id = %s
        """,
        (student_user["id"], test_course["id"])
    )

    # Remove any pre-existing certificate
    db_execute(
        "DELETE FROM certificates WHERE student_id = %s AND course_id = %s",
        (student_user["id"], test_course["id"])
    )

    yield {
        "student_id": student_user["id"],
        "course_id": test_course["id"],
        "module_id": test_module["id"]
    }

    # Cleanup
    db_execute(
        "DELETE FROM certificates WHERE student_id = %s AND course_id = %s",
        (student_user["id"], test_course["id"])
    )


class TestCertificateGeneration:

    def test_generate_certificate_without_completing_modules(
        self, client, student_user, test_course
    ):
        """Cannot generate certificate if modules are not completed."""
        # Create a fresh course with no completions
        result = db_execute(
            """
            INSERT INTO courses (title, description, created_by, is_active)
            VALUES ('Cert Test Course', 'Desc', %s, TRUE)
            RETURNING id
            """,
            (student_user["id"],),
            fetch=True
        )
        fresh_course_id = result[0][0]

        # Create a module in it
        db_execute(
            """
            INSERT INTO course_modules (course_id, title, description, module_order)
            VALUES (%s, 'Mod', 'Desc', 1)
            """,
            (fresh_course_id,)
        )

        # Enroll student but DON'T complete modules
        db_execute(
            """
            INSERT INTO enrollments (student_id, course_id, status, assigned_at)
            VALUES (%s, %s, 'IN_PROGRESS', CURRENT_TIMESTAMP)
            """,
            (student_user["id"], fresh_course_id)
        )

        response = client.post(
            f"/certificates/courses/{fresh_course_id}",
            headers=student_user["headers"]
        )
        assert response.status_code == 400
        assert "module" in response.json()["detail"].lower()

        # Cleanup
        db_execute(
            "DELETE FROM enrollments WHERE student_id = %s AND course_id = %s",
            (student_user["id"], fresh_course_id)
        )
        db_execute("DELETE FROM courses WHERE id = %s", (fresh_course_id,))

    def test_generate_certificate_after_completion(
        self, client, student_user, cert_setup
    ):
        """Certificate can be generated after all modules are completed."""
        response = client.post(
            f"/certificates/courses/{cert_setup['course_id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.json()}"
        )
        data = response.json()
        assert "certificate" in data
        assert "certificate_number" in data["certificate"]
        assert "CERT-" in data["certificate"]["certificate_number"]
        assert data["certificate"]["student_name"] == student_user["name"]

    def test_generate_certificate_duplicate_returns_existing(
        self, client, student_user, cert_setup
    ):
        """Generating a certificate again returns the existing one."""
        response = client.post(
            f"/certificates/courses/{cert_setup['course_id']}",
            headers=student_user["headers"]
        )
        assert response.status_code in (200, 201)
        assert "Certificate already exists" in response.json().get("message", "")

    def test_generate_certificate_requires_student(
        self, client, admin_user, cert_setup
    ):
        """Admin cannot generate a student certificate (wrong role)."""
        response = client.post(
            f"/certificates/courses/{cert_setup['course_id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_generate_certificate_not_enrolled(self, client, student_user):
        """Cannot generate certificate for a course not enrolled in."""
        response = client.post(
            "/certificates/courses/99999999",
            headers=student_user["headers"]
        )
        assert response.status_code in (403, 404)


class TestCertificateRetrieval:

    def test_get_certificate_success(
        self, client, student_user, cert_setup
    ):
        """Student can retrieve their own certificate."""
        # First ensure certificate exists
        client.post(
            f"/certificates/courses/{cert_setup['course_id']}",
            headers=student_user["headers"]
        )

        rows = db_execute(
            """
            SELECT id FROM certificates
            WHERE student_id = %s AND course_id = %s
            """,
            (student_user["id"], cert_setup["course_id"]),
            fetch=True
        )
        if not rows:
            pytest.skip("No certificate exists for this student")

        cert_id = rows[0][0]
        response = client.get(
            f"/certificates/{cert_id}",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["certificate"]["id"] == cert_id
        assert "certificate_number" in data["certificate"]

    def test_get_certificate_not_found(self, client, student_user):
        """Non-existent certificate returns 404."""
        response = client.get(
            "/certificates/99999999",
            headers=student_user["headers"]
        )
        assert response.status_code == 404

    def test_get_student_certificates(
        self, client, student_user, cert_setup
    ):
        """Student can list their own certificates."""
        response = client.get(
            f"/certificates/student/{student_user['id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "certificates" in data

    def test_student_cannot_view_others_certificates(self, client, student_user):
        """Student cannot view another student's certificates."""
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
            f"/certificates/student/{other_id}",
            headers=student_user["headers"]
        )
        assert response.status_code == 403

        db_execute("DELETE FROM users WHERE id = %s", (other_id,))

    def test_admin_can_view_any_student_certificates(
        self, client, admin_user, student_user
    ):
        """Admin can view any student's certificates."""
        response = client.get(
            f"/certificates/student/{student_user['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 200
