from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_admin, require_student, get_current_user
from app.schemas.course import CourseCreateRequest, CourseUpdateRequest, AssignCourseRequest


router = APIRouter(
    prefix="/courses",
    tags=["Courses"]
)


# ============================================================
# Create Course (Admin only — bound to admin's organization)
# ============================================================

@router.post("/", status_code=201)
def create_course(
    course_data: CourseCreateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO courses
            (title, description, created_by, organization_id, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING id, title, description, created_by, is_active, created_at
            """,
            (
                course_data.title.strip(),
                course_data.description.strip(),
                current_user["id"],
                org_id
            )
        )

        course = cursor.fetchone()
        conn.commit()

        return {
            "message": "Course created successfully",
            "course": {
                "id": course[0],
                "title": course[1],
                "description": course[2],
                "created_by": course[3],
                "is_active": course[4],
                "created_at": course[5]
            }
        }

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create course"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get All Courses (Admin only — org-scoped)
# ============================================================

@router.get("/")
def get_courses(
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
                title,
                description,
                is_active,
                created_at
            FROM courses
            WHERE organization_id = %s
            ORDER BY id
            """,
            (org_id,)
        )

        courses = cursor.fetchall()

        return {
            "courses": [
                {
                    "id": course[0],
                    "title": course[1],
                    "description": course[2],
                    "is_active": course[3],
                    "created_at": course[4]
                }
                for course in courses
            ]
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Student's Assigned Courses (Student: own courses only)
# ============================================================

@router.get("/student/{student_id}")
def get_student_courses(
    student_id: int,
    current_user: dict = Depends(require_student)
):
    # Students can only access their own courses
    if current_user["id"] != student_id:
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
            JOIN courses c
                ON c.id = e.course_id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(cm.id) AS total_modules,
                    COUNT(
                        CASE WHEN mp.completed = TRUE THEN 1 END
                    ) AS completed_modules
                FROM course_modules cm
                LEFT JOIN module_progress mp
                    ON mp.module_id = cm.id
                    AND mp.student_id = %s
                WHERE cm.course_id = e.course_id
            ) AS course_progress
                ON TRUE
            WHERE e.student_id = %s
            ORDER BY e.assigned_at DESC
            """,
            (student_id, student_id)
        )

        courses = cursor.fetchall()

        return {
            "student_id": student_id,
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
            ]
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Student's Specific Course Detail (Student: own only)
# ============================================================

@router.get("/student/{student_id}/{course_id}")
def get_student_course(
    student_id: int,
    course_id: int,
    current_user: dict = Depends(require_student)
):
    # Students can only access their own courses
    if current_user["id"] != student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify enrollment
        cursor.execute(
            """
            SELECT
                c.id, c.title, c.description, c.is_active,
                e.status, e.assigned_at, e.completed_at
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            WHERE e.student_id = %s AND e.course_id = %s
            """,
            (student_id, course_id)
        )

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Course not found or not assigned to this student"
            )

        # Get PUBLISHED modules only with content and quizzes (no is_correct for student)
        cursor.execute(
            """
            SELECT
                id, title, description, module_order, created_at, updated_at,
                objectives, key_takeaways
            FROM course_modules
            WHERE course_id = %s AND is_published = TRUE
            ORDER BY module_order, id
            """,
            (course_id,)
        )

        modules = cursor.fetchall()
        module_list = []

        for module in modules:
            module_id = module[0]

            # Training content — include title
            cursor.execute(
                """
                SELECT id, content_type, title, content, content_order, created_at
                FROM training_contents
                WHERE module_id = %s
                ORDER BY content_order, id
                """,
                (module_id,)
            )
            contents = cursor.fetchall()

            # Module progress for this student
            cursor.execute(
                """
                SELECT completed, completed_at
                FROM module_progress
                WHERE student_id = %s AND module_id = %s
                """,
                (student_id, module_id)
            )
            progress = cursor.fetchone()

            # Quizzes WITHOUT is_correct
            cursor.execute(
                """
                SELECT id, title, description, passing_score, created_at
                FROM quizzes
                WHERE module_id = %s
                ORDER BY id
                """,
                (module_id,)
            )
            quizzes = cursor.fetchall()
            quiz_list = []

            for quiz in quizzes:
                quiz_id = quiz[0]
                cursor.execute(
                    """
                    SELECT
                        qq.id, qq.question_text, qq.question_order,
                        qo.id, qo.option_label, qo.option_text
                    FROM quiz_questions qq
                    LEFT JOIN quiz_options qo ON qo.question_id = qq.id
                    WHERE qq.quiz_id = %s
                    ORDER BY qq.question_order, qo.option_label
                    """,
                    (quiz_id,)
                )
                rows = cursor.fetchall()
                questions = {}
                for r in rows:
                    qid = r[0]
                    if qid not in questions:
                        questions[qid] = {
                            "id": qid,
                            "question_text": r[1],
                            "question_order": r[2],
                            "options": []
                        }
                    if r[3] is not None:
                        questions[qid]["options"].append({
                            "id": r[3],
                            "option_label": r[4],
                            "option_text": r[5]
                            # is_correct intentionally omitted
                        })

                # Best attempt for this quiz
                cursor.execute(
                    """
                    SELECT score, passed, attempted_at
                    FROM quiz_attempts
                    WHERE quiz_id = %s AND student_id = %s
                    ORDER BY attempted_at DESC
                    LIMIT 1
                    """,
                    (quiz_id, student_id)
                )
                attempt = cursor.fetchone()

                quiz_list.append({
                    "id": quiz[0],
                    "title": quiz[1],
                    "description": quiz[2],
                    "passing_score": quiz[3],
                    "created_at": quiz[4],
                    "last_attempt": {
                        "score": attempt[0],
                        "passed": attempt[1],
                        "attempted_at": attempt[2]
                    } if attempt else None,
                    "questions": list(questions.values())
                })

            module_list.append({
                "id": module[0],
                "title": module[1],
                "description": module[2],
                "module_order": module[3],
                "created_at": module[4],
                "updated_at": module[5],
                "objectives": list(module[6]) if module[6] else [],
                "key_takeaways": list(module[7]) if module[7] else [],
                "completed": progress[0] if progress else False,
                "completed_at": progress[1] if progress else None,
                "contents": [
                    {
                        "id": c[0],
                        "content_type": c[1],
                        "title": c[2],
                        "content": c[3],
                        "content_order": c[4],
                        "created_at": c[5]
                    }
                    for c in contents
                ],
                "quizzes": quiz_list
            })

        return {
            "course": {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "is_active": row[3],
                "status": row[4],
                "assigned_at": row[5],
                "completed_at": row[6],
                "modules": module_list
            }
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Complete Course Details (Admin only — org-scoped)
# ============================================================

@router.get("/{course_id}")
def get_course(
    course_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Course
        cursor.execute(
            """
            SELECT
                id, title, description, created_by,
                is_active, created_at, updated_at
            FROM courses
            WHERE id = %s AND organization_id = %s
            """,
            (course_id, org_id)
        )

        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        # Modules — include new authoring fields
        cursor.execute(
            """
            SELECT
                id, title, description, module_order, created_at, updated_at,
                is_published, objectives, key_takeaways
            FROM course_modules
            WHERE course_id = %s
            ORDER BY module_order, id
            """,
            (course_id,)
        )

        modules = cursor.fetchall()
        module_list = []

        for module in modules:
            module_id = module[0]

            # Training Content — include title
            cursor.execute(
                """
                SELECT id, content_type, title, content, content_order, created_at
                FROM training_contents
                WHERE module_id = %s
                ORDER BY content_order, id
                """,
                (module_id,)
            )
            contents = cursor.fetchall()

            content_list = [
                {
                    "id": c[0],
                    "content_type": c[1],
                    "title": c[2],
                    "content": c[3],
                    "content_order": c[4],
                    "created_at": c[5]
                }
                for c in contents
            ]

            # Quizzes (admin sees is_correct)
            cursor.execute(
                """
                SELECT id, title, description, passing_score, created_at, updated_at
                FROM quizzes
                WHERE module_id = %s
                ORDER BY id
                """,
                (module_id,)
            )
            quizzes = cursor.fetchall()
            quiz_list = []

            for quiz in quizzes:
                quiz_id = quiz[0]

                cursor.execute(
                    """
                    SELECT id, question_text, question_order, created_at
                    FROM quiz_questions
                    WHERE quiz_id = %s
                    ORDER BY question_order, id
                    """,
                    (quiz_id,)
                )
                questions = cursor.fetchall()
                question_list = []

                for question in questions:
                    question_id = question[0]

                    cursor.execute(
                        """
                        SELECT id, option_label, option_text, is_correct
                        FROM quiz_options
                        WHERE question_id = %s
                        ORDER BY option_label
                        """,
                        (question_id,)
                    )
                    options = cursor.fetchall()

                    question_list.append({
                        "id": question[0],
                        "question_text": question[1],
                        "question_order": question[2],
                        "created_at": question[3],
                        "options": [
                            {
                                "id": o[0],
                                "option_label": o[1],
                                "option_text": o[2],
                                "is_correct": o[3]  # Admin can see this
                            }
                            for o in options
                        ]
                    })

                quiz_list.append({
                    "id": quiz[0],
                    "title": quiz[1],
                    "description": quiz[2],
                    "passing_score": quiz[3],
                    "created_at": quiz[4],
                    "updated_at": quiz[5],
                    "questions": question_list
                })

            module_list.append({
                "id": module[0],
                "title": module[1],
                "description": module[2],
                "module_order": module[3],
                "created_at": module[4],
                "updated_at": module[5],
                "is_published": module[6],
                "objectives": list(module[7]) if module[7] else [],
                "key_takeaways": list(module[8]) if module[8] else [],
                "contents": content_list,
                "quizzes": quiz_list
            })

        # Enrolled Students
        cursor.execute(
            """
            SELECT
                u.id, u.name, u.email, u.is_active,
                e.status, e.assigned_at, e.completed_at
            FROM enrollments e
            JOIN users u ON u.id = e.student_id
            WHERE e.course_id = %s
            AND LOWER(u.role) = 'student'
            ORDER BY u.id
            """,
            (course_id,)
        )
        students = cursor.fetchall()

        return {
            "course": {
                "id": course[0],
                "title": course[1],
                "description": course[2],
                "created_by": course[3],
                "is_active": course[4],
                "created_at": course[5],
                "updated_at": course[6],
                "modules": module_list,
                "students": [
                    {
                        "student_id": s[0],
                        "student_name": s[1],
                        "email": s[2],
                        "is_active": s[3],
                        "status": s[4],
                        "assigned_at": s[5],
                        "completed_at": s[6]
                    }
                    for s in students
                ]
            }
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Course Progress (Admin only — org-scoped)
# ============================================================

@router.get("/{course_id}/progress")
def get_course_progress(
    course_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, title, description, is_active
            FROM courses
            WHERE id = %s AND organization_id = %s
            """,
            (course_id, org_id)
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        cursor.execute(
            """
            SELECT
                u.id,
                u.name,
                u.email,
                COUNT(DISTINCT cm.id) AS total_modules,
                COUNT(
                    DISTINCT CASE
                        WHEN mp.completed = TRUE THEN cm.id
                    END
                ) AS completed_modules
            FROM enrollments e
            JOIN users u ON u.id = e.student_id
            LEFT JOIN course_modules cm ON cm.course_id = e.course_id
            LEFT JOIN module_progress mp
                ON mp.module_id = cm.id
                AND mp.student_id = e.student_id
            WHERE e.course_id = %s
            AND LOWER(u.role) = 'student'
            GROUP BY u.id, u.name, u.email
            ORDER BY u.id
            """,
            (course_id,)
        )
        students = cursor.fetchall()

        student_progress = []
        total_course_progress = 0

        for s in students:
            total_modules = s[3]
            completed_modules = s[4]
            progress = round((completed_modules / total_modules) * 100) if total_modules > 0 else 0
            total_course_progress += progress

            student_progress.append({
                "student_id": s[0],
                "student_name": s[1],
                "email": s[2],
                "total_modules": total_modules,
                "completed_modules": completed_modules,
                "progress_percentage": progress
            })

        total_students = len(student_progress)
        average_progress = round(total_course_progress / total_students) if total_students > 0 else 0
        completed_students = sum(
            1 for s in student_progress if s["progress_percentage"] == 100
        )

        return {
            "course": {
                "id": course[0],
                "title": course[1],
                "description": course[2],
                "is_active": course[3]
            },
            "statistics": {
                "total_students": total_students,
                "completed_students": completed_students,
                "average_progress": average_progress
            },
            "students": student_progress
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Course (Admin only — org-scoped)
# ============================================================

@router.put("/{course_id}")
def update_course(
    course_id: int,
    course_data: CourseUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        fields = []
        values = []

        if course_data.title is not None:
            fields.append("title = %s")
            values.append(course_data.title.strip())
        if course_data.description is not None:
            fields.append("description = %s")
            values.append(course_data.description.strip())
        if course_data.is_active is not None:
            fields.append("is_active = %s")
            values.append(course_data.is_active)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.extend([course_id, org_id])

        cursor.execute(
            f"UPDATE courses SET {', '.join(fields)} WHERE id = %s AND organization_id = %s RETURNING id, title, description, is_active",
            tuple(values)
        )

        updated = cursor.fetchone()

        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        conn.commit()

        return {
            "message": "Course updated successfully",
            "course": {
                "id": updated[0],
                "title": updated[1],
                "description": updated[2],
                "is_active": updated[3]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update course"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Activate Course (Admin only — org-scoped)
# ============================================================

@router.patch("/{course_id}/activate")
def activate_course(
    course_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE courses
            SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND organization_id = %s
            RETURNING id, title, is_active
            """,
            (course_id, org_id)
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        conn.commit()

        return {
            "message": "Course activated successfully",
            "course": {
                "id": course[0],
                "title": course[1],
                "is_active": course[2]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to activate course"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Deactivate Course (Admin only — org-scoped)
# ============================================================

@router.patch("/{course_id}/deactivate")
def deactivate_course(
    course_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE courses
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND organization_id = %s
            RETURNING id, title, is_active
            """,
            (course_id, org_id)
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        conn.commit()

        return {
            "message": "Course deactivated successfully",
            "course": {
                "id": course[0],
                "title": course[1],
                "is_active": course[2]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate course"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Assign Course to Student (Admin only — org-scoped)
# ============================================================

@router.post("/{course_id}/assign", status_code=201)
def assign_course(
    course_id: int,
    assign_data: AssignCourseRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify course exists, is active, and belongs to admin's organization
        cursor.execute(
            "SELECT id FROM courses WHERE id = %s AND organization_id = %s AND is_active = TRUE",
            (course_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Course not found or not active"
            )

        # Verify student exists, is active, and belongs to admin's organization
        cursor.execute(
            """
            SELECT id FROM users
            WHERE id = %s AND organization_id = %s AND LOWER(role) = 'student' AND is_active = TRUE
            """,
            (assign_data.student_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Student not found or not active"
            )

        # Prevent duplicate assignment
        cursor.execute(
            """
            SELECT id FROM enrollments
            WHERE student_id = %s AND course_id = %s
            """,
            (assign_data.student_id, course_id)
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Student is already assigned to this course"
            )

        # Insert enrollment
        cursor.execute(
            """
            INSERT INTO enrollments (student_id, course_id, status, assigned_at)
            VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
            RETURNING id, student_id, course_id, status, assigned_at
            """,
            (assign_data.student_id, course_id)
        )
        enrollment = cursor.fetchone()
        conn.commit()

        return {
            "message": "Course assigned to student successfully",
            "enrollment": {
                "id": enrollment[0],
                "student_id": enrollment[1],
                "course_id": enrollment[2],
                "status": enrollment[3],
                "assigned_at": enrollment[4]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to assign course"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Remove Course Assignment (Admin only — org-scoped)
# ============================================================

@router.delete("/{course_id}/assign/{student_id}", status_code=200)
def unassign_course(
    course_id: int,
    student_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify course belongs to admin's org
        cursor.execute(
            "SELECT id FROM courses WHERE id = %s AND organization_id = %s",
            (course_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )

        cursor.execute(
            """
            DELETE FROM enrollments
            WHERE student_id = %s AND course_id = %s
            """,
            (student_id, course_id)
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Enrollment not found"
            )

        conn.commit()

        return {"message": "Course assignment removed successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to remove assignment"
        )

    finally:
        cursor.close()
        conn.close()