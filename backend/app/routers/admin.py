import logging
from fastapi import APIRouter, HTTPException, Depends
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.user import CreateStudentRequest
from app.core.security import require_admin

logger = logging.getLogger("admin_router")

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


password_hash = PasswordHash.recommended()


# ============================================================
# Admin Dashboard (Admin only)
# Requirement 4: overview of courses, users, assignments,
#                progress, quiz results, completion status
#
# ALL queries scoped by organization_id
# ============================================================

@router.get("/dashboard")
def get_admin_dashboard(
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ---- Overall totals (org-scoped) ----
        cursor.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM courses
                    WHERE organization_id = %s)                             AS total_courses,
                (SELECT COUNT(*) FROM courses
                    WHERE is_active = TRUE AND organization_id = %s)        AS active_courses,
                (SELECT COUNT(*) FROM users
                    WHERE LOWER(role) = 'student'
                    AND organization_id = %s)                               AS total_students,
                (SELECT COUNT(*) FROM users
                    WHERE LOWER(role) = 'student'
                    AND is_active = TRUE
                    AND organization_id = %s)                               AS active_students,
                (SELECT COUNT(*) FROM enrollments e
                    JOIN courses c ON c.id = e.course_id
                    WHERE c.organization_id = %s)                           AS total_enrollments,
                (SELECT COUNT(*) FROM enrollments e
                    JOIN courses c ON c.id = e.course_id
                    WHERE e.status = 'COMPLETED'
                    AND c.organization_id = %s)                             AS completed_enrollments,
                (SELECT COUNT(*) FROM quiz_attempts qa
                    JOIN quizzes q ON q.id = qa.quiz_id
                    JOIN course_modules cm ON cm.id = q.module_id
                    JOIN courses c ON c.id = cm.course_id
                    WHERE c.organization_id = %s)                           AS total_quiz_attempts,
                (SELECT COUNT(*) FROM quiz_attempts qa
                    JOIN quizzes q ON q.id = qa.quiz_id
                    JOIN course_modules cm ON cm.id = q.module_id
                    JOIN courses c ON c.id = cm.course_id
                    WHERE qa.passed = TRUE
                    AND c.organization_id = %s)                             AS passed_quiz_attempts,
                (SELECT COUNT(*) FROM certificates cert
                    JOIN courses c ON c.id = cert.course_id
                    WHERE c.organization_id = %s)                           AS total_certificates
            """,
            (org_id, org_id, org_id, org_id, org_id,
             org_id, org_id, org_id, org_id)
        )
        totals = cursor.fetchone()

        # ---- Per-course stats (org-scoped) ----
        cursor.execute(
            """
            SELECT
                c.id,
                c.title,
                c.is_active,
                COUNT(DISTINCT e.student_id)                              AS enrolled_students,
                COUNT(DISTINCT CASE WHEN e.status = 'COMPLETED'
                    THEN e.student_id END)                                AS completed_students,
                COUNT(DISTINCT cm.id)                                     AS total_modules,
                COALESCE(ROUND(
                    AVG(
                        CASE
                            WHEN module_counts.total_mods > 0
                            THEN module_counts.completed_mods * 100.0 / module_counts.total_mods
                            ELSE 0
                        END
                    )
                ), 0)                                                     AS avg_progress_pct
            FROM courses c
            LEFT JOIN enrollments e ON e.course_id = c.id
            LEFT JOIN course_modules cm ON cm.course_id = c.id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(cm2.id)                                         AS total_mods,
                    COUNT(CASE WHEN mp.completed = TRUE THEN 1 END)       AS completed_mods
                FROM course_modules cm2
                LEFT JOIN module_progress mp
                    ON mp.module_id = cm2.id AND mp.student_id = e.student_id
                WHERE cm2.course_id = c.id
            ) AS module_counts ON e.student_id IS NOT NULL
            WHERE c.organization_id = %s
            GROUP BY c.id, c.title, c.is_active
            ORDER BY c.id
            """,
            (org_id,)
        )
        courses = cursor.fetchall()

        # ---- Recent quiz attempts (last 20, org-scoped) ----
        cursor.execute(
            """
            SELECT
                qa.id,
                qa.quiz_id,
                q.title         AS quiz_title,
                u.name          AS student_name,
                qa.score,
                qa.passed,
                qa.attempted_at
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            JOIN users u ON u.id = qa.student_id
            WHERE c.organization_id = %s
            ORDER BY qa.attempted_at DESC
            LIMIT 20
            """,
            (org_id,)
        )
        recent_attempts = cursor.fetchall()

        return {
            "summary": {
                "total_courses": totals[0],
                "active_courses": totals[1],
                "total_students": totals[2],
                "active_students": totals[3],
                "total_enrollments": totals[4],
                "completed_enrollments": totals[5],
                "total_quiz_attempts": totals[6],
                "passed_quiz_attempts": totals[7],
                "total_certificates": totals[8]
            },
            "courses": [
                {
                    "id": c[0],
                    "title": c[1],
                    "is_active": c[2],
                    "enrolled_students": c[3],
                    "completed_students": c[4],
                    "total_modules": c[5],
                    "avg_progress_pct": int(c[6])
                }
                for c in courses
            ],
            "recent_quiz_attempts": [
                {
                    "attempt_id": a[0],
                    "quiz_id": a[1],
                    "quiz_title": a[2],
                    "student_name": a[3],
                    "score": a[4],
                    "passed": a[5],
                    "attempted_at": a[6]
                }
                for a in recent_attempts
            ]
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve dashboard data"
        )

    finally:
        cursor.close()
        conn.close()





# ============================================================
# Create Student (scoped to admin's organization)
# ============================================================

@router.post("/students")
def create_student(
    student_data: CreateStudentRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # Check Email
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s
            """,
            (student_data.email,)
        )

        if cursor.fetchone():

            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )


        # ----------------------------------------------------
        # Store a locked password hash — no password is set until the student
        # completes activation. The empty string cannot be verified by pwdlib
        # as a valid credential, so the account is effectively locked.
        # Admin never enters or sees any password.
        # ----------------------------------------------------

        hashed_password = password_hash.hash("")  # placeholder; overwritten at activation


        # ----------------------------------------------------
        # Create Student (bound to admin's organization)
        # Account created in inactive / unverified state pending activation
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
                is_verified,
                organization_id
            )
            VALUES
            (
                %s,
                %s,
                %s,
                'STUDENT',
                FALSE,
                FALSE,
                %s
            )
            RETURNING
                id,
                name,
                email,
                role,
                is_active,
                is_verified
            """,
            (
                student_data.name,
                student_data.email,
                hashed_password,
                org_id
            )
        )

        student = cursor.fetchone()
        conn.commit()

        # Generate activation token and attempt sending invitation email
        from app.services.auth_service import AuthService
        email_sent = True
        student_id = student[0]
        student_name = student[1]
        student_email = student[2]

        print(f"\n[STUDENT CREATE] Name: {student_name}", flush=True)
        print(f"[STUDENT CREATE] Recipient email: {student_email}", flush=True)
        logger.info(f"[STUDENT CREATE] Name: {student_name} | Recipient email: {student_email}")

        try:
            AuthService.create_student_activation(
                conn,
                user_id=student_id,
                name=student_name,
                email=student_email
            )
        except Exception as e:
            email_sent = False
            logger.error(f"[SMTP ERROR] Failed to send activation email during student creation for {student_email}: {e}")

        if email_sent:
            msg = "Student created successfully. An activation email has been sent."
        else:
            msg = "Student created, but the activation email could not be sent. Please resend the activation email."

        return {
            "message": msg,
            "email_sent": email_sent,
            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2],
                "role": student[3],
                "is_active": student[4],
                "is_verified": student[5]
            }
        }

    except HTTPException:

        conn.rollback()
        raise

    except Exception as e:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create student: {e}"
        )

    finally:

        cursor.close()
        conn.close()


# ============================================================
# Get Students (org-scoped)
# ============================================================

@router.get("/students")
def get_students(
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                role,
                is_active
            FROM users
            WHERE LOWER(role) = 'student'
            AND organization_id = %s
            ORDER BY id
            """,
            (org_id,)
        )

        students = cursor.fetchall()


        result = []

        for student in students:

            result.append(
                {
                    "id": student[0],
                    "name": student[1],
                    "email": student[2],
                    "role": student[3],
                    "is_active": student[4]
                }
            )


        return {
            "students": result
        }


    finally:

        cursor.close()
        conn.close()


