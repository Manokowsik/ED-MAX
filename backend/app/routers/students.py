from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_student


router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


# ============================================================
# Student Dashboard (Student only — own data only)
# ============================================================

@router.get("/{student_id}/dashboard")
def get_student_dashboard(
    student_id: int,
    current_user: dict = Depends(require_student)
):
    # Students can only access their own dashboard
    if current_user["id"] != student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify student exists
        cursor.execute(
            """
            SELECT id, name, email, is_active
            FROM users
            WHERE id = %s AND LOWER(role) = 'student'
            """,
            (student_id,)
        )
        student = cursor.fetchone()

        if not student:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        # Course statistics
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_courses,
                COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) AS completed_courses,
                COUNT(CASE WHEN e.completed_at IS NULL THEN 1 END) AS active_courses
            FROM enrollments e
            WHERE e.student_id = %s
            """,
            (student_id,)
        )
        course_stats = cursor.fetchone()
        total_courses = course_stats[0]
        completed_courses = course_stats[1]
        active_courses = course_stats[2]

        # Overall progress across all courses
        cursor.execute(
            """
            SELECT
                COALESCE(
                    ROUND(
                        AVG(
                            CASE
                                WHEN course_progress.total_modules > 0
                                THEN
                                    course_progress.completed_modules
                                    * 100.0
                                    / course_progress.total_modules
                                ELSE 0
                            END
                        )
                    ),
                    0
                )
            FROM enrollments e
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(cm.id) AS total_modules,
                    COUNT(
                        CASE WHEN mp.completed = TRUE THEN 1 END
                    ) AS completed_modules
                FROM course_modules cm
                LEFT JOIN module_progress mp
                    ON mp.module_id = cm.id AND mp.student_id = %s
                WHERE cm.course_id = e.course_id
            ) AS course_progress
                ON TRUE
            WHERE e.student_id = %s
            """,
            (student_id, student_id)
        )
        overall_progress = cursor.fetchone()[0]

        # Certificate count
        cursor.execute(
            "SELECT COUNT(*) FROM certificates WHERE student_id = %s",
            (student_id,)
        )
        certificate_count = cursor.fetchone()[0]

        # Student courses with per-course progress
        cursor.execute(
            """
            SELECT
                c.id,
                c.title,
                c.description,
                e.status,
                e.assigned_at,
                e.completed_at,
                COALESCE(course_progress.total_modules, 0),
                COALESCE(course_progress.completed_modules, 0),
                CASE
                    WHEN COALESCE(course_progress.total_modules, 0) > 0
                    THEN ROUND(
                        course_progress.completed_modules
                        * 100.0
                        / course_progress.total_modules
                    )
                    ELSE 0
                END AS progress_percentage
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(cm.id) AS total_modules,
                    COUNT(
                        CASE WHEN mp.completed = TRUE THEN 1 END
                    ) AS completed_modules
                FROM course_modules cm
                LEFT JOIN module_progress mp
                    ON mp.module_id = cm.id AND mp.student_id = %s
                WHERE cm.course_id = e.course_id
            ) AS course_progress ON TRUE
            WHERE e.student_id = %s
            ORDER BY e.assigned_at DESC
            """,
            (student_id, student_id)
        )
        courses = cursor.fetchall()

        # Recent quiz attempts for this student (last 10)
        cursor.execute(
            """
            SELECT
                qa.id,
                q.title AS quiz_title,
                qa.score,
                qa.passed,
                qa.attempted_at
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            WHERE qa.student_id = %s
            ORDER BY qa.attempted_at DESC
            LIMIT 10
            """,
            (student_id,)
        )
        recent_attempts = cursor.fetchall()

        return {
            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2],
                "is_active": student[3]
            },
            "statistics": {
                "total_courses": total_courses,
                "active_courses": active_courses,
                "completed_courses": completed_courses,
                "certificates": certificate_count,
                "overall_progress": overall_progress
            },
            "courses": [
                {
                    "course_id": c[0],
                    "title": c[1],
                    "description": c[2],
                    "status": c[3],
                    "assigned_at": c[4],
                    "completed_at": c[5],
                    "total_modules": c[6],
                    "completed_modules": c[7],
                    "progress_percentage": int(c[8])
                }
                for c in courses
            ],
            "recent_quiz_attempts": [
                {
                    "attempt_id": a[0],
                    "quiz_title": a[1],
                    "score": a[2],
                    "passed": a[3],
                    "attempted_at": a[4]
                }
                for a in recent_attempts
            ]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve dashboard data"
        )

    finally:
        cursor.close()
        conn.close()