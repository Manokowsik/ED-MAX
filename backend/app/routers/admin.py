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
                (SELECT COUNT(DISTINCT u.id) FROM users u
                    JOIN organization_memberships om ON om.user_id = u.id
                    WHERE LOWER(u.role) = 'student'
                    AND om.organization_id = %s
                    AND om.is_active = TRUE)                                AS total_students,
                (SELECT COUNT(DISTINCT u.id) FROM users u
                    JOIN organization_memberships om ON om.user_id = u.id
                    WHERE LOWER(u.role) = 'student'
                    AND u.is_active = TRUE
                    AND om.organization_id = %s
                    AND om.is_active = TRUE)                                AS active_students,
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
    """
    Create or add a student to the admin's organization.

    Scenarios:
      1. Email doesn't exist → create new user, membership, send activation email.
      2. Email exists, role=STUDENT, NOT yet in this org → add membership, send org invitation.
      3. Email exists, role=STUDENT, already in this org → return descriptive message (400).
      4. Email exists, role != STUDENT → 400 (do NOT convert non-student accounts).
    """
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ------------------------------------------------
        # Normalize email (case-insensitive lookup)
        # ------------------------------------------------
        normalized_email = student_data.email.strip().lower()

        cursor.execute(
            """
            SELECT id, name, email, role, is_active, is_verified, organization_id, deleted_at
            FROM users
            WHERE LOWER(email) = %s
            """,
            (normalized_email,)
        )
        existing = cursor.fetchone()

        # ------------------------------------------------
        # Resolve org name (needed for invitation emails)
        # ------------------------------------------------
        cursor.execute(
            "SELECT name FROM organizations WHERE id = %s",
            (org_id,)
        )
        org_row = cursor.fetchone()
        org_name = org_row[0] if org_row else "your organization"

        if existing:
            user_id   = existing[0]
            user_name = existing[1]
            user_email = existing[2]
            user_role  = existing[3].upper()

            # --- Scenario 4: Non-student account ---
            if user_role != "STUDENT":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "An account with this email already exists with a different role. "
                        "Contact your administrator."
                    )
                )

            # --- Check existing org membership ---
            cursor.execute(
                """
                SELECT is_active FROM organization_memberships
                WHERE user_id = %s AND organization_id = %s
                """,
                (user_id, org_id)
            )
            membership = cursor.fetchone()

            if membership and membership[0]:
                # --- Scenario 3: Already an active member of this org ---
                if student_data.course_id:
                    from app.services.enrollment_service import enroll_student_in_course, notify_enrollment
                    status_res, enrollment = enroll_student_in_course(
                        cursor,
                        student_id=user_id,
                        course_id=student_data.course_id,
                        org_id=org_id
                    )
                    if status_res == "course_not_found":
                        raise HTTPException(status_code=404, detail="Course not found or inactive")

                    conn.commit()
                    notify_enrollment(
                        conn,
                        student={"id": user_id, "name": user_name, "email": user_email, "organization_id": org_id},
                        actor_name=current_user.get("name") or "Administrator",
                        course_id=student_data.course_id,
                        course_title=enrollment["course_title"],
                        send_email=existing[4],  # only email if already active
                    )
                    msg = (
                        f"Student enrolled in {enrollment['course_title']}."
                        if status_res == "created"
                        else f"Student is already enrolled in {enrollment['course_title']}."
                    )
                    return {
                        "message": msg,
                        "already_existed": True,
                        "enrolled": status_res == "created",
                        "student": {
                            "id": user_id, "name": user_name, "email": user_email,
                            "role": existing[3], "is_active": existing[4], "is_verified": existing[5]
                        },
                        "enrollment": enrollment
                    }

                raise HTTPException(
                    status_code=400,
                    detail="This student is already part of your organization."
                )

            # --- Scenario 2: Existing student, NOT yet in this org ---
            # Insert (or reactivate) the membership row
            cursor.execute(
                """
                INSERT INTO organization_memberships (user_id, organization_id, is_active, joined_at)
                VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, organization_id)
                DO UPDATE SET is_active = TRUE, joined_at = CURRENT_TIMESTAMP
                """,
                (user_id, org_id)
            )

            enrollment_info = None
            if student_data.course_id:
                from app.services.enrollment_service import enroll_student_in_course
                _, enrollment_info = enroll_student_in_course(
                    cursor,
                    student_id=user_id,
                    course_id=student_data.course_id,
                    org_id=org_id
                )

            conn.commit()

            # Send org invitation email (no password needed — account already exists)
            from app.services.auth_service import AuthService
            email_sent = True
            try:
                AuthService.create_org_invitation(
                    conn,
                    user_id=user_id,
                    org_id=org_id,
                    name=user_name,
                    email=user_email,
                    org_name=org_name,
                )
                logger.info(f"[ORG INVITE] Sent org invitation to {user_email} for org {org_id}")
            except Exception as e:
                email_sent = False
                logger.error(f"[ORG INVITE ERROR] Failed to send org invitation to {user_email}: {e}")

            msg = (
                "An organization invitation has been sent to the student."
                if email_sent
                else "Student added to your organization, but the invitation email could not be sent."
            )
            return {
                "message": msg,
                "already_existed": True,
                "invitation_sent": email_sent,
                "student": {
                    "id": user_id, "name": user_name, "email": user_email,
                    "role": existing[3], "is_active": existing[4], "is_verified": existing[5]
                },
                "enrollment": enrollment_info
            }

        # ------------------------------------------------
        # Scenario 1: Brand-new user — create account + membership
        # ------------------------------------------------

        # Locked password placeholder; overwritten at activation
        hashed_password = password_hash.hash("")

        cursor.execute(
            """
            INSERT INTO users
                (name, email, password_hash, role, is_active, is_verified, organization_id)
            VALUES
                (%s, %s, %s, 'STUDENT', FALSE, FALSE, %s)
            RETURNING id, name, email, role, is_active, is_verified
            """,
            (student_data.name.strip(), normalized_email, hashed_password, org_id)
        )
        student = cursor.fetchone()
        student_id    = student[0]
        student_name  = student[1]
        student_email = student[2]

        # Insert org membership
        cursor.execute(
            """
            INSERT INTO organization_memberships (user_id, organization_id, is_active, joined_at)
            VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, organization_id) DO NOTHING
            """,
            (student_id, org_id)
        )

        enrollment_info = None
        if student_data.course_id:
            from app.services.enrollment_service import enroll_student_in_course
            _, enrollment_info = enroll_student_in_course(
                cursor,
                student_id=student_id,
                course_id=student_data.course_id,
                org_id=org_id
            )

        conn.commit()

        # Send activation email
        from app.services.auth_service import AuthService
        from app.services.enrollment_service import notify_invitation
        email_sent = True

        logger.info(f"[STUDENT CREATE] Name: {student_name} | Email: {student_email}")

        try:
            AuthService.create_student_activation(
                conn,
                user_id=student_id,
                name=student_name,
                email=student_email
            )
            notify_invitation(
                conn,
                student={"id": student_id, "name": student_name, "email": student_email, "organization_id": org_id},
                actor_name=current_user.get("name") or "Administrator"
            )
        except Exception as e:
            email_sent = False
            logger.error(f"[SMTP ERROR] Failed to send activation email for {student_email}: {e}")

        msg = (
            "Student created successfully. An activation email has been sent."
            if email_sent
            else "Student created, but the activation email could not be sent. Please resend the activation email."
        )

        return {
            "message": msg,
            "email_sent": email_sent,
            "student": {
                "id": student[0], "name": student[1], "email": student[2],
                "role": student[3], "is_active": student[4], "is_verified": student[5]
            },
            "enrollment": enrollment_info
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create student: {e}")

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
        # Use organization_memberships as the authoritative org-user link
        cursor.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u.is_active
            FROM users u
            JOIN organization_memberships om ON om.user_id = u.id
            WHERE LOWER(u.role) = 'student'
              AND om.organization_id = %s
              AND om.is_active = TRUE
            ORDER BY u.id
            """,
            (org_id,)
        )

        students = cursor.fetchall()

        result = [
            {
                "id": s[0],
                "name": s[1],
                "email": s[2],
                "role": s[3],
                "is_active": s[4]
            }
            for s in students
        ]

        return {"students": result}

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
        # Check Student belongs to this admin's org via membership
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT u.id, u.name, u.email
            FROM users u
            JOIN organization_memberships om ON om.user_id = u.id
            WHERE u.id = %s
              AND LOWER(u.role) = 'student'
              AND om.organization_id = %s
              AND om.is_active = TRUE
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

        # Verify student belongs to this org (via membership) before updating
        cursor.execute(
            """
            SELECT u.id FROM users u
            JOIN organization_memberships om ON om.user_id = u.id
            WHERE u.id = %s
              AND LOWER(u.role) = 'student'
              AND om.organization_id = %s
              AND om.is_active = TRUE
            """,
            (student_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")

        cursor.execute(
            """
            UPDATE users
            SET is_active = TRUE
            WHERE id = %s AND LOWER(role) = 'student'
            RETURNING id, name, email, is_active
            """,
            (student_id,)
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

        # Verify student belongs to this org (via membership) before updating
        cursor.execute(
            """
            SELECT u.id FROM users u
            JOIN organization_memberships om ON om.user_id = u.id
            WHERE u.id = %s
              AND LOWER(u.role) = 'student'
              AND om.organization_id = %s
              AND om.is_active = TRUE
            """,
            (student_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")

        cursor.execute(
            """
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s AND LOWER(role) = 'student'
            RETURNING id, name, email, is_active
            """,
            (student_id,)
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