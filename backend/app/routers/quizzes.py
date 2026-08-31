from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_admin, require_student
from app.schemas.quiz import (
    QuizCreateRequest,
    QuizUpdateRequest,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    OptionCreateRequest,
    OptionUpdateRequest,
    SubmitQuizRequest
)


router = APIRouter(
    prefix="/quizzes",
    tags=["Quizzes"]
)


# ============================================================
# Create Quiz (Admin only — org-scoped)
# ============================================================

@router.post("/", status_code=201)
def create_quiz(
    quiz_data: QuizCreateRequest,
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
            (quiz_data.module_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Module not found"
            )

        # Validate passing_score
        if not (0 <= quiz_data.passing_score <= 100):
            raise HTTPException(
                status_code=400,
                detail="passing_score must be between 0 and 100"
            )

        cursor.execute(
            """
            INSERT INTO quizzes (module_id, title, description, passing_score)
            VALUES (%s, %s, %s, %s)
            RETURNING id, module_id, title, description, passing_score, created_at
            """,
            (
                quiz_data.module_id,
                quiz_data.title.strip(),
                quiz_data.description.strip(),
                quiz_data.passing_score
            )
        )
        quiz = cursor.fetchone()
        conn.commit()

        return {
            "message": "Quiz created successfully",
            "quiz": {
                "id": quiz[0],
                "module_id": quiz[1],
                "title": quiz[2],
                "description": quiz[3],
                "passing_score": quiz[4],
                "created_at": quiz[5]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create quiz"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Create Question (Admin only — org-scoped)
# ============================================================

@router.post("/{quiz_id}/questions", status_code=201)
def create_question(
    quiz_id: int,
    question_data: QuestionCreateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT q.id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE q.id = %s AND c.organization_id = %s
            """,
            (quiz_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Quiz not found"
            )

        cursor.execute(
            """
            INSERT INTO quiz_questions (quiz_id, question_text, question_order)
            VALUES (%s, %s, %s)
            RETURNING id, quiz_id, question_text, question_order, created_at
            """,
            (
                quiz_id,
                question_data.question_text.strip(),
                question_data.question_order
            )
        )
        question = cursor.fetchone()
        conn.commit()

        return {
            "message": "Question created successfully",
            "question": {
                "id": question[0],
                "quiz_id": question[1],
                "question_text": question[2],
                "question_order": question[3],
                "created_at": question[4]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create question"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Create Option (Admin only — org-scoped)
# ============================================================

@router.post("/questions/{question_id}/options", status_code=201)
def create_option(
    question_id: int,
    option_data: OptionCreateRequest,
    current_user: dict = Depends(require_admin)
):
    if option_data.option_label not in ("A", "B", "C", "D"):
        raise HTTPException(
            status_code=400,
            detail="option_label must be A, B, C, or D"
        )

    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT qq.id
            FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qq.id = %s AND c.organization_id = %s
            """,
            (question_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Question not found"
            )

        cursor.execute(
            """
            INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
            VALUES (%s, %s, %s, %s)
            RETURNING id, question_id, option_label, option_text, is_correct
            """,
            (
                question_id,
                option_data.option_label,
                option_data.option_text.strip(),
                option_data.is_correct
            )
        )
        option = cursor.fetchone()
        conn.commit()

        return {
            "message": "Option created successfully",
            "option": {
                "id": option[0],
                "question_id": option[1],
                "option_label": option[2],
                "option_text": option[3],
                "is_correct": option[4]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create option"
        )

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Quiz (Admin only — org-scoped)
# ============================================================

@router.put("/{quiz_id}")
def update_quiz(
    quiz_id: int,
    quiz_data: QuizUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT q.id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE q.id = %s AND c.organization_id = %s
            """,
            (quiz_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Quiz not found")

        fields = []
        values = []

        if quiz_data.title is not None:
            fields.append("title = %s")
            values.append(quiz_data.title.strip())
        if quiz_data.description is not None:
            fields.append("description = %s")
            values.append(quiz_data.description.strip())
        if quiz_data.passing_score is not None:
            if not (0 <= quiz_data.passing_score <= 100):
                raise HTTPException(
                    status_code=400,
                    detail="passing_score must be between 0 and 100"
                )
            fields.append("passing_score = %s")
            values.append(quiz_data.passing_score)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(quiz_id)

        cursor.execute(
            f"UPDATE quizzes SET {', '.join(fields)} WHERE id = %s "
            f"RETURNING id, title, description, passing_score",
            tuple(values)
        )
        updated = cursor.fetchone()

        conn.commit()

        return {
            "message": "Quiz updated successfully",
            "quiz": {
                "id": updated[0],
                "title": updated[1],
                "description": updated[2],
                "passing_score": updated[3]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to update quiz")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Delete Quiz (Admin only — org-scoped)
# ============================================================

@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT q.id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE q.id = %s AND c.organization_id = %s
            """,
            (quiz_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Quiz not found")

        # Delete options → questions → quiz (cascade order)
        cursor.execute(
            """
            DELETE FROM quiz_options
            WHERE question_id IN (
                SELECT id FROM quiz_questions WHERE quiz_id = %s
            )
            """,
            (quiz_id,)
        )
        cursor.execute(
            "DELETE FROM quiz_questions WHERE quiz_id = %s",
            (quiz_id,)
        )
        cursor.execute(
            "DELETE FROM quizzes WHERE id = %s",
            (quiz_id,)
        )

        conn.commit()
        return {"message": "Quiz deleted successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete quiz")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Question (Admin only — org-scoped)
# ============================================================

@router.put("/questions/{question_id}")
def update_question(
    question_id: int,
    question_data: QuestionUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT qq.id
            FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qq.id = %s AND c.organization_id = %s
            """,
            (question_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Question not found")

        fields = []
        values = []

        if question_data.question_text is not None:
            fields.append("question_text = %s")
            values.append(question_data.question_text.strip())
        if question_data.question_order is not None:
            fields.append("question_order = %s")
            values.append(question_data.question_order)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        values.append(question_id)
        cursor.execute(
            f"UPDATE quiz_questions SET {', '.join(fields)} WHERE id = %s "
            f"RETURNING id, question_text, question_order",
            tuple(values)
        )
        updated = cursor.fetchone()

        conn.commit()
        return {
            "message": "Question updated successfully",
            "question": {
                "id": updated[0],
                "question_text": updated[1],
                "question_order": updated[2]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to update question")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Delete Question (Admin only — org-scoped)
# ============================================================

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT qq.id
            FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qq.id = %s AND c.organization_id = %s
            """,
            (question_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Question not found")

        cursor.execute(
            "DELETE FROM quiz_options WHERE question_id = %s",
            (question_id,)
        )
        cursor.execute(
            "DELETE FROM quiz_questions WHERE id = %s",
            (question_id,)
        )

        conn.commit()
        return {"message": "Question deleted successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete question")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Update Option (Admin only — org-scoped)
# ============================================================

@router.put("/questions/{question_id}/options/{option_id}")
def update_option(
    question_id: int,
    option_id: int,
    option_data: OptionUpdateRequest,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify option belongs to question and question belongs to admin's organization
        cursor.execute(
            """
            SELECT qo.id
            FROM quiz_options qo
            JOIN quiz_questions qq ON qq.id = qo.question_id
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qo.id = %s AND qo.question_id = %s AND c.organization_id = %s
            """,
            (option_id, question_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Option not found for this question"
            )

        fields = []
        values = []

        if option_data.option_text is not None:
            fields.append("option_text = %s")
            values.append(option_data.option_text.strip())

        if option_data.is_correct is not None:
            if option_data.is_correct:
                # Unset all other options for this question first
                cursor.execute(
                    "UPDATE quiz_options SET is_correct = FALSE WHERE question_id = %s",
                    (question_id,)
                )
            fields.append("is_correct = %s")
            values.append(option_data.is_correct)

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided to update"
            )

        values.extend([option_id, question_id])
        cursor.execute(
            f"UPDATE quiz_options SET {', '.join(fields)} "
            f"WHERE id = %s AND question_id = %s "
            f"RETURNING id, option_label, option_text, is_correct",
            tuple(values)
        )
        updated = cursor.fetchone()

        conn.commit()
        return {
            "message": "Option updated successfully",
            "option": {
                "id": updated[0],
                "option_label": updated[1],
                "option_text": updated[2],
                "is_correct": updated[3]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to update option")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Delete Option (Admin only — org-scoped)
# ============================================================

@router.delete("/questions/{question_id}/options/{option_id}")
def delete_option(
    question_id: int,
    option_id: int,
    current_user: dict = Depends(require_admin)
):
    org_id = current_user["organization_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT qo.id
            FROM quiz_options qo
            JOIN quiz_questions qq ON qq.id = qo.question_id
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qo.id = %s AND qo.question_id = %s AND c.organization_id = %s
            """,
            (option_id, question_id, org_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Option not found")

        cursor.execute(
            "DELETE FROM quiz_options WHERE id = %s AND question_id = %s",
            (option_id, question_id)
        )

        conn.commit()
        return {"message": "Option deleted successfully"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete option")

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Get Quiz (Student only — enrolled students, no correct answers)
# ============================================================

@router.get("/{quiz_id}")
def get_quiz(
    quiz_id: int,
    current_user: dict = Depends(require_student)
):
    student_id = current_user["id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Get quiz and associated course
        cursor.execute(
            """
            SELECT
                q.id, q.title, q.description, q.passing_score,
                cm.course_id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            WHERE q.id = %s
            """,
            (quiz_id,)
        )
        quiz = cursor.fetchone()

        if not quiz:
            raise HTTPException(
                status_code=404,
                detail="Quiz not found"
            )

        course_id = quiz[4]

        # Verify student is enrolled
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

        # Get questions + options WITHOUT is_correct
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
        for row in rows:
            qid = row[0]
            if qid not in questions:
                questions[qid] = {
                    "id": qid,
                    "question_text": row[1],
                    "question_order": row[2],
                    "options": []
                }
            if row[3] is not None:
                questions[qid]["options"].append({
                    "id": row[3],
                    "option_label": row[4],
                    "option_text": row[5]
                    # is_correct intentionally omitted
                })

        return {
            "quiz": {
                "id": quiz[0],
                "title": quiz[1],
                "description": quiz[2],
                "passing_score": quiz[3],
                "questions": list(questions.values())
            }
        }

    finally:
        cursor.close()
        conn.close()


# ============================================================
# Submit Quiz (Student only — own submission only)
# ============================================================

@router.post("/{quiz_id}/submit")
def submit_quiz(
    quiz_id: int,
    submission: SubmitQuizRequest,
    current_user: dict = Depends(require_student)
):
    student_id = current_user["id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Get quiz details and course
        cursor.execute(
            """
            SELECT q.id, q.passing_score, cm.course_id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            WHERE q.id = %s
            """,
            (quiz_id,)
        )
        quiz = cursor.fetchone()

        if not quiz:
            raise HTTPException(
                status_code=404,
                detail="Quiz not found"
            )

        passing_score = quiz[1]
        course_id = quiz[2]

        # Verify student is enrolled
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

        # Validate that all questions are answered
        cursor.execute(
            """
            SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = %s
            """,
            (quiz_id,)
        )
        total_questions = cursor.fetchone()[0]

        if total_questions == 0:
            raise HTTPException(
                status_code=400,
                detail="Quiz has no questions"
            )

        # Get correct answers (server-side only — never sent to client)
        cursor.execute(
            """
            SELECT qq.id, qo.option_label
            FROM quiz_questions qq
            JOIN quiz_options qo ON qo.question_id = qq.id
            WHERE qq.quiz_id = %s AND qo.is_correct = TRUE
            """,
            (quiz_id,)
        )
        correct_answers = cursor.fetchall()

        # Calculate score
        correct_count = 0
        for question_id, correct_option in correct_answers:
            student_answer = submission.answers.get(str(question_id))
            if student_answer == correct_option:
                correct_count += 1

        score = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
        passed = score >= passing_score

        # Save quiz attempt
        cursor.execute(
            """
            INSERT INTO quiz_attempts (quiz_id, student_id, score, passed)
            VALUES (%s, %s, %s, %s)
            RETURNING id, attempted_at
            """,
            (quiz_id, student_id, score, passed)
        )
        attempt = cursor.fetchone()
        conn.commit()

        return {
            "message": "Quiz submitted successfully",
            "result": {
                "attempt_id": attempt[0],
                "quiz_id": quiz_id,
                "total_questions": total_questions,
                "correct_answers": correct_count,
                "score": score,
                "passing_score": passing_score,
                "passed": passed,
                "attempted_at": attempt[1]
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to submit quiz"
        )

    finally:
        cursor.close()
        conn.close()