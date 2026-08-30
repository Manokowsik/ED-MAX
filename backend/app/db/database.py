import psycopg
from dotenv import load_dotenv

from app.core.config import DATABASE_URL

load_dotenv()


def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured in the .env file")

    return psycopg.connect(DATABASE_URL)