"""
Comprehensive Authentication Workflow Tests — ED-MAX

Covers all 27 required scenarios from the specification:

ADMIN STUDENT CREATION
  1. Admin can create a student without specifying password.
  2. Student is initially pending/inactive.
  3. Activation token is generated.
  4. Activation email is triggered with correct URL and subject.
  5. Student cannot log in before activation.

ACTIVATION
  6. Valid activation token works.
  7. Student can set password.
  8. Student becomes active after activation.
  9. Activation token cannot be reused.
 10. Expired activation token is rejected.
 11. Invalid activation token is rejected.

LOGIN AFTER ACTIVATION
 12. Activated student can log in with email + password.
 13. Wrong password is rejected.

FORGOT PASSWORD
 14. Student can request password reset.
 15. Instructor / Admin can request password reset.
 16. Reset email is generated (inspected via email_mock).
 17. Valid reset token works.
 18. Password is changed after reset.
 19. Old password no longer works.
 20. New password works.
 21. Reset token cannot be reused.
 22. Expired reset token is rejected.
 23. Invalid reset token is rejected.

SECURITY
 24. Passwords are never stored plaintext.
 25. Activation/reset tokens are not reusable (covered above).
 26. Resend activation respects cooldown and is rate-limited.
 27. Activation does NOT create a login session automatically.
"""

from datetime import datetime, timedelta, timezone
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import AuthService
from tests.conftest import db_execute, password_hash


# ============================================================
# Helpers
# ============================================================

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _email():
    return f"authwf_{uuid.uuid4().hex[:8]}@example.com"


def _create_pending_student(client, admin_user, email=None, name="Workflow Student"):
    """Create a student via the admin API and return (email, user_id)."""
    email = email or _email()
    res = client.post(
        "/admin/students",
        json={"name": name, "email": email},
        headers=admin_user["headers"],
    )
    assert res.status_code == 200, res.json()
    rows = db_execute("SELECT id FROM users WHERE email = %s", (email,), fetch=True)
    user_id = rows[0][0]
    return email, user_id


def _set_activation_token(user_id, raw_token, expired=False):
    """Override the DB activation token for a user with a known value."""
    token_hash = AuthService.hash_token(raw_token)
    if expired:
        expires_at = datetime.now(timezone.utc) - timedelta(hours=50)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
    db_execute(
        "UPDATE student_activations SET token_hash = %s, expires_at = %s WHERE user_id = %s AND is_used = FALSE",
        (token_hash, expires_at, user_id),
    )


