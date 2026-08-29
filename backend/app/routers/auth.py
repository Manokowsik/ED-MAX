from fastapi import APIRouter, HTTPException
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.auth import LoginRequest
from app.core.security import create_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


password_hash = PasswordHash.recommended()


# ============================================================
# Login
# ============================================================

@router.post("/login")
def login(login_data: LoginRequest):

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
                role
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


    # ========================================================
    # User Not Found
    # ========================================================

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    # ========================================================
    # Verify Password
    # ========================================================

    if not password_hash.verify(
        login_data.password,
        user[3]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )


    # ========================================================
    # Create JWT
    # ========================================================

    access_token = create_access_token(
        user_id=user[0],
        email=user[2],
        role=user[4]
    )


    # ========================================================
    # Response
    # ========================================================

    return {
        "message": "Login successful",

        "access_token": access_token,

        "token_type": "bearer",

        "user": {
            "id": user[0],
            "name": user[1],
            "email": user[2],
            "role": user[4]
        }
    }