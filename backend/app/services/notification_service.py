from datetime import datetime, timezone


class NotificationService:
    ACCOUNT_INVITATION = "ACCOUNT_INVITATION"
    COURSE_ENROLLMENT = "COURSE_ENROLLMENT"
    COURSE_STARTED = "COURSE_STARTED"
    COURSE_MILESTONE = "COURSE_MILESTONE"
    QUIZ_PASSED = "QUIZ_PASSED"
    QUIZ_FAILED = "QUIZ_FAILED"
    COURSE_COMPLETED = "COURSE_COMPLETED"
    CERTIFICATE_ISSUED = "CERTIFICATE_ISSUED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    ACCOUNT_UPDATED = "ACCOUNT_UPDATED"
    ACCOUNT_DELETED = "ACCOUNT_DELETED"
    SYSTEM = "SYSTEM"

    @staticmethod
    def create(
        conn,
        *,
        user_id: int,
        organization_id: int | None,
        type: str,
        title: str,
        message: str,
        link: str | None = None,
    ) -> dict | None:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO notifications
                    (user_id, organization_id, type, title, message, link, is_read)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE)
                RETURNING id, user_id, organization_id, type, title, message, link,
                          is_read, created_at, read_at
                """,
                (user_id, organization_id, type, title, message, link),
            )
            row = cursor.fetchone()
            if not row:
                return None
            conn.commit()
            return NotificationService._row_to_dict(row)
        finally:
            cursor.close()

    @staticmethod
    def exists(
        conn,
        *,
        user_id: int,
        type: str,
        link: str | None = None,
        title: str | None = None,
    ) -> bool:
        cursor = conn.cursor()
        try:
            clauses = ["user_id = %s", "type = %s"]
            params: list = [user_id, type]
            if link is not None:
                clauses.append("link = %s")
                params.append(link)
            if title is not None:
                clauses.append("title = %s")
                params.append(title)
            cursor.execute(
                f"SELECT 1 FROM notifications WHERE {' AND '.join(clauses)} LIMIT 1",
                tuple(params),
            )
            return cursor.fetchone() is not None
        finally:
            cursor.close()

    @staticmethod
    def list_for_user(conn, user_id: int, limit: int = 50) -> list[dict]:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, user_id, organization_id, type, title, message, link,
                       is_read, created_at, read_at
                FROM notifications
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            return [NotificationService._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            cursor.close()

    @staticmethod
    def unread_count(conn, user_id: int) -> int:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT COUNT(*) FROM notifications
                WHERE user_id = %s AND is_read = FALSE
                """,
                (user_id,),
            )
            return int(cursor.fetchone()[0])
        finally:
            cursor.close()

    @staticmethod
    def mark_read(conn, user_id: int, notification_id: int) -> dict | None:
        cursor = conn.cursor()
        try:
            now = datetime.now(timezone.utc)
            cursor.execute(
                """
                UPDATE notifications
                SET is_read = TRUE, read_at = %s
                WHERE id = %s AND user_id = %s
                RETURNING id, user_id, organization_id, type, title, message, link,
                          is_read, created_at, read_at
                """,
                (now, notification_id, user_id),
            )
            row = cursor.fetchone()
            if row:
                conn.commit()
            return NotificationService._row_to_dict(row) if row else None
        finally:
            cursor.close()

    @staticmethod
    def mark_all_read(conn, user_id: int) -> int:
        cursor = conn.cursor()
        try:
            now = datetime.now(timezone.utc)
            cursor.execute(
                """
                UPDATE notifications
                SET is_read = TRUE, read_at = %s
                WHERE user_id = %s AND is_read = FALSE
                """,
                (now, user_id),
            )
            count = cursor.rowcount
            conn.commit()
            return count
        finally:
            cursor.close()

    @staticmethod
    def _row_to_dict(row) -> dict:
        return {
            "id": row[0],
            "user_id": row[1],
            "organization_id": row[2],
            "type": row[3],
            "title": row[4],
            "message": row[5],
            "link": row[6],
            "is_read": row[7],
            "created_at": row[8],
            "read_at": row[9],
        }
