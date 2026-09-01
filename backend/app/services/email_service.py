import logging
import smtplib
from email.message import EmailMessage

from app.core.config import (
    ACTIVATION_TOKEN_EXPIRE_HOURS,
    DEV_LOG_AUTH_TOKENS,
    EMAIL_MODE,
    FRONTEND_URL,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SSL,
    SMTP_TLS,
    SMTP_USER,
)

logger = logging.getLogger("email_service")


class EmailService:
    """
    Reusable email service abstraction.
    Supports SMTP delivery and safe development logging.
    """

    @staticmethod
    def _send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> bool:
        use_smtp = bool(SMTP_HOST) or EMAIL_MODE.lower() == "smtp"

        if EMAIL_MODE.lower() == "smtp" and not SMTP_HOST:
            err_msg = "[EMAIL ERROR] EMAIL_MODE is set to 'smtp' but SMTP_HOST is empty in .env configuration!"
            print(f"\n=======================================================\n{err_msg}\n=======================================================\n", flush=True)
            raise RuntimeError(err_msg)

        if use_smtp and SMTP_HOST:
            print(f"\n[EMAIL START] Preparing email: {subject}", flush=True)
            print(f"[EMAIL] From: {SMTP_FROM_EMAIL or SMTP_USER}", flush=True)
            print(f"[EMAIL] Recipient: {to_email}", flush=True)
            print(f"[EMAIL] SMTP host: {SMTP_HOST}:{SMTP_PORT}", flush=True)
            print(f"[EMAIL] Connecting to SMTP server...", flush=True)

            try:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = SMTP_FROM_EMAIL or SMTP_USER or "edmaxtrainingplatform@gmail.com"
                msg["To"] = to_email
                msg.set_content(body)

                if html_body:
                    msg.add_alternative(html_body, subtype="html")

                if SMTP_SSL or SMTP_PORT == 465:
                    server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15)
                else:
                    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)

                with server:
                    if SMTP_TLS and not (SMTP_SSL or SMTP_PORT == 465):
                        server.starttls()

                    if SMTP_USER and SMTP_PASSWORD:
                        print(f"[EMAIL] Authenticating as {SMTP_USER}...", flush=True)
                        server.login(SMTP_USER, SMTP_PASSWORD)
                        print(f"[EMAIL] SMTP Authentication SUCCESS", flush=True)

                    server.send_message(msg)

                print(f"[EMAIL SUCCESS] Message accepted by Gmail SMTP server for recipient {to_email}!\n", flush=True)
                logger.info(f"Email successfully sent via SMTP to {to_email}: {subject}")
                return True

            except smtplib.SMTPAuthenticationError as e:
                err_msg = f"[SMTP AUTH ERROR] Gmail rejected username/password ({SMTP_USER}): {e.smtp_code} - {e.smtp_error}"
                logger.error(err_msg)
                print(f"\n=======================================================\n{err_msg}\n=======================================================\n", flush=True)
                raise RuntimeError(f"SMTP Authentication Error: {e.smtp_error}") from e

            except smtplib.SMTPException as e:
                err_msg = f"[SMTP ERROR] {type(e).__name__}: {e}"
                logger.error(err_msg)
                print(f"\n=======================================================\n{err_msg}\n=======================================================\n", flush=True)
                raise RuntimeError(f"SMTP Error ({type(e).__name__}): {e}") from e

            except Exception as e:
                err_msg = f"[EMAIL ERROR] Failed to send email via SMTP ({SMTP_HOST}:{SMTP_PORT}) to {to_email}: {type(e).__name__} - {e}"
                logger.error(err_msg)
                print(f"\n=======================================================\n{err_msg}\n=======================================================\n", flush=True)
                raise RuntimeError(f"Email delivery failed via SMTP to {to_email}: {e}") from e

        # Fallback for development logging ONLY when SMTP_HOST is not configured
        dev_log = f"[DEV EMAIL LOG — NO SMTP HOST CONFIGURED] To: {to_email} | Subject: {subject}"
        logger.info(dev_log)
        print(f"\n=======================================================\n{dev_log}\n=======================================================\n", flush=True)
        return True

    @classmethod
    def send_test_email(cls, email: str) -> bool:
        subject = "ED-MAX — SMTP Delivery Test"
        body = (
            f"Hello,\n\n"
            f"This is a test email sent from the ED-MAX Training Platform to verify your SMTP configuration.\n\n"
            f"If you received this email, your SMTP server settings are working properly!\n"
        )
        html_body = (
            f"<div style='font-family: sans-serif; padding: 20px;'>"
            f"<h2>ED-MAX SMTP Delivery Test</h2>"
            f"<p>Hello,</p>"
            f"<p>This is a test email sent from the ED-MAX Training Platform to verify your SMTP configuration.</p>"
            f"<p style='color: #10b981; font-weight: bold;'>✔ SMTP delivery is working successfully!</p>"
            f"</div>"
        )
        return cls._send_email(email, subject, body, html_body)

    @classmethod
    def send_verification_otp(cls, email: str, otp: str, name: str) -> bool:
        subject = "ED-MAX Verification Code"
        body = (
            f"Hello {name},\n\n"
            f"Your email verification code for ED-MAX is: {otp}\n\n"
            f"This code will expire shortly. Do not share this code with anyone.\n"
        )
        html_body = (
            f"<div style='font-family: sans-serif; padding: 20px;'>"
            f"<h2>ED-MAX Email Verification</h2>"
            f"<p>Hello <strong>{name}</strong>,</p>"
            f"<p>Your email verification code is:</p>"
            f"<h1 style='color: #4f46e5; letter-spacing: 4px;'>{otp}</h1>"
            f"<p>This code will expire shortly. Do not share this code with anyone.</p>"
            f"</div>"
        )
        return cls._send_email(email, subject, body, html_body)

    @classmethod
    def send_student_invitation(cls, email: str, token: str, name: str) -> bool:
        base_url = FRONTEND_URL.rstrip('/')
        activation_link = f"{base_url}/activate-account?token={token}"
        subject = "Welcome to ED-MAX - Activate Your Account"
        body = (
            f"Hello {name},\n\n"
            f"Your ED-MAX training account has been created by an administrator.\n\n"
            f"Please click the link below to set your password and activate your account:\n\n"
            f"{activation_link}\n\n"
            f"Activation Code: {token}\n\n"
            f"This link is single-use and will expire in {ACTIVATION_TOKEN_EXPIRE_HOURS} hours.\n\n"
            f"If you did not expect this invitation, you can safely ignore this email.\n"
        )
        html_body = (
            f"<div style='font-family: sans-serif; padding: 20px; color: #1f2937;'>"
            f"<h2 style='color: #1e1b4b;'>Welcome to ED-MAX</h2>"
            f"<p>Hello <strong>{name}</strong>,</p>"
            f"<p>Your ED-MAX training account has been created by an administrator.</p>"
            f"<p style='margin: 20px 0;'>"
            f"<a href='{activation_link}' style='background-color: #4f46e5; color: #ffffff; padding: 12px 24px; "
            f"text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;'>"
            f"Set Password &amp; Activate Account"
            f"</a>"
            f"</p>"
            f"<p>Or copy and paste this URL into your browser:<br/>"
            f"<a href='{activation_link}' style='color: #4f46e5;'>{activation_link}</a></p>"
            f"<p style='background-color: #f3f4f6; padding: 10px 15px; border-radius: 4px; font-family: monospace;'>"
            f"Activation Code: <strong>{token}</strong>"
            f"</p>"
            f"<p style='color: #6b7280; font-size: 0.875rem;'>This link is single-use and will expire in {ACTIVATION_TOKEN_EXPIRE_HOURS} hours.</p>"
            f"</div>"
        )
        return cls._send_email(email, subject, body, html_body)

    @classmethod
    def send_password_reset(cls, email: str, token: str, name: str) -> bool:
        base_url = FRONTEND_URL.rstrip('/')
        reset_link = f"{base_url}/reset-password?token={token}"
        subject = "ED-MAX - Reset Your Password"
        body = (
            f"Hello {name},\n\n"
            f"We received a request to reset your password on ED-MAX.\n"
            f"Please click the link below to set a new password:\n\n"
            f"{reset_link}\n\n"
            f"This link is single-use and will expire in 30 minutes.\n\n"
            f"If you did not request a password reset, please ignore this email.\n"
        )
        html_body = (
            f"<div style='font-family: sans-serif; padding: 20px; color: #1f2937;'>"
            f"<h2 style='color: #1e1b4b;'>Reset Your ED-MAX Password</h2>"
            f"<p>Hello <strong>{name}</strong>,</p>"
            f"<p>We received a request to reset your password.</p>"
            f"<p style='margin: 20px 0;'>"
            f"<a href='{reset_link}' style='background-color: #4f46e5; color: #ffffff; padding: 12px 24px; "
            f"text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;'>"
            f"Reset Password"
            f"</a>"
            f"</p>"
            f"<p>Or copy and paste this URL into your browser:<br/>"
            f"<a href='{reset_link}' style='color: #4f46e5;'>{reset_link}</a></p>"
            f"<p style='color: #6b7280; font-size: 0.875rem;'>If you did not request a password reset, you can safely ignore this message.</p>"
            f"</div>"
        )
        return cls._send_email(email, subject, body, html_body)
