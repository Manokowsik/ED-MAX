import jwt
from fastapi import APIRouter, HTTPException, Response, Request
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.auth import (
    LoginRequest,
    VerifyOTPRequest,
    ResendOTPRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ActivateAccountRequest,
    ResendActivationRequest,
    AcceptInvitationRequest,
    TestEmailRequest,
)
from app.services.auth_service import AuthService
from app.core.config import APP_ENV, REFRESH_TOKEN_EXPIRE_DAYS
from app.core.security import create_access_token, create_refresh_token, decode_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


password_hash = PasswordHash.recommended()


def get_cookie_settings():
    """
    Determines cookie settings based on environment:
    - Production (HTTPS): secure=True, samesite="none" (or "lax")
    - Development (HTTP): secure=False, samesite="lax"
    Note: Browsers reject SameSite=None if secure=False.
    """
    is_prod = APP_ENV.lower() in ("production", "prod")
    return {
        "secure": is_prod,
        "samesite": "none" if is_prod else "lax",
    }


# ============================================================
# Login
# ============================================================

@router.post("/login")
def login(login_data: LoginRequest, response: Response):

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                password_hash,
                role,
                organization_id,
                is_verified,
                token_version,
                is_active,
                deleted_at
            FROM users
            WHERE LOWER(email) = LOWER(%s)
            """,
            (login_data.email.strip(),)
        )

        user = cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Account does not exist"
        )

    if not user[8] or user[9] is not None:
        raise HTTPException(
            status_code=401,
            detail="Account is inactive or disabled. Please contact your administrator."
        )

    if not password_hash.verify(
        login_data.password,
        user[3]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid password. Please try again."
        )

    if not user[6]:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please verify your email before logging in."
        )

    access_token = create_access_token(
        user_id=user[0],
        email=user[2],
        role=user[4],
        organization_id=user[5],
        token_version=user[7]
    )

    refresh_token = create_refresh_token(
        user_id=user[0],
        email=user[2],
        role=user[4],
        organization_id=user[5],
        token_version=user[7]
    )

    cookie_opts = get_cookie_settings()
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=cookie_opts["secure"],
        samesite=cookie_opts["samesite"],
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user[0],
            "name": user[1],
            "email": user[2],
            "role": user[4],
            "organization_id": user[5]
        }
    }


# ============================================================
# Email Verification (OTP)
# ============================================================

@router.post("/verify-email")
def verify_email(data: VerifyOTPRequest):
    conn = get_connection()
    try:
        return AuthService.verify_email_otp(conn, data.email, data.otp)
    finally:
        conn.close()


@router.post("/resend-otp")
def resend_otp(data: ResendOTPRequest):
    conn = get_connection()
    try:
        return AuthService.resend_email_otp(conn, data.email)
    finally:
        conn.close()


# ============================================================
# Forgot & Reset Password
# ============================================================

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    conn = get_connection()
    try:
        return AuthService.request_password_reset(conn, data.email)
    finally:
        conn.close()


@router.get("/validate-reset-token")
def validate_reset_token(token: str):
    conn = get_connection()
    try:
        return AuthService.validate_reset_token(conn, token)
    finally:
        conn.close()


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    conn = get_connection()
    try:
        return AuthService.reset_password(
            conn,
            token=data.token,
            password=data.password,
            confirm_password=data.confirm_password
        )
    finally:
        conn.close()


# ============================================================
# Student Account Activation
# ============================================================

@router.get("/validate-activation-token")
def validate_activation_token(token: str):
    conn = get_connection()
    try:
        return AuthService.validate_activation_token(conn, token)
    finally:
        conn.close()


@router.post("/activate-account")
def activate_account(data: ActivateAccountRequest):
    conn = get_connection()
    try:
        result = AuthService.activate_student_account(
            conn,
            token=data.token,
            password=data.password,
            confirm_password=data.confirm_password
        )
        # No session cookie is set — the student must log in normally after activation.
        return result
    finally:
        conn.close()


@router.post("/resend-activation")
def resend_activation(data: ResendActivationRequest):
    """Resend activation email for a pending student account.

    Always returns a generic success message to prevent email enumeration.
    Rate-limited by a per-user cooldown window.
    """
    conn = get_connection()
    try:
        return AuthService.resend_student_activation(conn, data.email)
    finally:
        conn.close()


# ============================================================
# Organization Invitation (existing user → new org)
# ============================================================

@router.get("/validate-invitation-token")
def validate_invitation_token(token: str):
    """
    Validates an org invitation token and returns user + org info.
    Called by the /accept-invitation frontend page on mount.
    """
    conn = get_connection()
    try:
        return AuthService.validate_org_invitation_token(conn, token)
    finally:
        conn.close()


@router.post("/accept-invitation")
def accept_invitation(data: AcceptInvitationRequest):
    """
    Accepts an org invitation token: inserts/activates the organization_membership
    row and marks the token as used. The user does NOT need to set a password —
    they already have one.
    """
    conn = get_connection()
    try:
        return AuthService.accept_org_invitation(conn, data.token)
    finally:
        conn.close()


@router.post("/test-email")
def test_email(data: TestEmailRequest):
    """
    Diagnostic endpoint to test real SMTP email delivery.
    Sends a test email to the specified address and returns success only if SMTP delivery succeeds.
    """
    from app.services.email_service import EmailService
    try:
        success = EmailService.send_test_email(data.email)
        if success:
            return {"message": f"SMTP test email sent successfully to {data.email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send test email")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_access_token(request: Request):
    # 1. Try to get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")

    # 2. Fallback: check JSON body or Authorization header if cookie was missing
    if not refresh_token:
        try:
            body = await request.json()
            refresh_token = body.get("refresh_token")
        except Exception:
            pass

    if not refresh_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token = auth_header.split(" ")[1]

    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except (jwt.InvalidTokenError, HTTPException, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, name, email, role, organization_id, is_active, deleted_at, token_version
            FROM users
            WHERE id = %s
            """,
            (int(user_id),)
        )
        user = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if not user or not user[5] or user[6] is not None:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    if payload.get("tv") is not None and user[7] != payload.get("tv"):
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    access_token = create_access_token(
        user_id=user[0],
        email=user[2],
        role=user[3],
        organization_id=user[4],
        token_version=user[7]
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user[0],
            "name": user[1],
            "email": user[2],
            "role": user[3],
            "organization_id": user[4],
        }
    }


@router.post("/logout")
def logout(response: Response):
    cookie_opts = get_cookie_settings()
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        secure=cookie_opts["secure"],
        samesite=cookie_opts["samesite"],
    )
    return {"message": "Logged out successfully"}

