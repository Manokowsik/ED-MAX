from fastapi import HTTPException, status
from pwdlib import PasswordHash

from app.services.email_service import EmailService
from app.services.notification_service import NotificationService

password_hash_mgr = PasswordHash.recommended()

LAST_ADMIN_MESSAGE = (
    "You cannot delete the last administrator account. "
    "Assign another administrator before deleting this account."
)


class ProfileService:
    @staticmethod
    def public_profile(row) -> dict:
        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "organization_id": row[4],
            "is_active": row[5],
            "is_verified": row[6],
            "deleted_at": row[7],
        }

    @staticmethod
    def get_profile(conn, user_id: int) -> dict:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, name, email, role, organization_id, is_active,
                       is_verified, deleted_at
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )
            return ProfileService.public_profile(row)
        finally:
            cursor.close()

    @staticmethod
    def update_profile(conn, current_user: dict, name: str) -> dict:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE users
                SET name = %s
                WHERE id = %s AND deleted_at IS NULL
                RETURNING id, name, email, role, organization_id, is_active,
                          is_verified, deleted_at
                """,
                (name, current_user["id"]),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )
            NotificationService.create(
                conn,
                user_id=current_user["id"],
                organization_id=current_user.get("organization_id"),
                type=NotificationService.ACCOUNT_UPDATED,
                title="Profile updated",
                message="Your ED-MAX profile details were updated.",
                link="/account",
            )
            conn.commit()
            return ProfileService.public_profile(row)
        except HTTPException:
            conn.rollback()
            raise
        finally:
            cursor.close()

    @staticmethod
    def change_password(
        conn,
        current_user: dict,
        current_password: str,
        new_password: str,
        confirm_password: str,
    ) -> dict:
        if new_password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match",
            )
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT password_hash, name, email
                FROM users
                WHERE id = %s AND deleted_at IS NULL
                """,
                (current_user["id"],),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )

            stored_hash, name, email = row
            if not password_hash_mgr.verify(current_password, stored_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect",
                )

            if password_hash_mgr.verify(new_password, stored_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New password must be different from the current password",
                )

            hashed = password_hash_mgr.hash(new_password)
            cursor.execute(
                """
                UPDATE users
                SET password_hash = %s, token_version = token_version + 1
                WHERE id = %s
                """,
                (hashed, current_user["id"]),
            )
            cursor.execute(
                """
                UPDATE password_resets
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (current_user["id"],),
            )
            NotificationService.create(
                conn,
                user_id=current_user["id"],
                organization_id=current_user.get("organization_id"),
                type=NotificationService.PASSWORD_CHANGED,
                title="Password changed",
                message="Your ED-MAX password was changed.",
                link="/account",
            )
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        finally:
            cursor.close()

        try:
            EmailService.send_password_changed(email, name)
        except Exception:
            pass

        return {
            "message": "Password changed successfully. Please sign in again.",
            "require_login": True,
        }

    @staticmethod
    def delete_account(conn, current_user: dict, confirmation: str, current_password: str) -> dict:
        if (confirmation or "").strip() != "DELETE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Type DELETE to confirm account deletion.',
            )

        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, name, email, role, organization_id, password_hash,
                       is_active, deleted_at
                FROM users
                WHERE id = %s
                """,
                (current_user["id"],),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )

            user_id, name, email, role, org_id, stored_hash, is_active, deleted_at = row
            if deleted_at is not None or not is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Account is already deactivated",
                )

            if not password_hash_mgr.verify(current_password, stored_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect",
                )

            if role.upper() == "ADMIN":
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM users
                    WHERE organization_id = %s
                      AND UPPER(role) = 'ADMIN'
                      AND is_active = TRUE
                      AND deleted_at IS NULL
                    """,
                    (org_id,),
                )
                admin_count = cursor.fetchone()[0]
                if admin_count <= 1:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=LAST_ADMIN_MESSAGE,
                    )

            cursor.execute(
                """
                UPDATE users
                SET is_active = FALSE,
                    deleted_at = CURRENT_TIMESTAMP,
                    token_version = token_version + 1
                WHERE id = %s
                """,
                (user_id,),
            )
            cursor.execute(
                """
                UPDATE password_resets
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (user_id,),
            )
            NotificationService.create(
                conn,
                user_id=user_id,
                organization_id=org_id,
                type=NotificationService.ACCOUNT_DELETED,
                title="Account deactivated",
                message="Your ED-MAX account was deactivated.",
                link=None,
            )
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        finally:
            cursor.close()

        try:
            EmailService.send_account_deleted(email, name)
        except Exception:
            pass

        return {
            "message": "Your account has been deactivated. You have been signed out.",
        }
