"""
User Profile, Password Change & Account Deactivation Tests
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


class TestProfileManagement:

    def test_get_own_profile_student(self, client, student_user):
        """Authenticated student can retrieve their own profile."""
        res = client.get("/users/me", headers=student_user["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "user" in data
        assert data["user"]["id"] == student_user["id"]
        assert data["user"]["email"] == student_user["email"]
        assert data["user"]["role"] == "STUDENT"
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

    def test_get_own_profile_admin(self, client, admin_user):
        """Authenticated admin can retrieve their own profile."""
        res = client.get("/users/me", headers=admin_user["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["id"] == admin_user["id"]
        assert data["user"]["email"] == admin_user["email"]
        assert data["user"]["role"] == "ADMIN"

    def test_get_profile_unauthenticated(self, client):
        """Unauthenticated request to profile returns 401."""
        res = client.get("/users/me")
        assert res.status_code == 401

    def test_update_own_profile(self, client, student_user):
        """Authenticated user can update their own display name."""
        new_name = f"Updated Name {uuid.uuid4().hex[:6]}"
        res = client.patch(
            "/users/me",
            json={"name": new_name},
            headers=student_user["headers"]
        )
        assert res.status_code == 200
        assert res.json()["user"]["name"] == new_name

        # Verify persisted in database
        check = client.get("/users/me", headers=student_user["headers"])
        assert check.json()["user"]["name"] == new_name

    def test_update_profile_blank_name_rejected(self, client, student_user):
        """Empty or blank name is rejected with 422."""
        res = client.patch(
            "/users/me",
            json={"name": "   "},
            headers=student_user["headers"]
        )
        assert res.status_code == 422

    def test_update_profile_email_is_protected(self, client, student_user):
        """Email cannot be modified via profile update endpoint."""
        original_email = student_user["email"]
        res = client.patch(
            "/users/me",
            json={"name": "Valid Name", "email": "hacked@example.com"},
            headers=student_user["headers"]
        )
        assert res.status_code == 200
        assert res.json()["user"]["email"] == original_email

    def test_api_prefix_compatibility(self, client, student_user):
        """Both /users/me and /api/users/me resolve correctly."""
        res = client.get("/api/users/me", headers=student_user["headers"])
        assert res.status_code == 200
        assert res.json()["user"]["id"] == student_user["id"]


class TestPasswordChange:

    def test_change_password_success(self, client, admin_user):
        """User can change password when supplying correct current password."""
        suffix = uuid.uuid4().hex[:6]
        email = f"pwdtest_{suffix}@example.com"
        old_pwd = "OldPassword@123"
        new_pwd = "NewPassword@456"
        hashed = password_hash.hash(old_pwd)

        rows = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version)
            VALUES (%s, %s, %s, 'STUDENT', TRUE, %s, 1)
            RETURNING id
            """,
            (f"Pwd Test {suffix}", email, hashed, admin_user["organization_id"]),
            fetch=True
        )
        user_id = rows[0][0]
        token = create_access_token(user_id=user_id, email=email, role="STUDENT", organization_id=admin_user["organization_id"], token_version=1)
        headers = {"Authorization": f"Bearer {token}"}

        try:
            # Change password
            res = client.post(
                "/users/me/change-password",
                json={
                    "current_password": old_pwd,
                    "new_password": new_pwd,
                    "confirm_password": new_pwd
                },
                headers=headers
            )
            assert res.status_code == 200
            assert "successfully" in res.json()["message"]

            # Old password should no longer work for login
            old_login = client.post("/auth/login", json={"email": email, "password": old_pwd})
            assert old_login.status_code == 401

            # New password works for login
            new_login = client.post("/auth/login", json={"email": email, "password": new_pwd})
            assert new_login.status_code == 200

            # Old access token is now invalidated (token version changed in DB)
            old_token_req = client.get("/users/me", headers=headers)
            assert old_token_req.status_code == 401

        finally:
            db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_change_password_incorrect_current_password(self, client, student_user):
        """Supplying wrong current password returns 400."""
        res = client.post(
            "/users/me/change-password",
            json={
                "current_password": "WrongPassword999",
                "new_password": "ValidNewPassword@123",
                "confirm_password": "ValidNewPassword@123"
            },
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "Current password is incorrect" in res.json()["detail"]

    def test_change_password_mismatched_confirmation(self, client, student_user):
        """Mismatched new passwords returns 400."""
        res = client.post(
            "/users/me/change-password",
            json={
                "current_password": student_user["password"],
                "new_password": "NewPassword@123",
                "confirm_password": "DifferentPassword@123"
            },
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "match" in res.json()["detail"]

    def test_change_password_too_short(self, client, student_user):
        """Password shorter than 8 characters is rejected."""
        res = client.post(
            "/users/me/change-password",
            json={
                "current_password": student_user["password"],
                "new_password": "short",
                "confirm_password": "short"
            },
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "8 characters" in res.json()["detail"]

    def test_change_password_same_as_current(self, client, student_user):
        """Reusing the current password is rejected."""
        res = client.post(
            "/users/me/change-password",
            json={
                "current_password": student_user["password"],
                "new_password": student_user["password"],
                "confirm_password": student_user["password"]
            },
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "different" in res.json()["detail"]


class TestAccountDeactivation:

    def test_student_deactivate_own_account(self, client, admin_user):
        """Student can deactivate their own account with DELETE confirmation."""
        suffix = uuid.uuid4().hex[:6]
        email = f"deact_st_{suffix}@example.com"
        pwd = "StudentPassword@123"
        hashed = password_hash.hash(pwd)

        rows = db_execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version)
            VALUES (%s, %s, %s, 'STUDENT', TRUE, %s, 1)
            RETURNING id
            """,
            (f"Deact Student {suffix}", email, hashed, admin_user["organization_id"]),
            fetch=True
        )
        st_id = rows[0][0]
        token = create_access_token(user_id=st_id, email=email, role="STUDENT", organization_id=admin_user["organization_id"], token_version=1)
        headers = {"Authorization": f"Bearer {token}"}

        try:
            # Deactivate
            res = client.request(
                "DELETE",
                "/users/me",
                json={"confirmation": "DELETE", "current_password": pwd},
                headers=headers
            )
            assert res.status_code == 200
            assert "deactivated" in res.json()["message"]

            # Cannot log in anymore
            login_res = client.post("/auth/login", json={"email": email, "password": pwd})
            assert login_res.status_code == 401

            # Token is immediately rejected
            after_req = client.get("/users/me", headers=headers)
            assert after_req.status_code == 401

            # Verify in DB: soft deleted, not hard deleted
            db_row = db_execute("SELECT is_active, deleted_at FROM users WHERE id = %s", (st_id,), fetch=True)[0]
            assert db_row[0] is False
            assert db_row[1] is not None

        finally:
            db_execute("DELETE FROM users WHERE id = %s", (st_id,))

    def test_deactivate_requires_delete_confirmation_keyword(self, client, student_user):
        """Failing to type DELETE exactly is rejected."""
        res = client.request(
            "DELETE",
            "/users/me",
            json={"confirmation": "delete", "current_password": student_user["password"]},
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "DELETE" in res.json()["detail"]

    def test_deactivate_wrong_password_rejected(self, client, student_user):
        """Incorrect password during deletion is rejected."""
        res = client.request(
            "DELETE",
            "/users/me",
            json={"confirmation": "DELETE", "current_password": "WrongPassword999"},
            headers=student_user["headers"]
        )
        assert res.status_code == 400
        assert "password is incorrect" in res.json()["detail"]

    def test_last_admin_cannot_delete_account(self, client, admin_user):
        """Sole administrator cannot delete their account (409 Conflict)."""
        res = client.request(
            "DELETE",
            "/users/me",
            json={"confirmation": "DELETE", "current_password": admin_user["password"]},
            headers=admin_user["headers"]
        )
        assert res.status_code == 409
        assert "last administrator" in res.json()["detail"]

    def test_admin_deletion_allowed_if_another_admin_exists(self, client):
        """Admin can delete own account if another admin exists in the organization."""
        suffix = uuid.uuid4().hex[:6]
        # Create organization
        org_rows = db_execute("INSERT INTO organizations (name) VALUES (%s) RETURNING id", (f"MultiAdmin Org {suffix}",), fetch=True)
        org_id = org_rows[0][0]

        pwd = "AdminPassword@123"
        hashed = password_hash.hash(pwd)

        # Admin 1 & Admin 2
        a1 = db_execute(
            "INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version) VALUES (%s, %s, %s, 'ADMIN', TRUE, %s, 1) RETURNING id",
            (f"Admin 1 {suffix}", f"admin1_{suffix}@example.com", hashed, org_id),
            fetch=True
        )[0][0]

        a2 = db_execute(
            "INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version) VALUES (%s, %s, %s, 'ADMIN', TRUE, %s, 1) RETURNING id",
            (f"Admin 2 {suffix}", f"admin2_{suffix}@example.com", hashed, org_id),
            fetch=True
        )[0][0]

        token1 = create_access_token(user_id=a1, email=f"admin1_{suffix}@example.com", role="ADMIN", organization_id=org_id, token_version=1)
        headers1 = {"Authorization": f"Bearer {token1}"}

        try:
            # Admin 1 deletes account — should succeed because Admin 2 exists
            del_res = client.request(
                "DELETE",
                "/users/me",
                json={"confirmation": "DELETE", "current_password": pwd},
                headers=headers1
            )
            assert del_res.status_code == 200

            # Organization still intact!
            org_check = db_execute("SELECT id FROM organizations WHERE id = %s", (org_id,), fetch=True)
            assert len(org_check) == 1

            # Admin 2 still active
            a2_check = db_execute("SELECT is_active, deleted_at FROM users WHERE id = %s", (a2,), fetch=True)
            assert a2_check[0][0] is True
            assert a2_check[0][1] is None

        finally:
            db_execute("DELETE FROM users WHERE organization_id = %s", (org_id,))
            db_execute("DELETE FROM organizations WHERE id = %s", (org_id,))


class TestOrganizationIsolationOnProfile:

    def test_org_a_cannot_view_or_modify_org_b_profile(self, client):
        """Cross-tenant user isolation: users cannot access or edit other tenants."""
        suffix = uuid.uuid4().hex[:6]
        # Create Org A and Org B
        org_a = db_execute("INSERT INTO organizations (name) VALUES (%s) RETURNING id", (f"Org A {suffix}",), fetch=True)[0][0]
        org_b = db_execute("INSERT INTO organizations (name) VALUES (%s) RETURNING id", (f"Org B {suffix}",), fetch=True)[0][0]

        pwd = "TestPassword@123"
        hashed = password_hash.hash(pwd)

        u_a = db_execute(
            "INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version) VALUES (%s, %s, %s, 'STUDENT', TRUE, %s, 1) RETURNING id",
            ("User A", f"ua_{suffix}@example.com", hashed, org_a), fetch=True
        )[0][0]

        u_b = db_execute(
            "INSERT INTO users (name, email, password_hash, role, is_active, organization_id, token_version) VALUES (%s, %s, %s, 'STUDENT', TRUE, %s, 1) RETURNING id",
            ("User B", f"ub_{suffix}@example.com", hashed, org_b), fetch=True
        )[0][0]

        token_a = create_access_token(user_id=u_a, email=f"ua_{suffix}@example.com", role="STUDENT", organization_id=org_a, token_version=1)
        token_b = create_access_token(user_id=u_b, email=f"ub_{suffix}@example.com", role="STUDENT", organization_id=org_b, token_version=1)

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        try:
            # GET /users/me always returns self, never cross-tenant
            res_a = client.get("/users/me", headers=headers_a).json()
            res_b = client.get("/users/me", headers=headers_b).json()
            assert res_a["user"]["id"] == u_a
            assert res_a["user"]["organization_id"] == org_a
            assert res_b["user"]["id"] == u_b
            assert res_b["user"]["organization_id"] == org_b

            # PATCH /users/me modifies only self
            client.patch("/users/me", json={"name": "Updated User A"}, headers=headers_a)
            b_check = client.get("/users/me", headers=headers_b).json()
            assert b_check["user"]["name"] == "User B"

        finally:
            db_execute("DELETE FROM users WHERE organization_id IN (%s, %s)", (org_a, org_b))
            db_execute("DELETE FROM organizations WHERE id IN (%s, %s)", (org_a, org_b))
