import os
from pathlib import Path

from dotenv import load_dotenv

backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
else:
    load_dotenv()


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    if value is not None:
        value = value.strip()
    return value


DATABASE_URL = _get_env("DATABASE_URL")
JWT_SECRET_KEY = _get_env("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(_get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(_get_env("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
APP_ENV = _get_env("APP_ENV", "development")

# Email & Auth Security Config
SMTP_HOST = _get_env("SMTP_HOST", "")
SMTP_PORT = int(_get_env("SMTP_PORT", "587"))
SMTP_USER = _get_env("SMTP_USER", "")
SMTP_PASSWORD = _get_env("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = _get_env("SMTP_FROM_EMAIL", "") or _get_env("SMTP_USER", "noreply@edmax.local")
SMTP_TLS = (_get_env("SMTP_TLS", "true") or "true").lower() in ("true", "1", "yes")
SMTP_SSL = (_get_env("SMTP_SSL", "false") or "false").lower() in ("true", "1", "yes") or (SMTP_PORT == 465)
EMAIL_MODE = _get_env("EMAIL_MODE", "development")
DEV_LOG_AUTH_TOKENS = (_get_env("DEV_LOG_AUTH_TOKENS", "true") or "true").lower() in ("true", "1", "yes")
FRONTEND_URL = _get_env("FRONTEND_URL", "http://localhost:5173")


# Token & OTP Expiration Parameters
OTP_EXPIRE_MINUTES = int(_get_env("OTP_EXPIRE_MINUTES", "10"))
OTP_RESEND_COOLDOWN_SECONDS = int(_get_env("OTP_RESEND_COOLDOWN_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(_get_env("OTP_MAX_ATTEMPTS", "5"))
ACTIVATION_TOKEN_EXPIRE_HOURS = int(_get_env("ACTIVATION_TOKEN_EXPIRE_HOURS", "48"))
RESET_TOKEN_EXPIRE_MINUTES = int(_get_env("RESET_TOKEN_EXPIRE_MINUTES", "30"))

