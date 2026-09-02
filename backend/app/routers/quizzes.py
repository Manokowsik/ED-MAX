import logging
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks

from app.db.database import get_connection
from app.core.security import require_admin, require_student
from app.schemas.quiz import (
    QuizCreateRequest,
    QuizUpdateRequest,
    QuestionCreateRequest,
    QuestionUpdateRequest,
    OptionCreateRequest,
    OptionUpdateRequest,
    SubmitQuizRequest,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


# ============================================================================
# TIER 1: PERSISTENCE & DATA ACCESS LAYER (Repository Pattern)
# ============================================================================

class QuizRepository:
    """Encapsulates all raw database transactions, queries, and row-mapping."""

    def __init__(self, cursor):
        self.cursor = cursor

    def _fetchone_dict(self) -> Optional[Dict[str, Any]]:
        row = self.cursor.fetchone()
        if not row:
            return None
        columns = [col[0] for col in self.cursor.description]
        return dict(zip(columns, row))

    def _fetchall_dict(self) -> List[Dict[str, Any]]:
        columns = [col[0] for col in self.cursor.description]
        return [dict(zip(columns, row)) for row in self.cursor.fetchall()]

    def verify_module_in_org(self, module_id: int, org_id: int) -> bool:
        self.cursor.execute(
            """
            SELECT 1 FROM course_modules cm
            JOIN courses c ON c.id = cm.course_id
            WHERE cm.id = %s AND c.organization_id = %s
            """,
            (module_id, org_id)
        )
        return bool(self.cursor.fetchone())

    def verify_quiz_in_org(self, quiz_id: int, org_id: int) -> bool:
        self.cursor.execute(
            """
            SELECT 1 FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE q.id = %s AND c.organization_id = %s
            """,
            (quiz_id, org_id)
        )
        return bool(self.cursor.fetchone())

    def verify_question_in_org(self, question_id: int, org_id: int) -> bool:
        self.cursor.execute(
            """
            SELECT 1 FROM quiz_questions qq
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qq.id = %s AND c.organization_id = %s
            """,
            (question_id, org_id)
        )
        return bool(self.cursor.fetchone())

    def verify_option_in_org(self, option_id: int, question_id: int, org_id: int) -> bool:
        self.cursor.execute(
            """
            SELECT 1
            FROM quiz_options qo
            JOIN quiz_questions qq ON qq.id = qo.question_id
            JOIN quizzes q ON q.id = qq.quiz_id
            JOIN course_modules cm ON cm.id = q.module_id
            JOIN courses c ON c.id = cm.course_id
            WHERE qo.id = %s AND qo.question_id = %s AND c.organization_id = %s
            """,
            (option_id, question_id, org_id)
        )
        return bool(self.cursor.fetchone())

    def is_student_enrolled(self, student_id: int, course_id: int) -> bool:
        self.cursor.execute(
            "SELECT 1 FROM enrollments WHERE student_id = %s AND course_id = %s",
            (student_id, course_id)
        )
        return bool(self.cursor.fetchone())

    def insert_quiz(self, module_id: int, title: str, description: str, passing_score: int) -> Dict[str, Any]:
        self.cursor.execute(
            """
            INSERT INTO quizzes (module_id, title, description, passing_score)
            VALUES (%s, %s, %s, %s)
            RETURNING id, module_id, title, description, passing_score, created_at
            """,
            (module_id, title, description, passing_score)
        )
        return self._fetchone_dict()

    def update_quiz_fields(self, quiz_id: int, fields: List[str], values: List[Any]) -> Dict[str, Any]:
        query = f"UPDATE quizzes SET {', '.join(fields)} WHERE id = %s RETURNING id, title, description, passing_score"
        self.cursor.execute(query, tuple(values))
        return self._fetchone_dict()

    def cascade_delete_quiz(self, quiz_id: int) -> None:
        self.cursor.execute(
            "DELETE FROM quiz_options WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id = %s)",
            (quiz_id,)
        )
        self.cursor.execute("DELETE FROM quiz_questions WHERE quiz_id = %s", (quiz_id,))
        self.cursor.execute("DELETE FROM quizzes WHERE id = %s", (quiz_id,))

    def insert_question(self, quiz_id: int, text: str, order: int) -> Dict[str, Any]:
        self.cursor.execute(
            """
            INSERT INTO quiz_questions (quiz_id, question_text, question_order)
            VALUES (%s, %s, %s)
            RETURNING id, quiz_id, question_text, question_order, created_at
            """,
            (quiz_id, text, order)
        )
        return self._fetchone_dict()

    def update_question_fields(self, question_id: int, fields: List[str], values: List[Any]) -> Dict[str, Any]:
        query = f"UPDATE quiz_questions SET {', '.join(fields)} WHERE id = %s RETURNING id, question_text, question_order"
        self.cursor.execute(query, tuple(values))
        return self._fetchone_dict()

    def delete_question_record(self, question_id: int) -> None:
        self.cursor.execute("DELETE FROM quiz_options WHERE question_id = %s", (question_id,))
        self.cursor.execute("DELETE FROM quiz_questions WHERE id = %s", (question_id,))

    def insert_option(self, question_id: int, label: str, text: str, is_correct: bool) -> Dict[str, Any]:
        self.cursor.execute(
            """
            INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
            VALUES (%s, %s, %s, %s)
            RETURNING id, question_id, option_label, option_text, is_correct
            """,
            (question_id, label, text, is_correct)
        )
        return self._fetchone_dict()

    def reset_other_correct_options(self, question_id: int) -> None:
        self.cursor.execute(
            "UPDATE quiz_options SET is_correct = FALSE WHERE question_id = %s",
            (question_id,)
        )

    def update_option_fields(self, option_id: int, question_id: int, fields: List[str], values: List[Any]) -> Dict[str, Any]:
        query = f"UPDATE quiz_options SET {', '.join(fields)} WHERE id = %s AND question_id = %s RETURNING id, option_label, option_text, is_correct"
        self.cursor.execute(query, tuple(values))
        return self._fetchone_dict()

    def delete_option_record(self, option_id: int, question_id: int) -> None:
        self.cursor.execute(
            "DELETE FROM quiz_options WHERE id = %s AND question_id = %s",
            (option_id, question_id)
        )

    def get_quiz_header(self, quiz_id: int) -> Optional[Dict[str, Any]]:
        self.cursor.execute(
            """
            SELECT q.id, q.title, q.description, q.passing_score, cm.course_id
            FROM quizzes q
            JOIN course_modules cm ON cm.id = q.module_id
            WHERE q.id = %s
            """,
            (quiz_id,)
        )
        return self._fetchone_dict()

    def get_student_questions_and_options(self, quiz_id: int) -> List[Dict[str, Any]]:
        self.cursor.execute(
            """
            SELECT qq.id as q_id, qq.question_text, qq.question_order,
                   qo.id as o_id, qo.option_label, qo.option_text
            FROM quiz_questions qq
            LEFT JOIN quiz_options qo ON qo.question_id = qq.id
            WHERE qq.quiz_id = %s
            ORDER BY qq.question_order, qo.option_label
            """,
            (quiz_id,)
        )
        return self._fetchall_dict()

    def get_quiz_eval_blueprint(self, quiz_id: int) -> List[Dict[str, Any]]:
        self.cursor.execute(
            """
            SELECT qq.id as q_id, qo.option_label, qo.is_correct
            FROM quiz_questions qq
            LEFT JOIN quiz_options qo ON qo.question_id = qq.id
            WHERE qq.quiz_id = %s
            """,
            (quiz_id,)
        )
        return self._fetchall_dict()

    def insert_attempt(self, quiz_id: int, student_id: int, score: int, passed: bool) -> Dict[str, Any]:
        self.cursor.execute(
            """
            INSERT INTO quiz_attempts (quiz_id, student_id, score, passed)
            VALUES (%s, %s, %s, %s)
            RETURNING id, attempted_at
            """,
            (quiz_id, student_id, score, passed)
        )
        return self._fetchone_dict()


# ============================================================================
# TIER 2: BUSINESS LOGIC & DOMAIN SERVICE LAYER
# ============================================================================

class QuizService:
    """Contains business rules, grade computation, and boundary validations."""

    def __init__(self, repo: QuizRepository):
        self.repo = repo

    def create_quiz(self, data: QuizCreateRequest, org_id: int) -> Dict[str, Any]:
        if not (0 <= data.passing_score <= 100):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passing score must be between 0 and 100.")
        
        if not self.repo.verify_module_in_org(data.module_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found in this organization.")

        return self.repo.insert_quiz(
            module_id=data.module_id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else "",
            passing_score=data.passing_score
        )

    def update_quiz(self, quiz_id: int, data: QuizUpdateRequest, org_id: int) -> Dict[str, Any]:
        if not self.repo.verify_quiz_in_org(quiz_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

        fields, values = [], []
        if data.title is not None:
            fields.append("title = %s")
            values.append(data.title.strip())
        if data.description is not None:
            fields.append("description = %s")
            values.append(data.description.strip())
        if data.passing_score is not None:
            if not (0 <= data.passing_score <= 100):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passing score must be between 0 and 100.")
            fields.append("passing_score = %s")
            values.append(data.passing_score)

        if not fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields provided to update.")

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(quiz_id)
        return self.repo.update_quiz_fields(quiz_id, fields, values)

    def delete_quiz(self, quiz_id: int, org_id: int) -> None:
        if not self.repo.verify_quiz_in_org(quiz_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
        self.repo.cascade_delete_quiz(quiz_id)

    def create_question(self, quiz_id: int, data: QuestionCreateRequest, org_id: int) -> Dict[str, Any]:
        if not self.repo.verify_quiz_in_org(quiz_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
        
        return self.repo.insert_question(
            quiz_id=quiz_id,
            text=data.question_text.strip(),
            order=data.question_order
        )

    def update_question(self, question_id: int, data: QuestionUpdateRequest, org_id: int) -> Dict[str, Any]:
        if not self.repo.verify_question_in_org(question_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

        fields, values = [], []
        if data.question_text is not None:
            fields.append("question_text = %s")
            values.append(data.question_text.strip())
        if data.question_order is not None:
            fields.append("question_order = %s")
            values.append(data.question_order)

        if not fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields provided to update.")

        values.append(question_id)
        return self.repo.update_question_fields(question_id, fields, values)

    def delete_question(self, question_id: int, org_id: int) -> None:
        if not self.repo.verify_question_in_org(question_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        self.repo.delete_question_record(question_id)

    def create_option(self, question_id: int, data: OptionCreateRequest, org_id: int) -> Dict[str, Any]:
        if data.option_label not in {"A", "B", "C", "D"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Option label must be A, B, C, or D.")

        if not self.repo.verify_question_in_org(question_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

        return self.repo.insert_option(
            question_id=question_id,
            label=data.option_label,
            text=data.option_text.strip(),
            is_correct=data.is_correct
        )

    def update_option(self, question_id: int, option_id: int, data: OptionUpdateRequest, org_id: int) -> Dict[str, Any]:
        if not self.repo.verify_option_in_org(option_id, question_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found for this question.")

        fields, values = [], []
        if data.option_text is not None:
            fields.append("option_text = %s")
            values.append(data.option_text.strip())

        if data.is_correct is not None:
            if data.is_correct:
                self.repo.reset_other_correct_options(question_id)
            fields.append("is_correct = %s")
            values.append(data.is_correct)

        if not fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields provided to update.")

        values.extend([option_id, question_id])
        return self.repo.update_option_fields(option_id, question_id, fields, values)

    def delete_option(self, question_id: int, option_id: int, org_id: int) -> None:
        if not self.repo.verify_option_in_org(option_id, question_id, org_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Option not found.")
        self.repo.delete_option_record(option_id, question_id)

    def get_quiz_for_student(self, quiz_id: int, student_id: int) -> Dict[str, Any]:
        quiz = self.repo.get_quiz_header(quiz_id)
        if not quiz:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

        if not self.repo.is_student_enrolled(student_id, quiz["course_id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")

        rows = self.repo.get_student_questions_and_options(quiz_id)
        questions_map = {}
        for row in rows:
            qid = row["q_id"]
            if qid not in questions_map:
                questions_map[qid] = {
                    "id": qid,
                    "question_text": row["question_text"],
                    "question_order": row["question_order"],
                    "options": []
                }
            if row["o_id"]:
                questions_map[qid]["options"].append({
                    "id": row["o_id"],
                    "option_label": row["option_label"],
                    "option_text": row["option_text"]
                })

        quiz["questions"] = list(questions_map.values())
        return quiz

    def grade_submission(self, quiz_id: int, submission: SubmitQuizRequest, student_id: int) -> Tuple[Dict[str, Any], bool, int, int]:
        quiz = self.repo.get_quiz_header(quiz_id)
        if not quiz:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

        if not self.repo.is_student_enrolled(student_id, quiz["course_id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course.")

        blueprint = self.repo.get_quiz_eval_blueprint(quiz_id)
        if not blueprint:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz has no questions configured.")

        quiz_key = {}
        for r in blueprint:
            qid = r["q_id"]
            if qid not in quiz_key:
                quiz_key[qid] = {"valid_labels": set(), "correct_label": None}
            if r["option_label"]:
                quiz_key[qid]["valid_labels"].add(r["option_label"])
                if r["is_correct"]:
                    quiz_key[qid]["correct_label"] = r["option_label"]

        correct_count = 0
        total_questions = len(quiz_key)

        for str_qid, selected_option in submission.answers.items():
            if not str_qid.isdigit():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid question ID format: {str_qid}")
            qid = int(str_qid)
            if qid not in quiz_key:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Question ID {qid} does not belong to this quiz.")

            if selected_option and selected_option not in quiz_key[qid]["valid_labels"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid option '{selected_option}' for question {qid}.")

            if selected_option == quiz_key[qid]["correct_label"]:
                correct_count += 1

        score = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
        passed = score >= quiz["passing_score"]

        attempt = self.repo.insert_attempt(quiz_id, student_id, score, passed)

        result_payload = {
            "attempt_id": attempt["id"],
            "quiz_id": quiz_id,
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "score": score,
            "passing_score": quiz["passing_score"],
            "passed": passed,
            "attempted_at": attempt["attempted_at"]
        }
        return result_payload, passed, score, quiz["passing_score"]


# ============================================================================
# TIER 3: DEPENDENCY INJECTION & ASYNC TASK DISPATCHER
# ============================================================================

def get_quiz_service():
    """Manages transactional boundaries and injects the service layer."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        repo = QuizRepository(cursor)
        yield QuizService(repo)
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Transaction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred."
        )
    finally:
        cursor.close()
        conn.close()


def dispatch_quiz_notification(user_id: int, org_id: int, score: int, passing_score: int, passed: bool):
    """Executes notifications out-of-band to prevent blocking the response thread."""
    conn = get_connection()
    try:
        NotificationService.create(
            conn,
            user_id=user_id,
            organization_id=org_id,
            type=NotificationService.QUIZ_PASSED if passed else NotificationService.QUIZ_FAILED,
            title=f"Quiz {'Passed' if passed else 'Failed'} ({score}%)",
            message=f"You scored {score}% on the module quiz (Passing: {passing_score}%).",
            link=None,
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning(f"Background notification dispatch failed for user {user_id}: {str(e)}")
    finally:
        conn.close()


# ============================================================================
# HTTP CONTROLLER ROUTE DEFINITIONS
# ============================================================================

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_quiz(
    data: QuizCreateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    quiz = service.create_quiz(data, current_user["organization_id"])
    return {"message": "Quiz created successfully", "quiz": quiz}


@router.put("/{quiz_id}")
def update_quiz(
    quiz_id: int,
    data: QuizUpdateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    quiz = service.update_quiz(quiz_id, data, current_user["organization_id"])
    return {"message": "Quiz updated successfully", "quiz": quiz}


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
):
    service.delete_quiz(quiz_id, current_user["organization_id"])


@router.post("/{quiz_id}/questions", status_code=status.HTTP_201_CREATED)
def create_question(
    quiz_id: int,
    data: QuestionCreateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    question = service.create_question(quiz_id, data, current_user["organization_id"])
    return {"message": "Question created successfully", "question": question}


@router.put("/questions/{question_id}")
def update_question(
    question_id: int,
    data: QuestionUpdateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    question = service.update_question(question_id, data, current_user["organization_id"])
    return {"message": "Question updated successfully", "question": question}


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, str]:
    service.delete_question(question_id, current_user["organization_id"])
    return {"message": "Question deleted successfully"}


@router.post("/questions/{question_id}/options", status_code=status.HTTP_201_CREATED)
def create_option(
    question_id: int,
    data: OptionCreateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    option = service.create_option(question_id, data, current_user["organization_id"])
    return {"message": "Option created successfully", "option": option}


@router.put("/questions/{question_id}/options/{option_id}")
def update_option(
    question_id: int,
    option_id: int,
    data: OptionUpdateRequest,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    option = service.update_option(question_id, option_id, data, current_user["organization_id"])
    return {"message": "Option updated successfully", "option": option}


@router.delete("/questions/{question_id}/options/{option_id}")
def delete_option(
    question_id: int,
    option_id: int,
    current_user: dict = Depends(require_admin),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, str]:
    service.delete_option(question_id, option_id, current_user["organization_id"])
    return {"message": "Option deleted successfully"}


@router.get("/{quiz_id}")
def get_quiz_for_student(
    quiz_id: int,
    current_user: dict = Depends(require_student),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    quiz = service.get_quiz_for_student(quiz_id, current_user["id"])
    return {"quiz": quiz}


@router.post("/{quiz_id}/submit")
def submit_quiz(
    quiz_id: int,
    submission: SubmitQuizRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_student),
    service: QuizService = Depends(get_quiz_service)
) -> Dict[str, Any]:
    result, passed, score, passing_score = service.grade_submission(
        quiz_id, submission, current_user["id"]
    )

    background_tasks.add_task(
        dispatch_quiz_notification,
        user_id=current_user["id"],
        org_id=current_user.get("organization_id"),
        score=score,
        passing_score=passing_score,
        passed=passed
    )

    return {"message": "Quiz submitted successfully", "result": result}