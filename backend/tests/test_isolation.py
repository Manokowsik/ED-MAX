"""
Multi-Admin & Multi-Tenant Data Isolation Test Suite (Comprehensive IDOR Protection)
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


@pytest.fixture(scope="module")
def env_setup(client):
    """
    Sets up Admin A & Admin B, Student A & Student B, Course A & Course B, Modules, Quizzes, Certificates, etc.
    """
    # 1. Admin A & Admin B via Signup
    email_a = f"admin_a_{uuid.uuid4().hex[:6]}@example.com"
    email_b = f"admin_b_{uuid.uuid4().hex[:6]}@example.com"

    res_a = client.post("/auth/admin-signup", json={
        "name": "Admin A",
        "email": email_a,
        "password": "PasswordA@123",
        "confirm_password": "PasswordA@123"
    })
    assert res_a.status_code == 201

    res_b = client.post("/auth/admin-signup", json={
        "name": "Admin B",
        "email": email_b,
        "password": "PasswordB@123",
        "confirm_password": "PasswordB@123"
    })
    assert res_b.status_code == 201

    # Mark admins verified in DB for login
    db_execute("UPDATE users SET is_verified = TRUE WHERE email IN (%s, %s)", (email_a, email_b))

    # Login both to get tokens
    login_a = client.post("/auth/login", json={"email": email_a, "password": "PasswordA@123"}).json()
    login_b = client.post("/auth/login", json={"email": email_b, "password": "PasswordB@123"}).json()

    headers_a = {"Authorization": f"Bearer {login_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {login_b['access_token']}"}

    # 2. Admin A creates Student A, Admin B creates Student B
    # No password is specified — activation-based flow. Set password directly in DB for testing.
    res_st_a = client.post("/admin/students", headers=headers_a, json={
        "name": "Student A",
        "email": f"student_a_{uuid.uuid4().hex[:6]}@example.com",
    })
    assert res_st_a.status_code == 200
    student_a = res_st_a.json()["student"]

    res_st_b = client.post("/admin/students", headers=headers_b, json={
        "name": "Student B",
        "email": f"student_b_{uuid.uuid4().hex[:6]}@example.com",
    })
    assert res_st_b.status_code == 200
    student_b = res_st_b.json()["student"]

    # Bypass email activation for test setup: set known passwords and mark students active/verified
    db_execute(
        "UPDATE users SET password_hash = %s, is_active = TRUE, is_verified = TRUE WHERE id = %s",
        (password_hash.hash("StudentPassA@123"), student_a["id"])
    )
    db_execute(
        "UPDATE users SET password_hash = %s, is_active = TRUE, is_verified = TRUE WHERE id = %s",
        (password_hash.hash("StudentPassB@123"), student_b["id"])
    )

    # Student login tokens
    login_st_a = client.post("/auth/login", json={"email": student_a["email"], "password": "StudentPassA@123"}).json()
    login_st_b = client.post("/auth/login", json={"email": student_b["email"], "password": "StudentPassB@123"}).json()

    headers_st_a = {"Authorization": f"Bearer {login_st_a['access_token']}"}
    headers_st_b = {"Authorization": f"Bearer {login_st_b['access_token']}"}


    # 3. Admin A creates Course A, Admin B creates Course B
    res_ca = client.post("/courses/", headers=headers_a, json={"title": "Course A", "description": "Desc A"})
    assert res_ca.status_code == 201
    course_a = res_ca.json()["course"]

    res_cb = client.post("/courses/", headers=headers_b, json={"title": "Course B", "description": "Desc B"})
    assert res_cb.status_code == 201
    course_b = res_cb.json()["course"]

    # 4. Admin A creates Module A & Quiz A in Course A
    res_ma = client.post(f"/courses/{course_a['id']}/modules", headers=headers_a, json={
        "title": "Module A", "description": "Desc Mod A", "module_order": 1
    })
    assert res_ma.status_code == 201
    module_a = res_ma.json()["module"]

    res_qa = client.post("/quizzes/", headers=headers_a, json={
        "module_id": module_a["id"], "title": "Quiz A", "description": "Desc Quiz A", "passing_score": 80
    })
    assert res_qa.status_code == 201
    quiz_a = res_qa.json()["quiz"]

    data = {
        "admin_a": login_a["user"],
        "headers_a": headers_a,
        "admin_b": login_b["user"],
        "headers_b": headers_b,
        "student_a": student_a,
        "headers_st_a": headers_st_a,
        "student_b": student_b,
        "headers_st_b": headers_st_b,
        "course_a": course_a,
        "course_b": course_b,
        "module_a": module_a,
        "quiz_a": quiz_a
    }

    yield data

    # Cleanup database (in correct foreign key order)
    db_execute("DELETE FROM quizzes WHERE id = %s", (quiz_a["id"],))
    db_execute("DELETE FROM course_modules WHERE id = %s", (module_a["id"],))
    db_execute("DELETE FROM courses WHERE id IN (%s, %s)", (course_a["id"], course_b["id"]))
    db_execute("DELETE FROM users WHERE email IN (%s, %s, %s, %s)",
               (email_a, email_b, student_a["email"], student_b["email"]))
    db_execute("DELETE FROM organizations WHERE id IN (%s, %s)",
               (login_a["user"]["organization_id"], login_b["user"]["organization_id"]))


def test_01_create_admin_a(env_setup):
    """TEST 1: Create Admin A."""
    assert env_setup["admin_a"]["id"] is not None


def test_02_create_admin_b(env_setup):
    """TEST 2: Create Admin B."""
    assert env_setup["admin_b"]["id"] is not None
    assert env_setup["admin_a"]["organization_id"] != env_setup["admin_b"]["organization_id"]


def test_03_admin_a_creates_student_a(env_setup):
    """TEST 3: Admin A creates Student A."""
    assert env_setup["student_a"]["id"] is not None


def test_04_admin_b_creates_student_b(env_setup):
    """TEST 4: Admin B creates Student B."""
    assert env_setup["student_b"]["id"] is not None


def test_05_admin_a_requests_students(client, env_setup):
    """TEST 5: Admin A requests students. Student A visible, Student B NOT visible."""
    res = client.get("/admin/students", headers=env_setup["headers_a"])
    assert res.status_code == 200
    student_ids = [s["id"] for s in res.json()["students"]]
    assert env_setup["student_a"]["id"] in student_ids
    assert env_setup["student_b"]["id"] not in student_ids


def test_06_admin_b_requests_students(client, env_setup):
    """TEST 6: Admin B requests students. Student B visible, Student A NOT visible."""
    res = client.get("/admin/students", headers=env_setup["headers_b"])
    assert res.status_code == 200
    student_ids = [s["id"] for s in res.json()["students"]]
    assert env_setup["student_b"]["id"] in student_ids
    assert env_setup["student_a"]["id"] not in student_ids


def test_07_admin_a_creates_course_a(env_setup):
    """TEST 7: Admin A creates Course A."""
    assert env_setup["course_a"]["id"] is not None


def test_08_admin_b_creates_course_b(env_setup):
    """TEST 8: Admin B creates Course B."""
    assert env_setup["course_b"]["id"] is not None


def test_09_admin_a_requests_course_list(client, env_setup):
    """TEST 9: Admin A requests course list. Course A only."""
    res = client.get("/courses/", headers=env_setup["headers_a"])
    assert res.status_code == 200
    course_ids = [c["id"] for c in res.json()["courses"]]
    assert env_setup["course_a"]["id"] in course_ids
    assert env_setup["course_b"]["id"] not in course_ids


def test_10_admin_b_requests_course_list(client, env_setup):
    """TEST 10: Admin B requests course list. Course B only."""
    res = client.get("/courses/", headers=env_setup["headers_b"])
    assert res.status_code == 200
    course_ids = [c["id"] for c in res.json()["courses"]]
    assert env_setup["course_b"]["id"] in course_ids
    assert env_setup["course_a"]["id"] not in course_ids


def test_11_admin_b_attempts_to_access_course_a(client, env_setup):
    """TEST 11: Admin B attempts to access Course A directly by ID. Expected: Access denied (404/403)."""
    res = client.get(f"/courses/{env_setup['course_a']['id']}", headers=env_setup["headers_b"])
    assert res.status_code in (403, 404)


def test_12_admin_a_attempts_to_access_course_b(client, env_setup):
    """TEST 12: Admin A attempts to access Course B directly by ID. Expected: Access denied (404/403)."""
    res = client.get(f"/courses/{env_setup['course_b']['id']}", headers=env_setup["headers_a"])
    assert res.status_code in (403, 404)


def test_13_admin_b_attempts_to_modify_course_a(client, env_setup):
    """TEST 13: Admin B attempts to modify Course A. Expected: Access denied (404/403)."""
    res = client.put(f"/courses/{env_setup['course_a']['id']}", headers=env_setup["headers_b"], json={"title": "Hacked"})
    assert res.status_code in (403, 404)


def test_14_admin_b_attempts_to_modify_module_a(client, env_setup):
    """TEST 14: Admin B attempts to modify a module belonging to Admin A's course."""
    res = client.put(f"/courses/modules/{env_setup['module_a']['id']}", headers=env_setup["headers_b"], json={"title": "Hacked Mod"})
    assert res.status_code in (403, 404)


