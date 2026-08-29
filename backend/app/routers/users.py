from fastapi import APIRouter, HTTPException
from pwdlib import PasswordHash

from app.db.database import get_connection
from app.schemas.user import CreateStudentRequest


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

password_hash = PasswordHash.recommended()


# ============================================================
# Create Student
# ============================================================

@router.post("/students")
def create_student(student_data: CreateStudentRequest):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # Check whether email already exists
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
        # Hash Password
        # ----------------------------------------------------

        hashed_password = password_hash.hash(
            student_data.password
        )


        # ----------------------------------------------------
        # Create Student
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO users
            (
                name,
                email,
                password_hash,
                role,
                is_active
            )
            VALUES
            (
                %s,
                %s,
                %s,
                'STUDENT',
                TRUE
            )
            RETURNING
                id,
                name,
                email,
                role,
                is_active
            """,
            (
                student_data.name,
                student_data.email,
                hashed_password
            )
        )

        student = cursor.fetchone()

        conn.commit()


        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {
            "message": "Student created successfully",
            "student": {
                "id": student[0],
                "name": student[1],
                "email": student[2],
                "role": student[3],
                "is_active": student[4]
            }
        }


    except HTTPException:

        conn.rollback()
        raise


    except Exception as e:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    finally:

        cursor.close()
        conn.close()


# ============================================================
# Get Student Assigned Courses
# ============================================================

@router.get("/students/{student_id}/courses")
def get_student_assigned_courses(student_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # ----------------------------------------------------
        # Check Student
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
            """,
            (student_id,)
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


        # ----------------------------------------------------
        # Build Response
        # ----------------------------------------------------

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