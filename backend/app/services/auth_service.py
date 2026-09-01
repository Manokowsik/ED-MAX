from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from fastapi import HTTPException, status
from pwdlib import PasswordHash

from app.core.config import (
    ACTIVATION_TOKEN_EXPIRE_HOURS,
    OTP_EXPIRE_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    RESET_TOKEN_EXPIRE_MINUTES,
)

from app.services.email_service import EmailService

password_hash_mgr = PasswordHash.recommended()


class AuthService:

    @staticmethod
    def generate_otp() -> str:
        """Generate a cryptographically secure 6-digit OTP."""
        return f"{secrets.randbelow(1000000):06d}"

    @staticmethod
    def generate_secure_token() -> str:
        """Generate a cryptographically secure URL-safe token."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token or OTP using SHA-256 for secure DB storage."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    # ============================================================
    # Email Verification (OTP)
    # ============================================================

    @classmethod
    def create_email_verification(cls, conn, user_id: int, name: str, email: str) -> str:
        cursor = conn.cursor()
        try:
            # Invalidate previous unverified OTPs for this user
            cursor.execute(
                """
                UPDATE email_verifications
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (user_id,)
            )

            otp = cls.generate_otp()
            otp_hash = cls.hash_token(otp)
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)
            resend_available_at = now + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)

            cursor.execute(
                """
                INSERT INTO email_verifications
                (user_id, otp_hash, expires_at, resend_available_at, attempts, is_used)
                VALUES (%s, %s, %s, %s, 0, FALSE)
                """,
                (user_id, otp_hash, expires_at, resend_available_at)
            )
            conn.commit()

            EmailService.send_verification_otp(email, otp, name)
            return otp
        finally:
            cursor.close()

    @classmethod
    def verify_email_otp(cls, conn, email: str, otp: str) -> dict:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, name, is_verified FROM users WHERE email = %s",
                (email.strip(),)
            )
            user = cursor.fetchone()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid email or verification code"
                )

            user_id, user_name, is_verified = user[0], user[1], user[2]
            if is_verified:
                return {"message": "Email is already verified"}

            cursor.execute(
                """
                SELECT id, otp_hash, expires_at, attempts, is_used
                FROM email_verifications
                WHERE user_id = %s AND is_used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,)
            )
            verification = cursor.fetchone()

            if not verification:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired verification code"
                )

            ver_id, stored_hash, expires_at, attempts, is_used = verification

            # Normalize timezone
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)

            if now > expires_at:
                cursor.execute(
                    "UPDATE email_verifications SET is_used = TRUE WHERE id = %s",
                    (ver_id,)
                )
                conn.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired. Please request a new code."
                )

            if attempts >= OTP_MAX_ATTEMPTS:
                cursor.execute(
                    "UPDATE email_verifications SET is_used = TRUE WHERE id = %s",
                    (ver_id,)
                )
                conn.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Maximum verification attempts exceeded. Please request a new code."
                )

            input_hash = cls.hash_token(otp.strip())

            if input_hash != stored_hash:
                cursor.execute(
                    "UPDATE email_verifications SET attempts = attempts + 1 WHERE id = %s",
                    (ver_id,)
                )
                conn.commit()
                remaining = OTP_MAX_ATTEMPTS - (attempts + 1)
                if remaining <= 0:
                    cursor.execute(
                        "UPDATE email_verifications SET is_used = TRUE WHERE id = %s",
                        (ver_id,)
                    )
                    conn.commit()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Maximum verification attempts exceeded. Please request a new code."
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid verification code. {remaining} attempt(s) remaining."
                )

            # Verification successful
            cursor.execute(
                "UPDATE email_verifications SET is_used = TRUE WHERE id = %s",
                (ver_id,)
            )
            cursor.execute(
                "UPDATE users SET is_verified = TRUE WHERE id = %s",
                (user_id,)
            )
            conn.commit()

            return {
                "message": "Email verified successfully",
                "user": {
                    "id": user_id,
                    "name": user_name,
                    "email": email,
                    "is_verified": True
                }
            }
        finally:
            cursor.close()

    @classmethod
    def resend_email_otp(cls, conn, email: str) -> dict:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, name, is_verified FROM users WHERE email = %s",
                (email.strip(),)
            )
            user = cursor.fetchone()
            if not user:
                # Security standard: do not reveal email existence
                return {"message": "If an account with that email exists, a verification code has been sent."}

            user_id, user_name, is_verified = user[0], user[1], user[2]
            if is_verified:
                return {"message": "Email is already verified."}

            cursor.execute(
                """
                SELECT resend_available_at
                FROM email_verifications
                WHERE user_id = %s AND is_used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,)
            )
            last_ver = cursor.fetchone()

            if last_ver and last_ver[0]:
                resend_at = last_ver[0]
                if resend_at.tzinfo is None:
                    resend_at = resend_at.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                if now < resend_at:
                    wait_seconds = int((resend_at - now).total_seconds())
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {wait_seconds} second(s) before requesting another code."
                    )

            cls.create_email_verification(conn, user_id, user_name, email.strip())
            return {"message": "A new verification code has been sent to your email."}
        finally:
            cursor.close()

    # ============================================================
    # Student Invitation & Account Activation
    # ============================================================

    @classmethod
    def create_student_activation(cls, conn, user_id: int, name: str, email: str) -> str:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE student_activations
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (user_id,)
            )

            token = cls.generate_secure_token()
            token_hash = cls.hash_token(token)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=ACTIVATION_TOKEN_EXPIRE_HOURS)

            cursor.execute(
                """
                INSERT INTO student_activations (user_id, token_hash, expires_at, is_used)
                VALUES (%s, %s, %s, FALSE)
                """,
                (user_id, token_hash, expires_at)
            )
            conn.commit()

            EmailService.send_student_invitation(email, token, name)
            return token
        finally:
            cursor.close()

    @classmethod
    def validate_activation_token(cls, conn, token: str) -> dict:
        cursor = conn.cursor()
        try:
            token_hash = cls.hash_token(token.strip())
            cursor.execute(
                """
                SELECT sa.id, sa.expires_at, sa.is_used, u.id, u.name, u.email, u.organization_id
                FROM student_activations sa
                JOIN users u ON u.id = sa.user_id
                WHERE sa.token_hash = %s
                """,
                (token_hash,)
            )
            row = cursor.fetchone()

            if not row or row[2]:  # is_used
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or already used activation token"
                )

            act_id, expires_at, is_used, user_id, name, email, org_id = row

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Activation token has expired. Please request a new invitation."
                )

            return {
                "valid": True,
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": email,
                    "organization_id": org_id,
                }
            }
        finally:
            cursor.close()

    @classmethod
    def activate_student_account(cls, conn, token: str, password: str, confirm_password: str) -> dict:
        if password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match"
            )
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )

        token_hash = cls.hash_token(token.strip())
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT sa.id, sa.expires_at, sa.is_used, u.id, u.name, u.email, u.role, u.organization_id
                FROM student_activations sa
                JOIN users u ON u.id = sa.user_id
                WHERE sa.token_hash = %s
                """,
                (token_hash,)
            )
            row = cursor.fetchone()

            if not row or row[2]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or already used activation token"
                )

            act_id, expires_at, is_used, user_id, name, email, role, org_id = row

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Activation token has expired. Please request a new invitation."
                )

            if role.upper() != "STUDENT":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid activation token"
                )

            hashed_password = password_hash_mgr.hash(password)

            # Update student user to active & verified with new password
            cursor.execute(
                """
                UPDATE users
                SET password_hash = %s, is_active = TRUE, is_verified = TRUE
                WHERE id = %s
                """,
                (hashed_password, user_id)
            )

            # Mark token as used — token is now permanently invalidated
            cursor.execute(
                "UPDATE student_activations SET is_used = TRUE WHERE id = %s",
                (act_id,)
            )
            conn.commit()

            # Do NOT create an authentication session.
            # The student must log in normally with email + new password.
            return {
                "message": "Account activated successfully. You can now sign in.",
            }
        finally:
            cursor.close()

    # ============================================================
    # Resend Student Activation Email
    # ============================================================

    @classmethod
    def resend_student_activation(cls, conn, email: str) -> dict:
        """
        Resend the activation email for a pending student account.

        Security: always returns a generic message to prevent email enumeration.
        Rate-limiting: enforces a cooldown based on the most recent activation
        token's created_at timestamp.
        """
        generic_response = {
            "message": "If a pending student account with that email exists, a new activation email has been sent."
        }
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, name, is_active, is_verified, role
                FROM users
                WHERE email = %s
                """,
                (email.strip(),)
            )
            user = cursor.fetchone()

            if not user:
                return generic_response

            user_id, user_name, is_active, is_verified, role = user

            # Only resend for STUDENT accounts that are still pending activation
            if role.upper() != "STUDENT" or is_active or is_verified:
                return generic_response

            # Enforce cooldown: check created_at of the most recent activation record
            cursor.execute(
                """
                SELECT created_at
                FROM student_activations
                WHERE user_id = %s AND is_used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,)
            )
            last_row = cursor.fetchone()

            if last_row and last_row[0]:
                created_at = last_row[0]
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                cooldown_seconds = OTP_RESEND_COOLDOWN_SECONDS
                elapsed = (now - created_at).total_seconds()
                if elapsed < cooldown_seconds:
                    wait_seconds = int(cooldown_seconds - elapsed)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {wait_seconds} second(s) before requesting another activation email."
                    )

            # Invalidate all previous unused activation tokens for this user
            cursor.execute(
                """
                UPDATE student_activations
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (user_id,)
            )

            # Generate new token and send email
            token = cls.generate_secure_token()
            token_hash = cls.hash_token(token)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=ACTIVATION_TOKEN_EXPIRE_HOURS)

            cursor.execute(
                """
                INSERT INTO student_activations (user_id, token_hash, expires_at, is_used)
                VALUES (%s, %s, %s, FALSE)
                """,
                (user_id, token_hash, expires_at)
            )
            conn.commit()

            EmailService.send_student_invitation(email.strip(), token, user_name)
            return generic_response
        finally:
            cursor.close()

    # ============================================================
    # Forgot & Reset Password
    # ============================================================

    @classmethod
    def request_password_reset(cls, conn, email: str) -> dict:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, name, is_active FROM users WHERE email = %s",
                (email.strip(),)
            )
            user = cursor.fetchone()

            # Always return standard generic message to prevent email enumeration
            generic_response = {
                "message": "If an account with that email exists, password reset instructions have been sent."
            }

            if not user or not user[2]:  # user not found or not active
                return generic_response

            user_id, name = user[0], user[1]

            # Invalidate previous unexpired reset tokens for user
            cursor.execute(
                """
                UPDATE password_resets
                SET is_used = TRUE
                WHERE user_id = %s AND is_used = FALSE
                """,
                (user_id,)
            )

            token = cls.generate_secure_token()
            token_hash = cls.hash_token(token)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

            cursor.execute(
                """
                INSERT INTO password_resets (user_id, token_hash, expires_at, is_used)
                VALUES (%s, %s, %s, FALSE)
                """,
                (user_id, token_hash, expires_at)
            )
            conn.commit()

            EmailService.send_password_reset(email.strip(), token, name)
            return generic_response
        finally:
            cursor.close()

    @classmethod
    def validate_reset_token(cls, conn, token: str) -> dict:
        cursor = conn.cursor()
        try:
            token_hash = cls.hash_token(token.strip())
            cursor.execute(
                """
                SELECT pr.id, pr.expires_at, pr.is_used, u.id, u.email
                FROM password_resets pr
                JOIN users u ON u.id = pr.user_id
                WHERE pr.token_hash = %s
                """,
                (token_hash,)
            )
            row = cursor.fetchone()

            if not row or row[2]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or already used password reset token"
                )

            pr_id, expires_at, is_used, user_id, email = row

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password reset token has expired. Please request a new link."
                )

            return {"valid": True, "email": email}
        finally:
            cursor.close()

    @classmethod
    def reset_password(cls, conn, token: str, password: str, confirm_password: str) -> dict:
        if password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match"
            )
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )

        token_hash = cls.hash_token(token.strip())
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT pr.id, pr.expires_at, pr.is_used, u.id, u.email
                FROM password_resets pr
                JOIN users u ON u.id = pr.user_id
                WHERE pr.token_hash = %s
                """,
                (token_hash,)
            )
            row = cursor.fetchone()

            if not row or row[2]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or already used password reset token"
                )

            pr_id, expires_at, is_used, user_id, email = row

            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password reset token has expired. Please request a new link."
                )

            hashed_password = password_hash_mgr.hash(password)

            # Update password
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hashed_password, user_id)
            )

            # Invalidate reset token
            cursor.execute(
                "UPDATE password_resets SET is_used = TRUE WHERE id = %s",
                (pr_id,)
            )
            conn.commit()

            return {"message": "Password reset successfully. You can now log in with your new password."}
        finally:
            cursor.close()
