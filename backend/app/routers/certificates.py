import uuid

from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_student, get_current_user


router = APIRouter(
    prefix="/certificates",
    tags=["Certificates"]
)


# ============================================================
# Generate Certificate (Student only — own certificate only)
# ============================================================

@router.post("/courses/{course_id}", status_code=201)
def generate_certificate(
    course_id: int,
    current_user: dict = Depends(require_student)
):
    student_id = current_user["id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify student exists and is active
        cursor.execute(
            """
            SELECT id, name
            FROM users
            WHERE id = %s AND role = 'STUDENT' AND is_active = TRUE
            """,
            (student_id,)
        )
        student = cursor.fetchone()

        if not student:
            raise HTTPException(
                status_code=404,
                detail="Student not found or not active"
            )

        # Verify course exists and is active
        cursor.execute(
            """
            SELECT id, title
            FROM courses
            WHERE id = %s AND is_active = TRUE
            """,
            (course_id,)
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found or not active"
            )

        # Verify student is enrolled and enrollment is COMPLETED
        cursor.execute(
            """
            SELECT status FROM enrollments
            WHERE student_id = %s AND course_id = %s
            """,
            (student_id, course_id)
        )
        enrollment = cursor.fetchone()

        if not enrollment:
            raise HTTPException(
                status_code=403,
                detail="You are not enrolled in this course"
            )

        # Check all modules are completed
        cursor.execute(
            """
            SELECT
                COUNT(cm.id) AS total_modules,
                COUNT(mp.id) FILTER (WHERE mp.completed = TRUE) AS completed_modules
            FROM course_modules cm
            LEFT JOIN module_progress mp
                ON mp.module_id = cm.id AND mp.student_id = %s
            WHERE cm.course_id = %s
            """,
            (student_id, course_id)
        )
        total_modules, completed_modules = cursor.fetchone()

        if total_modules == 0 or completed_modules != total_modules:
            raise HTTPException(
                status_code=400,
                detail="You must complete all course modules before generating a certificate"
            )

        # Prevent duplicate certificate — return existing if present
        cursor.execute(
            """
            SELECT id, certificate_number, final_score, issued_at
            FROM certificates
            WHERE student_id = %s AND course_id = %s
            """,
            (student_id, course_id)
        )
        existing = cursor.fetchone()

        if existing:
            return {
                "message": "Certificate already exists",
                "certificate": {
                    "id": existing[0],
                    "certificate_number": existing[1],
                    "student_name": student[1],
                    "course_title": course[1],
                    "final_score": existing[2],
                    "issued_at": existing[3]
                }
            }

        # Calculate final score from best quiz attempts
        cursor.execute(
            """
            SELECT COALESCE(ROUND(AVG(best.score)), 0)
            FROM (
                SELECT DISTINCT ON (qa.quiz_id)
                    qa.quiz_id,
                    qa.score
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                JOIN course_modules cm ON cm.id = q.module_id
                WHERE qa.student_id = %s AND cm.course_id = %s
                ORDER BY qa.quiz_id, qa.score DESC
            ) best
            """,
            (student_id, course_id)
        )
        final_score = cursor.fetchone()[0]

        # If no quiz attempts, default final score to 100 (content-only course)
        if final_score is None:
            final_score = 100

        # Generate unique certificate number
        unique_suffix = uuid.uuid4().hex[:8].upper()
        certificate_number = f"CERT-{course_id}-{student_id}-{unique_suffix}"

        # Create certificate
        cursor.execute(
            """
            INSERT INTO certificates
            (student_id, course_id, certificate_number, final_score)
            VALUES (%s, %s, %s, %s)
            RETURNING id, certificate_number, final_score, issued_at
            """,
            (student_id, course_id, certificate_number, final_score)
        )
        certificate = cursor.fetchone()
        conn.commit()

        return {
            "message": "Certificate generated successfully",
            "certificate": {
                "id": certificate[0],
                "certificate_number": certificate[1],
                "student_name": student[1],
                "course_title": course[1],
                "final_score": certificate[2],
                "issued_at": certificate[3]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to generate certificate"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Certificate by ID (authenticated — admin or owning student)
# ============================================================

@router.get("/{certificate_id}")
def get_certificate(
    certificate_id: int,
    current_user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                c.id,
                c.certificate_number,
                c.final_score,
                c.issued_at,
                c.student_id,
                u.name AS student_name,
                co.title AS course_title
            FROM certificates c
            JOIN users u ON u.id = c.student_id
            JOIN courses co ON co.id = c.course_id
            WHERE c.id = %s
            """,
            (certificate_id,)
        )
        certificate = cursor.fetchone()

        if not certificate:
            raise HTTPException(
                status_code=404,
                detail="Certificate not found"
            )

        # Students can only see their own certificates
        if (
            current_user["role"].upper() == "STUDENT"
            and current_user["id"] != certificate[4]
        ):
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

        return {
            "certificate": {
                "id": certificate[0],
                "certificate_number": certificate[1],
                "student_name": certificate[5],
                "course_title": certificate[6],
                "final_score": certificate[2],
                "issued_at": certificate[3]
            }
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve certificate"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Student Certificates (Student: own only, Admin: any)
# ============================================================

@router.get("/student/{student_id}")
def get_student_certificates(
    student_id: int,
    current_user: dict = Depends(get_current_user)
):
    # Students can only see their own certificates
    if (
        current_user["role"].upper() == "STUDENT"
        and current_user["id"] != student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                cert.id,
                cert.certificate_number,
                cert.final_score,
                cert.issued_at,
                co.id AS course_id,
                co.title AS course_title
            FROM certificates cert
            JOIN courses co ON co.id = cert.course_id
            WHERE cert.student_id = %s
            ORDER BY cert.issued_at DESC
            """,
            (student_id,)
        )
        certificates = cursor.fetchall()

        return {
            "student_id": student_id,
            "certificates": [
                {
                    "id": c[0],
                    "certificate_number": c[1],
                    "final_score": c[2],
                    "issued_at": c[3],
                    "course_id": c[4],
                    "course_title": c[5]
                }
                for c in certificates
            ]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve student certificates"
        )

    finally:
        cursor.close()
        conn.close()