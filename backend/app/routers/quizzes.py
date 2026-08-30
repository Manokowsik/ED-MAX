from fastapi import APIRouter, HTTPException, Depends

from app.db.database import get_connection
from app.core.security import require_admin, require_student
from app.schemas.quiz import (
    QuizCreateRequest,
    QuestionCreateRequest,
    OptionCreateRequest,
    SubmitQuizRequest
)


router = APIRouter(
    prefix="/quizzes",
    tags=["Quizzes"]
)


# ============================================================
# Create Quiz (Admin only)
# ============================================================

@router.post("/", status_code=201)
def create_quiz(
    quiz_data: QuizCreateRequest,
    current_user: dict = Depends(require_admin)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify module exists
        cursor.execute(
            "SELECT id FROM course_modules WHERE id = %s",
            (quiz_data.module_id,)
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
# Create Question (Admin only)
# ============================================================

@router.post("/{quiz_id}/questions", status_code=201)
def create_question(
    quiz_id: int,
    question_data: QuestionCreateRequest,
    current_user: dict = Depends(require_admin)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM quizzes WHERE id = %s",
            (quiz_id,)
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
# Create Option (Admin only)
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

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM quiz_questions WHERE id = %s",
            (question_id,)
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