# ============================================================
# Get Student Assigned Courses (org-scoped)
# ============================================================

@router.get("/students/{student_id}/courses")
def get_student_assigned_courses(
    student_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # Check Student belongs to this admin's org
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name,
                email
            FROM users
            WHERE id = %s
            AND LOWER(role) = 'student'
            AND organization_id = %s
            """,
            (student_id, org_id)
        )

        student = cursor.fetchone()


        if not student:

            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )


        # ----------------------------------------------------
        # Get Assigned Courses
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                c.id,
                c.title,
                c.description,
                c.is_active,
                e.status,
                e.assigned_at,
                e.completed_at
            FROM enrollments e

            JOIN courses c
                ON c.id = e.course_id

            WHERE e.student_id = %s

            ORDER BY e.assigned_at DESC
            """,
            (student_id,)
        )

        courses = cursor.fetchall()


        result = []

        for course in courses:

            result.append(
                {
                    "id": course[0],
                    "title": course[1],
                    "description": course[2],
                    "is_active": course[3],
                    "status": course[4],
                    "assigned_at": course[5],
                    "completed_at": course[6]
                }
            )


        return {
            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2]
            },

            "courses": result
        }


    finally:

        cursor.close()
        conn.close()


# ============================================================
# Activate Student (org-scoped)
# ============================================================

@router.patch("/students/{student_id}/activate")
def activate_student(
    student_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            UPDATE users
            SET is_active = TRUE
            WHERE id = %s
            AND LOWER(role) = 'student'
            AND organization_id = %s
            RETURNING id, name, email, is_active
            """,
            (student_id, org_id)
        )

        student = cursor.fetchone()


        if not student:

            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )


        conn.commit()


        return {
            "message": "Student activated successfully",

            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2],
                "is_active": student[3]
            }
        }


    except HTTPException:

        conn.rollback()
        raise


    except Exception:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to activate student"
        )


    finally:

        cursor.close()
        conn.close()


# ============================================================
# Deactivate Student (org-scoped)
# ============================================================

@router.patch("/students/{student_id}/deactivate")
def deactivate_student(
    student_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s
            AND LOWER(role) = 'student'
            AND organization_id = %s
            RETURNING id, name, email, is_active
            """,
            (student_id, org_id)
        )

        student = cursor.fetchone()


        if not student:

            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )


        conn.commit()


        return {
            "message": "Student deactivated successfully",

            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2],
                "is_active": student[3]
            }
        }


    except HTTPException:

        conn.rollback()
        raise


    except Exception:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate student"
        )


    finally:

        cursor.close()
        conn.close()