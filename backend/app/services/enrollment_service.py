from app.services.email_service import EmailService
from app.services.notification_service import NotificationService


def enroll_student_in_course(cursor, student_id: int, course_id: int, org_id: int) -> tuple[str, dict | None]:
    """
    Insert an enrollment if it does not already exist.
    Returns (status, enrollment_or_none) where status is 'created', 'exists', or 'course_not_found'.
    """
    cursor.execute(
        """
        SELECT id, title FROM courses
        WHERE id = %s AND organization_id = %s AND is_active = TRUE
        """,
        (course_id, org_id),
    )
    course = cursor.fetchone()
    if not course:
        return "course_not_found", None

    cursor.execute(
        """
        SELECT id, student_id, course_id, status, assigned_at
        FROM enrollments
        WHERE student_id = %s AND course_id = %s
        """,
        (student_id, course_id),
    )
    existing = cursor.fetchone()
    if existing:
        return "exists", {
            "id": existing[0],
            "student_id": existing[1],
            "course_id": existing[2],
            "status": existing[3],
            "assigned_at": existing[4],
            "course_title": course[1],
        }

    cursor.execute(
        """
        INSERT INTO enrollments (student_id, course_id, status, assigned_at)
        VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
        RETURNING id, student_id, course_id, status, assigned_at
        """,
        (student_id, course_id),
    )
    enrollment = cursor.fetchone()
    return "created", {
        "id": enrollment[0],
        "student_id": enrollment[1],
        "course_id": enrollment[2],
        "status": enrollment[3],
        "assigned_at": enrollment[4],
        "course_title": course[1],
    }


def notify_enrollment(
    conn,
    *,
    student: dict,
    actor_name: str,
    course_id: int,
    course_title: str,
    send_email: bool = True,
) -> None:
    link = f"/student/courses/{course_id}"
    NotificationService.create(
        conn,
        user_id=student["id"],
        organization_id=student.get("organization_id"),
        type=NotificationService.COURSE_ENROLLMENT,
        title=f"Enrolled in {course_title}",
        message=f"{actor_name} enrolled you in {course_title}",
        link=link,
    )
    if send_email:
        try:
            EmailService.send_course_enrollment(
                student["email"],
                student["name"],
                actor_name,
                course_title,
                course_id,
            )
        except Exception:
            pass


def notify_invitation(conn, *, student: dict, actor_name: str) -> None:
    NotificationService.create(
        conn,
        user_id=student["id"],
        organization_id=student.get("organization_id"),
        type=NotificationService.ACCOUNT_INVITATION,
        title="You're invited to ED-MAX",
        message=f"{actor_name} invited you to ED-MAX",
        link="/student/dashboard",
    )