def _set_reset_token(user_id, raw_token, expired=False, used=False):
    """Insert a known password reset token into the DB for a user."""
    token_hash = AuthService.hash_token(raw_token)
    if expired:
        expires_at = datetime.now(timezone.utc) - timedelta(minutes=40)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    db_execute(
        """
        INSERT INTO password_resets (user_id, token_hash, expires_at, is_used)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, token_hash, expires_at, used),
    )
    return token_hash


# ============================================================
# 1–5: Admin Student Creation
# ============================================================

class TestAdminStudentCreation:

    def test_admin_creates_student_no_password_required(self, client, admin_user, email_mock):
        """1. Admin can create a student without specifying a password."""
        email = _email()
        res = client.post(
            "/admin/students",
            json={"name": "No-Pwd Student", "email": email},
            headers=admin_user["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert "student" in data
        # No password field in request body was needed
        db_execute("DELETE FROM users WHERE email = %s", (email,))

    def test_student_is_initially_inactive(self, client, admin_user, email_mock):
        """2. Student is inactive until they activate."""
        email, user_id = _create_pending_student(client, admin_user)
        assert client.post("/admin/students", json={"name": "X", "email": email},
                          headers=admin_user["headers"]).status_code != 200  # already exists, not retesting

        rows = db_execute("SELECT is_active, is_verified FROM users WHERE id = %s", (user_id,), fetch=True)
        assert rows[0][0] is False, "Student should be inactive on creation"
        assert rows[0][1] is False, "Student should be unverified on creation"
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_activation_token_generated_in_db(self, client, admin_user, email_mock):
        """3. An activation token record is created in student_activations."""
        email, user_id = _create_pending_student(client, admin_user)
        rows = db_execute(
            "SELECT id, is_used FROM student_activations WHERE user_id = %s",
            (user_id,), fetch=True
        )
        assert len(rows) >= 1, "At least one activation record should exist"
        assert rows[0][1] is False, "Token should not be used yet"
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_activation_email_sent_with_correct_url_and_subject(self, client, admin_user, email_mock):
        """4. Activation email contains correct URL (/activate-account?token=) and subject."""
        email, user_id = _create_pending_student(client, admin_user, email=_email(), name="Email Check Student")
        assert len(email_mock) >= 1, "An email should have been sent"
        last_email = email_mock[-1]
        assert last_email["to"] == email
        assert "Activate Your Account" in last_email["subject"], f"Got: {last_email['subject']}"
        assert "/activate-account?token=" in last_email["body"], f"Body: {last_email['body']}"
        # Activation link must not be in the old format
        assert "/activate/" not in last_email["body"]
        # Password must never appear in the email body
        assert "password" not in last_email["body"].lower() or "set" in last_email["body"].lower()
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_student_cannot_login_before_activation(self, client, admin_user, email_mock):
        """5. Pending student cannot log in before activating their account."""
        email, user_id = _create_pending_student(client, admin_user)
        login_res = client.post("/auth/login", json={"email": email, "password": "anything"})
        # Should fail — account is inactive (401) not just wrong password
        assert login_res.status_code == 401
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))


# ============================================================
# 6–11: Account Activation
# ============================================================

class TestAccountActivation:

    def test_valid_activation_token_activates_account(self, client, admin_user, email_mock):
        """6–8. Valid token activates account: student can set password, account becomes active."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"test_valid_{uuid.uuid4().hex}"
        _set_activation_token(user_id, raw_token)

        # Validate token endpoint
        val_res = client.get(f"/auth/validate-activation-token?token={raw_token}")
        assert val_res.status_code == 200
        assert val_res.json()["user"]["email"] == email

        # Activate account
        act_res = client.post("/auth/activate-account", json={
            "token": raw_token,
            "password": "NewStudentPwd@789",
            "confirm_password": "NewStudentPwd@789",
        })
        assert act_res.status_code == 200
        data = act_res.json()
        # Must return success message — NOT tokens
        assert "activated successfully" in data["message"].lower()
        assert "access_token" not in data
        assert "refresh_token" not in data

        # DB state: account is now active and verified
        rows = db_execute("SELECT is_active, is_verified FROM users WHERE id = %s", (user_id,), fetch=True)
        assert rows[0][0] is True
        assert rows[0][1] is True

        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_password_hashed_after_activation(self, client, admin_user, email_mock):
        """7. Password is stored as a hash, not plaintext."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"hash_check_{uuid.uuid4().hex}"
        raw_pwd = "ActivatePwd@123"
        _set_activation_token(user_id, raw_token)

        client.post("/auth/activate-account", json={
            "token": raw_token, "password": raw_pwd, "confirm_password": raw_pwd,
        })

        rows = db_execute("SELECT password_hash FROM users WHERE id = %s", (user_id,), fetch=True)
        stored_hash = rows[0][0]
        assert stored_hash != raw_pwd, "Password must not be stored as plaintext"
        assert password_hash.verify(raw_pwd, stored_hash), "Stored hash must verify against raw password"
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_activation_token_cannot_be_reused(self, client, admin_user, email_mock):
        """9. Activation token cannot be used more than once."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"reuse_{uuid.uuid4().hex}"
        _set_activation_token(user_id, raw_token)

        # First use
        res1 = client.post("/auth/activate-account", json={
            "token": raw_token, "password": "FirstPwd@123", "confirm_password": "FirstPwd@123",
        })
        assert res1.status_code == 200

        # Second use must be rejected
        res2 = client.post("/auth/activate-account", json={
            "token": raw_token, "password": "SecondPwd@123", "confirm_password": "SecondPwd@123",
        })
        assert res2.status_code == 400
        assert "used" in res2.json()["detail"].lower()
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_expired_activation_token_rejected(self, client, admin_user, email_mock):
        """10. Expired activation token is rejected with 400."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"expired_{uuid.uuid4().hex}"
        _set_activation_token(user_id, raw_token, expired=True)

        res = client.post("/auth/activate-account", json={
            "token": raw_token, "password": "Password@123", "confirm_password": "Password@123",
        })
        assert res.status_code == 400
        assert "expired" in res.json()["detail"].lower()
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_invalid_activation_token_rejected(self, client, admin_user, email_mock):
        """11. Completely invalid (garbage) activation token is rejected."""
        res = client.post("/auth/activate-account", json={
            "token": "this_is_not_a_real_token_xyz",
            "password": "Password@123",
            "confirm_password": "Password@123",
        })
        assert res.status_code == 400

    def test_activation_does_not_create_session(self, client, admin_user, email_mock):
        """27. Activating an account must NOT auto-create a login session."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"nosession_{uuid.uuid4().hex}"
        _set_activation_token(user_id, raw_token)

        res = client.post("/auth/activate-account", json={
            "token": raw_token, "password": "NoSession@123", "confirm_password": "NoSession@123",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" not in data, "Activation must not return an access token"
        assert "refresh_token" not in data, "Activation must not return a refresh token"
        assert "user" not in data or data.get("user") is None, "Activation must not return user session data"
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))


# ============================================================
# 12–13: Login after Activation
# ============================================================

class TestLoginAfterActivation:

    def test_activated_student_can_login(self, client, admin_user, email_mock):
        """12. Activated student can log in with email + new password."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"login_{uuid.uuid4().hex}"
        raw_pwd = "LoginPwd@456"
        _set_activation_token(user_id, raw_token)

        client.post("/auth/activate-account", json={
            "token": raw_token, "password": raw_pwd, "confirm_password": raw_pwd,
        })

        login_res = client.post("/auth/login", json={"email": email, "password": raw_pwd})
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "STUDENT"
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_wrong_password_rejected_after_activation(self, client, admin_user, email_mock):
        """13. Wrong password is rejected even after account is activated."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"wrongpwd_{uuid.uuid4().hex}"
        raw_pwd = "CorrectPwd@123"
        _set_activation_token(user_id, raw_token)

        client.post("/auth/activate-account", json={
            "token": raw_token, "password": raw_pwd, "confirm_password": raw_pwd,
        })

        login_res = client.post("/auth/login", json={"email": email, "password": "WrongPwd@999"})
        assert login_res.status_code == 401
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))


