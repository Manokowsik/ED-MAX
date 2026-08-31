"""
Shared test fixtures for ED-MAX backend tests.

Uses FastAPI's TestClient with httpx.
Tests require a live PostgreSQL database with the training_platform schema.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.main import app
from app.db.database import get_connection
from app.core.security import create_access_token


# ============================================================
# Test Client
# ============================================================

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# ============================================================
# Password Hasher
# ============================================================

password_hash = PasswordHash.recommended()


# ============================================================
# Database Helper
# ============================================================

def db_execute(sql, params=(), fetch=False):
    """Execute a raw SQL statement in the test database."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql, params)
        result = cursor.fetchall() if fetch else None
        conn.commit()
        return result
    finally:
        cursor.close()
        conn.close()


# ============================================================
# Test Admin User
# ============================================================

@pytest.fixture(scope="session")
def admin_user():
    """Create a test admin user (with organization) and return credentials + JWT token."""
    suffix = uuid.uuid4().hex[:8]
    email = f"testadmin_{suffix}@example.com"
    password = "AdminTest@123"
    hashed = password_hash.hash(password)

    # Create Organization
    org_res = db_execute(
        "INSERT INTO organizations (name) VALUES (%s) RETURNING id",
        (f"Test Admin Org {suffix}",),
        fetch=True
    )
    org_id = org_res[0][0]

    result = db_execute(
        """
        INSERT INTO users (name, email, password_hash, role, is_active, organization_id)
        VALUES (%s, %s, %s, 'ADMIN', TRUE, %s)
        RETURNING id, name, email, role, organization_id
        """,
        ("Test Admin", email, hashed, org_id),
        fetch=True
    )
    user = result[0]
    token = create_access_token(user_id=user[0], email=user[2], role=user[3], organization_id=user[4])

    yield {
        "id": user[0],
        "name": user[1],
        "email": user[2],
        "role": user[3],
        "organization_id": user[4],
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }

    # Cleanup
    db_execute("DELETE FROM users WHERE id = %s", (user[0],))
    db_execute("DELETE FROM organizations WHERE id = %s", (org_id,))


# ============================================================
# Test Student User
# ============================================================

@pytest.fixture(scope="session")
def student_user(admin_user):
    """Create a test student user belonging to admin_user's organization."""
    suffix = uuid.uuid4().hex[:8]
    email = f"teststudent_{suffix}@example.com"
    password = "StudentTest@123"
    hashed = password_hash.hash(password)

    result = db_execute(
        """
        INSERT INTO users (name, email, password_hash, role, is_active, organization_id)
        VALUES (%s, %s, %s, 'STUDENT', TRUE, %s)
        RETURNING id, name, email, role, organization_id
        """,
        ("Test Student", email, hashed, admin_user["organization_id"]),
        fetch=True
    )
    user = result[0]
    token = create_access_token(user_id=user[0], email=user[2], role=user[3], organization_id=user[4])

    yield {
        "id": user[0],
        "name": user[1],
        "email": user[2],
        "role": user[3],
        "organization_id": user[4],
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }

    # Cleanup
    db_execute("DELETE FROM users WHERE id = %s", (user[0],))


# ============================================================
# Test Course
# ============================================================

@pytest.fixture(scope="session")
def test_course(admin_user):
    """Create a test course for use across tests."""
    suffix = uuid.uuid4().hex[:6]
    result = db_execute(
        """
        INSERT INTO courses (title, description, created_by, organization_id, is_active)
        VALUES (%s, %s, %s, %s, TRUE)
        RETURNING id, title, description
        """,
        (f"Test Course {suffix}", "Test Description", admin_user["id"], admin_user["organization_id"]),
        fetch=True
    )
    course = result[0]

    yield {"id": course[0], "title": course[1], "description": course[2]}

    db_execute("DELETE FROM courses WHERE id = %s", (course[0],))


# ============================================================
# Test Module
# ============================================================

@pytest.fixture(scope="session")
def test_module(test_course):
    """Create a test module inside the test course."""
    result = db_execute(
        """
        INSERT INTO course_modules (course_id, title, description, module_order)
        VALUES (%s, %s, %s, %s)
        RETURNING id, course_id, title, description, module_order
        """,
        (test_course["id"], "Test Module 1", "Module Desc", 1),
        fetch=True
    )
    module = result[0]

    yield {
        "id": module[0],
        "course_id": module[1],
        "title": module[2],
        "description": module[3],
        "module_order": module[4]
    }

    db_execute("DELETE FROM course_modules WHERE id = %s", (module[0],))


# ============================================================
# Test Enrollment
# ============================================================

@pytest.fixture(scope="session")
def test_enrollment(student_user, test_course):
    """Enroll the test student in the test course."""
    db_execute(
        """
        INSERT INTO enrollments (student_id, course_id, status, assigned_at)
        VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        """,
        (student_user["id"], test_course["id"])
    )

    yield {
        "student_id": student_user["id"],
        "course_id": test_course["id"]
    }

    db_execute(
        "DELETE FROM enrollments WHERE student_id = %s AND course_id = %s",
        (student_user["id"], test_course["id"])
    )
