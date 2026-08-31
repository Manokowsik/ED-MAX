import jwt
from fastapi import APIRouter, HTTPException, Response, Request
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.auth import LoginRequest
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
                organization_id
            FROM users
            WHERE email = %s
            AND is_active = TRUE
            """,
            (login_data.email,)
        )

        user = cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not password_hash.verify(
        login_data.password,
        user[3]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        user_id=user[0],
        email=user[2],
        role=user[4],
        organization_id=user[5]
    )

    refresh_token = create_refresh_token(
        user_id=user[0],
        email=user[2],
        role=user[4],
        organization_id=user[5]
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
            SELECT id, name, email, role, organization_id, is_active
            FROM users
            WHERE id = %s
            """,
            (int(user_id),)
        )
        user = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if not user or not user[5]:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again."
        )

    access_token = create_access_token(
        user_id=user[0],
        email=user[2],
        role=user[3],
        organization_id=user[4]
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
