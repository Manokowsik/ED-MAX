from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_admin, require_student
from app.schemas.module import (
    ModuleCreateRequest,
    ModuleUpdateRequest,
    ContentCreateRequest,
    ContentUpdateRequest
)


router = APIRouter(
    prefix="/courses",
    tags=["Modules"]
)


# ============================================================
# Create Module (Admin only — org-scoped)
# ============================================================

@router.post("/{course_id}/modules", status_code=201)
def create_module(
    course_id: int,
    module_data: ModuleCreateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify course exists and belongs to admin's organization
        cursor.execute(
            """
            SELECT id FROM courses WHERE id = %s AND organization_id = %s AND is_active = TRUE
            """,
            (course_id, org_id)
        )

        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Course not found or not active"
            )

        # Create module with new authoring fields
        cursor.execute(
            """
            INSERT INTO course_modules
            (course_id, title, description, module_order, objectives, key_takeaways, is_published)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, course_id, title, description, module_order,
                      objectives, key_takeaways, is_published, created_at
            """,
            (
                course_id,
                module_data.title.strip(),
                module_data.description.strip(),
                module_data.module_order,
                module_data.objectives,
                module_data.key_takeaways,
                module_data.is_published,
            )
        )

        module = cursor.fetchone()
        conn.commit()

        return {
            "message": "Module created successfully",
            "module": {
                "id": module[0],
                "course_id": module[1],
                "title": module[2],
                "description": module[3],
                "module_order": module[4],
                "objectives": list(module[5]) if module[5] else [],
                "key_takeaways": list(module[6]) if module[6] else [],
                "is_published": module[7],
                "created_at": module[8],
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create module"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Module (Admin only — org-scoped)
# ============================================================

@router.put("/modules/{module_id}")
def update_module(
    module_id: int,
    module_data: ModuleUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify module belongs to a course in admin's organization
        cursor.execute(
            """
            SELECT cm.id
            FROM course_modules cm
            JOIN courses c ON c.id = cm.course_id
            WHERE cm.id = %s AND c.organization_id = %s
            """,
            (module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Module not found"
            )

        fields = []
        values = []

        if module_data.title is not None:
            fields.append("title = %s")
            values.append(module_data.title.strip())
        if module_data.description is not None:
            fields.append("description = %s")
            values.append(module_data.description.strip())
        if module_data.module_order is not None:
            fields.append("module_order = %s")
            values.append(module_data.module_order)
        if module_data.objectives is not None:
            fields.append("objectives = %s")
            values.append(module_data.objectives)
        if module_data.key_takeaways is not None:
            fields.append("key_takeaways = %s")
            values.append(module_data.key_takeaways)
        if module_data.is_published is not None:
            fields.append("is_published = %s")
            values.append(module_data.is_published)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(module_id)

        cursor.execute(
            f"""
            UPDATE course_modules
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING id, course_id, title, description, module_order,
                      objectives, key_takeaways, is_published, updated_at
            """,
            tuple(values)
        )

        updated = cursor.fetchone()
        conn.commit()

        return {
            "message": "Module updated successfully",
            "module": {
                "id": updated[0],
                "course_id": updated[1],
                "title": updated[2],
                "description": updated[3],
                "module_order": updated[4],
                "objectives": list(updated[5]) if updated[5] else [],
                "key_takeaways": list(updated[6]) if updated[6] else [],
                "is_published": updated[7],
                "updated_at": updated[8],
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update module"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Delete Module (Admin only — org-scoped)
# ============================================================

@router.delete("/modules/{module_id}")
def delete_module(
    module_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify module belongs to a course in admin's organization
        cursor.execute(
            """
            SELECT cm.id
            FROM course_modules cm
            JOIN courses c ON c.id = cm.course_id
            WHERE cm.id = %s AND c.organization_id = %s
            """,
            (module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Module not found"
            )

        # Check for dependent training contents
        cursor.execute(
            "SELECT COUNT(*) FROM training_contents WHERE module_id = %s",
            (module_id,)
        )
        if cursor.fetchone()[0] > 0:
            raise HTTPException(
                status_code=409,
                detail="Module has training contents; delete them first"
            )

        # Check for dependent quizzes
        cursor.execute(
            "SELECT COUNT(*) FROM quizzes WHERE module_id = %s",
            (module_id,)
        )
        if cursor.fetchone()[0] > 0:
            raise HTTPException(
                status_code=409,
                detail="Module has quizzes; delete them first"
            )

        cursor.execute(
            "DELETE FROM course_modules WHERE id = %s",
            (module_id,)
        )

        conn.commit()

        return {"message": "Module deleted successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete module"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Create Training Content (Admin only — org-scoped)
# ============================================================

@router.post("/modules/{module_id}/content", status_code=201)
def create_training_content(
    module_id: int,
    content_data: ContentCreateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify module exists and belongs to a course in admin's organization
        cursor.execute(
            """
            SELECT cm.id
            FROM course_modules cm
            JOIN courses c ON c.id = cm.course_id
            WHERE cm.id = %s AND c.organization_id = %s
            """,
            (module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Module not found"
            )

        # Validate content type
        content_type = content_data.content_type.upper()
        if content_type not in ("TEXT", "VIDEO"):
            raise HTTPException(
                status_code=400,
                detail="content_type must be TEXT or VIDEO"
            )

        # Create content with title
        cursor.execute(
            """
            INSERT INTO training_contents
            (module_id, content_type, title, content, content_order)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, module_id, content_type, title, content, content_order, created_at
            """,
            (
                module_id,
                content_type,
                (content_data.title or "").strip(),
                content_data.content,
                content_data.content_order
            )
        )

        training_content = cursor.fetchone()
        conn.commit()

        return {
            "message": "Training content created successfully",
            "content": {
                "id": training_content[0],
                "module_id": training_content[1],
                "content_type": training_content[2],
                "title": training_content[3],
                "content": training_content[4],
                "content_order": training_content[5],
                "created_at": training_content[6]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create training content"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Training Content (Admin only — org-scoped)
# ============================================================

@router.put("/modules/{module_id}/content/{content_id}")
def update_training_content(
    module_id: int,
    content_id: int,
    content_data: ContentUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify content belongs to module and module belongs to admin's organization
        cursor.execute(
            """
            SELECT tc.id
            FROM training_contents tc
            JOIN course_modules cm ON cm.id = tc.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE tc.id = %s AND tc.module_id = %s AND c.organization_id = %s
            """,
            (content_id, module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Training content not found for this module"
            )

        fields = []
        values = []

        if content_data.content_type is not None:
            ct = content_data.content_type.upper()
            if ct not in ("TEXT", "VIDEO"):
                raise HTTPException(
                    status_code=400,
                    detail="content_type must be TEXT or VIDEO"
                )
            fields.append("content_type = %s")
            values.append(ct)
        if content_data.title is not None:
            fields.append("title = %s")
            values.append(content_data.title.strip())
        if content_data.content is not None:
            fields.append("content = %s")
            values.append(content_data.content)
        if content_data.content_order is not None:
            fields.append("content_order = %s")
            values.append(content_data.content_order)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        values.extend([content_id, module_id])

        cursor.execute(
            f"UPDATE training_contents SET {', '.join(fields)} WHERE id = %s AND module_id = %s",
            tuple(values)
        )

        conn.commit()

        return {"message": "Training content updated successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update training content"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Delete Training Content (Admin only — org-scoped)
# ============================================================

@router.delete("/modules/{module_id}/content/{content_id}")
def delete_training_content(
    module_id: int,
    content_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify content belongs to module and module belongs to admin's organization
        cursor.execute(
            """
            SELECT tc.id
            FROM training_contents tc
            JOIN course_modules cm ON cm.id = tc.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE tc.id = %s AND tc.module_id = %s AND c.organization_id = %s
            """,
            (content_id, module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Training content not found for this module"
            )

        cursor.execute(
            """
            DELETE FROM training_contents
            WHERE id = %s AND module_id = %s
            """,
            (content_id, module_id)
        )

        conn.commit()

        return {"message": "Training content deleted successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete training content"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Complete Module (Student only — own progress only)
# ============================================================

@router.post("/modules/{module_id}/complete")
def complete_module(
    module_id: int,
    current_user: dict = Depends(require_student)
):
    student_id = current_user["id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify module exists and get course
        cursor.execute(
            """
            SELECT id, course_id
            FROM course_modules
            WHERE id = %s
            """,
            (module_id,)
        )
        module = cursor.fetchone()

        if not module:
            raise HTTPException(
                status_code=404,
                detail="Module not found"
            )

        course_id = module[1]

        # Check student is enrolled in this course
        cursor.execute(
            """
            SELECT id FROM enrollments
            WHERE student_id = %s AND course_id = %s
            """,
            (student_id, course_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=403,
                detail="You are not enrolled in this course"
            )

        # --------------------------------------------------------
        # QUIZ PASS ENFORCEMENT
        # --------------------------------------------------------
        cursor.execute(
            """
            SELECT id FROM quizzes WHERE module_id = %s LIMIT 1
            """,
            (module_id,)
        )
        quiz_row = cursor.fetchone()

        if quiz_row is not None:
            quiz_id = quiz_row[0]
            cursor.execute(
                """
                SELECT id FROM quiz_attempts
                WHERE quiz_id = %s AND student_id = %s AND passed = TRUE
                LIMIT 1
                """,
                (quiz_id, student_id)
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You must pass the module quiz before marking "
                        "this module as complete"
                    )
                )

        # Mark module as completed (idempotent upsert)
        cursor.execute(
            """
            INSERT INTO module_progress
            (student_id, module_id, completed, completed_at)
            VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (student_id, module_id)
            DO UPDATE SET
                completed = TRUE,
                completed_at = CURRENT_TIMESTAMP
            RETURNING id, student_id, module_id, completed, completed_at
            """,
            (student_id, module_id)
        )
        progress = cursor.fetchone()

        # Calculate course progress
        cursor.execute(
            """
            SELECT
                COUNT(cm.id) AS total_modules,
                COUNT(CASE WHEN mp.completed = TRUE THEN 1 END) AS completed_modules
            FROM course_modules cm
            LEFT JOIN module_progress mp
                ON mp.module_id = cm.id AND mp.student_id = %s
            WHERE cm.course_id = %s
            """,
            (student_id, course_id)
        )
        course_progress = cursor.fetchone()
        total_modules = course_progress[0]
        completed_modules = course_progress[1]

        # Update enrollment status
        if total_modules > 0 and completed_modules == total_modules:
            cursor.execute(
                """
                UPDATE enrollments
                SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
                WHERE student_id = %s AND course_id = %s
                """,
                (student_id, course_id)
            )
            course_status = "COMPLETED"
        else:
            cursor.execute(
                """
                UPDATE enrollments
                SET status = 'IN_PROGRESS'
                WHERE student_id = %s AND course_id = %s
                AND completed_at IS NULL
                """,
                (student_id, course_id)
            )
            course_status = "IN_PROGRESS"

        conn.commit()

        progress_percentage = (
            round((completed_modules / total_modules) * 100)
            if total_modules > 0 else 0
        )

        return {
            "message": "Module completed successfully",
            "progress": {
                "id": progress[0],
                "student_id": progress[1],
                "module_id": progress[2],
                "completed": progress[3],
                "completed_at": progress[4]
            },
            "course": {
                "course_id": course_id,
                "total_modules": total_modules,
                "completed_modules": completed_modules,
                "progress_percentage": progress_percentage,
                "status": course_status
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to complete module"
        )

    finally:
        cursor.close()
        conn.close()