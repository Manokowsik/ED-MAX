"""
Account Lifecycle, Existing Student Enrollment & Communication Tests
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from tests.conftest import db_execute, password_hash


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


class TestExistingStudentEnrollment:

    def test_existing_student_enrolled_without_duplicate(self, client, admin_user, test_course, email_mock):
        """Workflow B: Adding existing student with course_id enrolls them and notifies without duplicate user."""
        suffix = uuid.uuid4().hex[:6]
        email = f"existing_student_{suffix}@example.com"
        pwd = "StudentPassword@123"
        hashed = password_hash.hash(pwd)

        # 1. Pre-create student
        user_rows = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, is_verified, organization_id, token_version)
            VALUES (%s, %s, %s, 'STUDENT', TRUE, TRUE, %s, 1)
            RETURNING id
            """,
            ("Rahul", email, hashed, admin_user["organization_id"]),
            fetch=True
        )
        student_id = user_rows[0][0]

        # Insert membership so the student is treated as part of this org
        db_execute(
            "INSERT INTO organization_memberships (user_id, organization_id, is_active) VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
            (student_id, admin_user["organization_id"])
        )

        try:
            # Count users with this email before
            count_before = db_execute("SELECT COUNT(*) FROM users WHERE email = %s", (email,), fetch=True)[0][0]
            assert count_before == 1

            email_mock.clear()

            # 2. Instructor adds existing student email with course_id
            res = client.post(
                "/admin/students",
                json={
                    "name": "Rahul",
                    "email": email,
                    "course_id": test_course["id"]
                },
                headers=admin_user["headers"]
            )
            assert res.status_code == 200
            data = res.json()
            assert data["already_existed"] is True
            assert data["enrolled"] is True
            assert data["student"]["id"] == student_id

            # 3. NO duplicate account created
            count_after = db_execute("SELECT COUNT(*) FROM users WHERE email = %s", (email,), fetch=True)[0][0]
            assert count_after == 1

            # 4. Enrollment exists in DB
            enroll_row = db_execute(
                "SELECT id, status FROM enrollments WHERE student_id = %s AND course_id = %s",
                (student_id, test_course["id"]),
                fetch=True
            )
            assert len(enroll_row) == 1
            assert enroll_row[0][1] == "ASSIGNED"

            # 5. Enrollment email was dispatched
            enrollment_emails = [e for e in email_mock if f"enrolled in {test_course['title']}" in e["subject"]]
            assert len(enrollment_emails) >= 1
            assert enrollment_emails[0]["to"] == email

            # 6. In-app notification was created
            notif_row = db_execute(
                "SELECT type, title FROM notifications WHERE user_id = %s AND type = 'COURSE_ENROLLMENT'",
                (student_id,),
                fetch=True
            )
            assert len(notif_row) >= 1

        finally:
            db_execute("DELETE FROM enrollments WHERE student_id = %s", (student_id,))
            db_execute("DELETE FROM notifications WHERE user_id = %s", (student_id,))
            db_execute("DELETE FROM users WHERE id = %s", (student_id,))

    def test_existing_student_already_enrolled_handled_gracefully(self, client, admin_user, test_course):
        """Adding existing student who is ALREADY enrolled reports status cleanly without duplicate."""
        suffix = uuid.uuid4().hex[:6]
        email = f"already_enrolled_{suffix}@example.com"
        pwd = "StudentPassword@123"
        hashed = password_hash.hash(pwd)

        user_rows = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, is_verified, organization_id, token_version)
            VALUES (%s, %s, %s, 'STUDENT', TRUE, TRUE, %s, 1)
            RETURNING id
            """,
            ("Priya", email, hashed, admin_user["organization_id"]),
            fetch=True
        )
        student_id = user_rows[0][0]

        # Insert membership so the student is treated as part of this org
        db_execute(
            "INSERT INTO organization_memberships (user_id, organization_id, is_active) VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
            (student_id, admin_user["organization_id"])
        )

        # Enroll once
        db_execute(
            "INSERT INTO enrollments (student_id, course_id, status) VALUES (%s, %s, 'ASSIGNED')",
            (student_id, test_course["id"])
        )

        try:
            # Try adding again with course_id
            res = client.post(
                "/admin/students",
                json={
                    "name": "Priya",
                    "email": email,
                    "course_id": test_course["id"]
                },
                headers=admin_user["headers"]
            )
            assert res.status_code == 200
            data = res.json()
            assert data["already_existed"] is True
            assert data["enrolled"] is False
            assert "already enrolled" in data["message"].lower()

            # Ensure still only 1 enrollment
            e_count = db_execute(
                "SELECT COUNT(*) FROM enrollments WHERE student_id = %s AND course_id = %s",
                (student_id, test_course["id"]),
                fetch=True
            )[0][0]
            assert e_count == 1

        finally:
            db_execute("DELETE FROM enrollments WHERE student_id = %s", (student_id,))
            db_execute("DELETE FROM users WHERE id = %s", (student_id,))

    def test_existing_non_student_role_rejected(self, client, admin_user, test_course):
        """Adding an existing admin/instructor email as a student is rejected."""
        res = client.post(
            "/admin/students",
            json={
                "name": "Admin Fake Student",
                "email": admin_user["email"],
                "course_id": test_course["id"]
            },
            headers=admin_user["headers"]
        )
        assert res.status_code == 400
        detail = res.json()["detail"]
        assert "different role" in detail or "not a student" in detail.lower()


class TestNotificationsAPI:

    def test_notifications_crud(self, client, student_user):
        """Student can view notifications, unread count, mark read, and mark all read."""
        # Create 2 test notifications in DB
        db_execute(
            """
            INSERT INTO notifications (user_id, organization_id, type, title, message, link, is_read)
            VALUES
                (%s, %s, 'SYSTEM', 'Welcome Test', 'Message 1', '/student/dashboard', FALSE),
                (%s, %s, 'COURSE_ENROLLMENT', 'Course Test', 'Message 2', '/student/courses', FALSE)
            """,
            (student_user["id"], student_user["organization_id"], student_user["id"], student_user["organization_id"])
        )

        try:
            # 1. List notifications
            res = client.get("/users/me/notifications", headers=student_user["headers"])
            assert res.status_code == 200
            data = res.json()
            assert "notifications" in data
            assert data["unread_count"] >= 2
            assert len(data["notifications"]) >= 2

            first_notif = data["notifications"][0]
            notif_id = first_notif["id"]

            # 2. Mark single notification as read
            read_res = client.patch(f"/users/me/notifications/{notif_id}/read", headers=student_user["headers"])
            assert read_res.status_code == 200
            assert read_res.json()["notification"]["is_read"] is True

            # 3. Mark all read
            all_read = client.post("/users/me/notifications/read-all", headers=student_user["headers"])
            assert all_read.status_code == 200

            # Verify unread count is now 0
            check = client.get("/users/me/notifications", headers=student_user["headers"])
            assert check.json()["unread_count"] == 0

        finally:
            db_execute("DELETE FROM notifications WHERE user_id = %s", (student_user["id"],))


class TestHistoricalDataPreservedOnDeactivation:

    def test_deactivation_preserves_enrollments_and_certificates(self, client, admin_user, test_course):
        """When an account is deactivated, certificates and enrollments remain intact for reporting."""
        suffix = uuid.uuid4().hex[:6]
        email = f"hist_{suffix}@example.com"
        pwd = "HistPassword@123"
        hashed = password_hash.hash(pwd)

        user_rows = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, is_verified, organization_id, token_version)
            VALUES (%s, %s, %s, 'STUDENT', TRUE, TRUE, %s, 1)
            RETURNING id
            """,
            (f"Hist Student {suffix}", email, hashed, admin_user["organization_id"]),
            fetch=True
        )
        student_id = user_rows[0][0]

        # Insert membership so activate/deactivate will find this student
        db_execute(
            "INSERT INTO organization_memberships (user_id, organization_id, is_active) VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
            (student_id, admin_user["organization_id"])
        )

        # Create enrollment
        e_rows = db_execute(
            """
            INSERT INTO enrollments (student_id, course_id, status, assigned_at, completed_at)
            VALUES (%s, %s, 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """,
            (student_id, test_course["id"]),
            fetch=True
        )
        enrollment_id = e_rows[0][0]

        # Create certificate
        cert_num = f"CERT-HIST-{suffix.upper()}"
        c_rows = db_execute(
            """
            INSERT INTO certificates (student_id, course_id, certificate_number, final_score)
            VALUES (%s, %s, %s, 95)
            RETURNING id
            """,
            (student_id, test_course["id"], cert_num),
            fetch=True
        )
        cert_id = c_rows[0][0]

        token = create_access_token(user_id=student_id, email=email, role="STUDENT", organization_id=admin_user["organization_id"], token_version=1)
        headers = {"Authorization": f"Bearer {token}"}

        try:
            # Student deactivates own account
            res = client.request(
                "DELETE",
                "/users/me",
                json={"confirmation": "DELETE", "current_password": pwd},
                headers=headers
            )
            assert res.status_code == 200

            # 1. User is deactivated
            u_check = db_execute("SELECT is_active, deleted_at FROM users WHERE id = %s", (student_id,), fetch=True)[0]
            assert u_check[0] is False
            assert u_check[1] is not None

            # 2. Enrollment still exists!
            e_check = db_execute("SELECT status FROM enrollments WHERE id = %s", (enrollment_id,), fetch=True)
            assert len(e_check) == 1
            assert e_check[0][0] == "COMPLETED"

            # 3. Certificate still exists and remains verifiable!
            c_check = db_execute("SELECT certificate_number, final_score FROM certificates WHERE id = %s", (cert_id,), fetch=True)
            assert len(c_check) == 1
            assert c_check[0][0] == cert_num

            # 4. Public verify certificate endpoint still works for historical record!
            public_verify = client.get(f"/certificates/verify/{cert_num}")
            assert public_verify.status_code == 200
            assert public_verify.json()["valid"] is True

        finally:
            db_execute("DELETE FROM certificates WHERE id = %s", (cert_id,))
            db_execute("DELETE FROM enrollments WHERE id = %s", (enrollment_id,))
            db_execute("DELETE FROM users WHERE id = %s", (student_id,))