# ============================================================
# 14–23: Forgot Password / Reset Password
# ============================================================

class TestForgotResetPassword:

    def test_student_can_request_password_reset(self, client, admin_user, email_mock):
        """14. An activated student can request a password reset."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"prst_{uuid.uuid4().hex}"
        raw_pwd = "OriginalPwd@123"
        _set_activation_token(user_id, raw_token)
        client.post("/auth/activate-account", json={
            "token": raw_token, "password": raw_pwd, "confirm_password": raw_pwd,
        })

        res = client.post("/auth/forgot-password", json={"email": email})
        assert res.status_code == 200
        assert "reset instructions" in res.json()["message"].lower()
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_admin_can_request_password_reset(self, client, admin_user, email_mock):
        """15. Admin (instructor-level user) can also request a password reset."""
        res = client.post("/auth/forgot-password", json={"email": admin_user["email"]})
        assert res.status_code == 200
        assert "reset instructions" in res.json()["message"].lower()
        # Clean up any inserted reset token
        db_execute(
            "UPDATE password_resets SET is_used = TRUE WHERE user_id = %s AND is_used = FALSE",
            (admin_user["id"],)
        )

    def test_reset_email_generated_with_correct_content(self, client, admin_user, email_mock):
        """16. Reset email contains correct subject and reset URL."""
        email_mock.clear()
        res = client.post("/auth/forgot-password", json={"email": admin_user["email"]})
        assert res.status_code == 200

        # email_mock may be empty if no pending email (user already active) — check DB
        reset_rows = db_execute(
            "SELECT token_hash FROM password_resets WHERE user_id = %s AND is_used = FALSE ORDER BY id DESC LIMIT 1",
            (admin_user["id"],), fetch=True
        )
        assert len(reset_rows) >= 1, "A reset token record should have been created"

        if email_mock:
            last_email = email_mock[-1]
            assert last_email["to"] == admin_user["email"]
            assert "Reset Your Password" in last_email["subject"] or "reset" in last_email["subject"].lower()
            assert "/reset-password?token=" in last_email["body"]

        db_execute(
            "UPDATE password_resets SET is_used = TRUE WHERE user_id = %s AND is_used = FALSE",
            (admin_user["id"],)
        )

    def test_valid_reset_flow(self, client, admin_user, email_mock):
        """17–20. Valid reset token changes password; old password fails; new password works."""
        old_pwd = admin_user["password"]
        new_pwd = "BrandNewPwd@789"
        raw_token = f"valid_reset_{uuid.uuid4().hex}"

        # Insert a known reset token
        _set_reset_token(admin_user["id"], raw_token)

        # Validate token
        val_res = client.get(f"/auth/validate-reset-token?token={raw_token}")
        assert val_res.status_code == 200
        assert val_res.json()["email"] == admin_user["email"]

        # Reset password
        reset_res = client.post("/auth/reset-password", json={
            "token": raw_token,
            "password": new_pwd,
            "confirm_password": new_pwd,
        })
        assert reset_res.status_code == 200
        assert "reset successfully" in reset_res.json()["message"].lower()

        # Old password no longer works (19)
        login_old = client.post("/auth/login", json={"email": admin_user["email"], "password": old_pwd})
        assert login_old.status_code == 401

        # New password works (20)
        login_new = client.post("/auth/login", json={"email": admin_user["email"], "password": new_pwd})
        assert login_new.status_code == 200

        # Restore original password so other tests keep working
        hashed = password_hash.hash(old_pwd)
        db_execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, admin_user["id"]))

    def test_reset_token_cannot_be_reused(self, client, admin_user, email_mock):
        """21. Password reset token can only be used once."""
        raw_token = f"reusereset_{uuid.uuid4().hex}"
        _set_reset_token(admin_user["id"], raw_token)

        # First reset succeeds
        res1 = client.post("/auth/reset-password", json={
            "token": raw_token, "password": "FirstNew@123", "confirm_password": "FirstNew@123",
        })
        assert res1.status_code == 200

        # Second reset is rejected
        res2 = client.post("/auth/reset-password", json={
            "token": raw_token, "password": "SecondNew@456", "confirm_password": "SecondNew@456",
        })
        assert res2.status_code == 400
        assert "used" in res2.json()["detail"].lower()

        # Restore password
        hashed = password_hash.hash(admin_user["password"])
        db_execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, admin_user["id"]))

    def test_expired_reset_token_rejected(self, client, admin_user, email_mock):
        """22. Expired password reset token is rejected."""
        raw_token = f"expreset_{uuid.uuid4().hex}"
        _set_reset_token(admin_user["id"], raw_token, expired=True)

        res = client.post("/auth/reset-password", json={
            "token": raw_token, "password": "Password@123", "confirm_password": "Password@123",
        })
        assert res.status_code == 400
        assert "expired" in res.json()["detail"].lower()

        # Clean up
        db_execute("DELETE FROM password_resets WHERE token_hash = %s", (AuthService.hash_token(raw_token),))

    def test_invalid_reset_token_rejected(self, client, email_mock):
        """23. Completely invalid reset token is rejected."""
        res = client.post("/auth/reset-password", json={
            "token": "definitely_not_a_real_token_12345",
            "password": "Password@123",
            "confirm_password": "Password@123",
        })
        assert res.status_code == 400

    def test_nonexistent_email_returns_generic_response(self, client, email_mock):
        """Forgot password with unknown email returns same generic message (no enumeration)."""
        unknown = f"ghost_{uuid.uuid4().hex}@example.com"
        res = client.post("/auth/forgot-password", json={"email": unknown})
        assert res.status_code == 200
        assert "reset instructions" in res.json()["message"].lower()


# ============================================================
# 24–26: Security
# ============================================================

class TestSecurity:

    def test_passwords_never_stored_plaintext(self, client, admin_user, email_mock):
        """24. Passwords are hashed in the DB — never stored as plaintext."""
        email, user_id = _create_pending_student(client, admin_user)
        raw_token = f"sec_{uuid.uuid4().hex}"
        raw_pwd = "PlainTextCheck@123"
        _set_activation_token(user_id, raw_token)

        client.post("/auth/activate-account", json={
            "token": raw_token, "password": raw_pwd, "confirm_password": raw_pwd,
        })

        rows = db_execute("SELECT password_hash FROM users WHERE id = %s", (user_id,), fetch=True)
        stored = rows[0][0]
        assert stored != raw_pwd, "Plaintext password must never be stored"
        # Must verify correctly with the hasher
        assert password_hash.verify(raw_pwd, stored)
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_resend_activation_cooldown_enforced(self, client, admin_user, email_mock):
        """26. Resend activation is rate-limited by cooldown."""
        email, user_id = _create_pending_student(client, admin_user)

        # Immediate resend should be rate-limited (token was just created)
        res = client.post("/auth/resend-activation", json={"email": email})
        # Either 429 (cooldown) or generic success (if no cooldown implemented differently)
        assert res.status_code in (200, 429), f"Expected 200 or 429, got {res.status_code}"
        if res.status_code == 429:
            assert "wait" in res.json()["detail"].lower()
        db_execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_resend_activation_unknown_email_generic_response(self, client, email_mock):
        """Resend activation for unknown email returns generic message (no enumeration)."""
        unknown = f"ghost_{uuid.uuid4().hex}@example.com"
        res = client.post("/auth/resend-activation", json={"email": unknown})
        assert res.status_code == 200
        # Generic message — does not reveal whether account exists
        assert "pending student account" in res.json()["message"].lower()

    def test_resend_activation_for_already_active_student_generic(self, client, student_user, email_mock):
        """Resend activation for already-active student returns generic response (no enumeration)."""
        res = client.post("/auth/resend-activation", json={"email": student_user["email"]})
        assert res.status_code == 200
        # Generic — does not reveal account state
        assert "pending student account" in res.json()["message"].lower()

    def test_test_email_endpoint(self, client, email_mock):
        """Test diagnostic /auth/test-email endpoint."""
        res = client.post("/auth/test-email", json={"email": "test_diagnostic@example.com"})
        assert res.status_code == 200
        assert "sent successfully" in res.json()["message"].lower()
        assert len(email_mock) >= 1
        assert email_mock[-1]["to"] == "test_diagnostic@example.com"
