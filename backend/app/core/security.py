from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


# ============================================================
# JWT Configuration
# ============================================================

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not configured in the .env file"
    )


# ============================================================
# HTTP Bearer
# ============================================================

security = HTTPBearer()


# ============================================================
# Token Helpers
# ============================================================

def create_access_token(
    user_id: int,
    email: str,
    role: str,
    organization_id: int | None = None
):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "org": organization_id,
        "token_type": "access",
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def create_refresh_token(
    user_id: int,
    email: str,
    role: str,
    organization_id: int | None = None
):
    expire = datetime.now(timezone.utc) + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "org": organization_id,
        "token_type": "refresh",
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def decode_token(token: str, expected_type: str | None = None):
    payload = jwt.decode(
        token,
        JWT_SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
    )

    if expected_type is not None and payload.get("token_type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

    return payload


# ============================================================
# Get Current User
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = decode_token(token, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except (jwt.InvalidTokenError, HTTPException):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    organization_id = payload.get("org")

    if not user_id or not email or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

    return {
        "id": int(user_id),
        "email": email,
        "role": role,
        "organization_id": int(organization_id) if organization_id else None
    }


# ============================================================
# Require Admin
# ============================================================

def require_admin(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"].upper() != "ADMIN":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


# ============================================================
# Require Student
# ============================================================

def require_student(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"].upper() != "STUDENT":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )

    return current_user