def test_15_admin_b_attempts_to_modify_quiz_a(client, env_setup):
    """TEST 15: Admin B attempts to modify a quiz belonging to Admin A's course."""
    res = client.put(f"/quizzes/{env_setup['quiz_a']['id']}", headers=env_setup["headers_b"], json={"title": "Hacked Quiz"})
    assert res.status_code in (403, 404)


def test_16_admin_a_dashboard_statistics(client, env_setup):
    """TEST 16: Admin A dashboard statistics contain only Admin A data."""
    res = client.get("/admin/dashboard", headers=env_setup["headers_a"])
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["total_courses"] == 1
    assert summary["total_students"] == 1


def test_17_admin_b_dashboard_statistics(client, env_setup):
    """TEST 17: Admin B dashboard statistics contain only Admin B data."""
    res = client.get("/admin/dashboard", headers=env_setup["headers_b"])
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["total_courses"] == 1
    assert summary["total_students"] == 1


def test_18_admin_a_activity_isolation(client, env_setup):
    """TEST 18: Admin A activity does not contain Admin B activity."""
    res = client.get("/admin/dashboard", headers=env_setup["headers_a"])
    assert res.status_code == 200
    course_titles = [c["title"] for c in res.json()["courses"]]
    assert "Course A" in course_titles
    assert "Course B" not in course_titles


