from fastapi import APIRouter, HTTPException
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.signup import AdminSignupRequest


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


password_hash = PasswordHash.recommended()


# ============================================================
# Admin Signup (Public — no auth required)
# ============================================================

@router.post("/admin-signup", status_code=201)
def admin_signup(signup_data: AdminSignupRequest):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # Check whether email already exists
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s
            """,
            (signup_data.email,)
        )

        if cursor.fetchone():

            raise HTTPException(
                status_code=409,
                detail="Email already exists"
            )


        # ----------------------------------------------------
        # Hash Password
        # ----------------------------------------------------

        hashed_password = password_hash.hash(
            signup_data.password
        )


        # ----------------------------------------------------
        # Create Organization for this Admin
        # Each admin gets their own isolated workspace
        # ----------------------------------------------------

        org_name = f"{signup_data.name.strip()}'s Organization"

        cursor.execute(
            """
            INSERT INTO organizations (name)
            VALUES (%s)
            RETURNING id
            """,
            (org_name,)
        )

        organization_id = cursor.fetchone()[0]


        # ----------------------------------------------------
        # Create Admin User
        # Role is hardcoded — never accepted from the client
        # organization_id binds this admin to their org
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO users
            (
                name,
                email,
                password_hash,
                role,
                is_active,
                organization_id
            )
            VALUES
            (
                %s,
                %s,
                %s,
                'ADMIN',
                TRUE,
                %s
            )
            RETURNING
                id,
                name,
                email,
                role,
                is_active
            """,
            (
                signup_data.name.strip(),
                signup_data.email,
                hashed_password,
                organization_id
            )
        )

        user = cursor.fetchone()

        conn.commit()


        # ----------------------------------------------------
        # Response — never includes password_hash
        # ----------------------------------------------------

        return {
            "message": "Admin account created successfully",
            "user": {
                "id": user[0],
                "name": user[1],
                "email": user[2],
                "role": user[3],
                "is_active": user[4],
                "organization_id": organization_id
            }
        }


    except HTTPException:

        conn.rollback()
        raise


    except Exception:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create admin account"
        )


    finally:

        cursor.close()
        conn.close()