def test_19_admin_b_activity_isolation(client, env_setup):
    """TEST 19: Admin B activity does not contain Admin A activity."""
    res = client.get("/admin/dashboard", headers=env_setup["headers_b"])
    assert res.status_code == 200
    course_titles = [c["title"] for c in res.json()["courses"]]
    assert "Course B" in course_titles
    assert "Course A" not in course_titles


def test_20_student_a_cannot_access_student_b_data(client, env_setup):
    """TEST 20: Student A cannot access Student B's private learning data."""
    res = client.get(f"/courses/student/{env_setup['student_b']['id']}", headers=env_setup["headers_st_a"])
    assert res.status_code in (403, 404)


def test_21_student_b_cannot_access_student_a_data(client, env_setup):
    """TEST 21: Student B cannot access Student A's private learning data."""
    res = client.get(f"/courses/student/{env_setup['student_a']['id']}", headers=env_setup["headers_st_b"])
    assert res.status_code in (403, 404)


def test_22_public_certificate_verification(client, env_setup):
    """TEST 22: Public certificate verification continues to work."""
    res = client.get("/certificates/verify/NONEXISTENT123")
    assert res.status_code == 404
    assert res.json()["detail"] == "Certificate not found. This certificate number is not valid."


# --- ADDITIONAL IDOR PROTECTION TESTS ---

def test_23_admin_b_cannot_assign_course_a_to_student_b(client, env_setup):
    """IDOR TEST: Admin B cannot assign Admin A's course to Student B."""
    res = client.post(
        f"/courses/{env_setup['course_a']['id']}/assign",
        headers=env_setup["headers_b"],
        json={"student_id": env_setup["student_b"]["id"]}
    )
    assert res.status_code in (403, 404)


def test_24_admin_b_cannot_activate_or_deactivate_student_a(client, env_setup):
    """IDOR TEST: Admin B cannot activate or deactivate Student A."""
    res_deact = client.patch(
        f"/admin/students/{env_setup['student_a']['id']}/deactivate",
        headers=env_setup["headers_b"]
    )
    assert res_deact.status_code in (403, 404)

    res_act = client.patch(
        f"/admin/students/{env_setup['student_a']['id']}/activate",
        headers=env_setup["headers_b"]
    )
    assert res_act.status_code in (403, 404)


def test_25_admin_b_cannot_create_module_in_course_a(client, env_setup):
    """IDOR TEST: Admin B cannot create a module inside Admin A's course."""
    res = client.post(
        f"/courses/{env_setup['course_a']['id']}/modules",
        headers=env_setup["headers_b"],
        json={"title": "Unauthorized Mod", "description": "Desc", "module_order": 2}
    )
    assert res.status_code in (403, 404)


def test_26_admin_b_cannot_view_student_a_certificates(client, env_setup):
    """IDOR TEST: Admin B cannot retrieve certificates for Student A."""
    res = client.get(
        f"/certificates/student/{env_setup['student_a']['id']}",
        headers=env_setup["headers_b"]
    )
    assert res.status_code in (403, 404)
