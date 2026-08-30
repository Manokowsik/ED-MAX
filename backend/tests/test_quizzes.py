"""
Quiz management tests: create, questions, options, student retrieval,
correct-answer protection, submission, score calculation, pass/fail, attempt storage.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import db_execute


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def test_quiz(admin_user, test_module):
    """Create a test quiz with questions and options."""
    result = db_execute(
        """
        INSERT INTO quizzes (module_id, title, description, passing_score)
        VALUES (%s, 'Test Quiz', 'Quiz Description', 60)
        RETURNING id
        """,
        (test_module["id"],),
        fetch=True
    )
    quiz_id = result[0][0]

    q1 = db_execute(
        """
        INSERT INTO quiz_questions (quiz_id, question_text, question_order)
        VALUES (%s, 'What is 2+2?', 1)
        RETURNING id
        """,
        (quiz_id,),
        fetch=True
    )[0][0]

    q2 = db_execute(
        """
        INSERT INTO quiz_questions (quiz_id, question_text, question_order)
        VALUES (%s, 'What is the capital of France?', 2)
        RETURNING id
        """,
        (quiz_id,),
        fetch=True
    )[0][0]

    db_execute(
        """
        INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
        VALUES (%s, 'A', '3', FALSE), (%s, 'B', '4', TRUE),
               (%s, 'C', '5', FALSE), (%s, 'D', '6', FALSE)
        """,
        (q1, q1, q1, q1)
    )

    db_execute(
        """
        INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
        VALUES (%s, 'A', 'Berlin', FALSE), (%s, 'B', 'Paris', TRUE),
               (%s, 'C', 'London', FALSE), (%s, 'D', 'Rome', FALSE)
        """,
        (q2, q2, q2, q2)
    )

    yield {
        "id": quiz_id,
        "questions": [{"id": q1, "correct": "B"}, {"id": q2, "correct": "B"}]
    }

    db_execute("DELETE FROM quizzes WHERE id = %s", (quiz_id,))


@pytest.fixture(scope="module")
def quiz_enrollment(student_user, test_course):
    """Ensure student is enrolled for quiz tests (self-contained)."""
    db_execute(
        """
        INSERT INTO enrollments (student_id, course_id, status, assigned_at)
        VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        """,
        (student_user["id"], test_course["id"])
    )
    yield {
        "student_id": student_user["id"],
        "course_id": test_course["id"]
    }


# ============================================================
# Quiz Creation Tests
# ============================================================

class TestQuizCreation:

    def test_create_quiz_success(self, client, admin_user, test_module):
        """Admin can create a quiz."""
        response = client.post(
            "/quizzes/",
            json={
                "module_id": test_module["id"],
                "title": "New Quiz",
                "description": "A test quiz",
                "passing_score": 70
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert data["quiz"]["passing_score"] == 70
        assert data["quiz"]["module_id"] == test_module["id"]
        db_execute("DELETE FROM quizzes WHERE id = %s", (data["quiz"]["id"],))

    def test_create_quiz_invalid_module(self, client, admin_user):
        """Creating a quiz for a non-existent module returns 404."""
        response = client.post(
            "/quizzes/",
            json={
                "module_id": 99999999,
                "title": "X",
                "description": "Y",
                "passing_score": 60
            },
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_create_quiz_requires_admin(self, client, student_user, test_module):
        """Students cannot create quizzes."""
        response = client.post(
            "/quizzes/",
            json={
                "module_id": test_module["id"],
                "title": "Hacked Quiz",
                "description": "Bad",
                "passing_score": 0
            },
            headers=student_user["headers"]
        )
        assert response.status_code == 403


# ============================================================
# Question Creation Tests
# ============================================================

class TestQuestionCreation:

    def test_create_question_success(self, client, admin_user, test_quiz):
        """Admin can create a quiz question."""
        response = client.post(
            f"/quizzes/{test_quiz['id']}/questions",
            json={"question_text": "What is Python?", "question_order": 99},
            headers=admin_user["headers"]
        )
        assert response.status_code == 201
        data = response.json()
        assert data["question"]["quiz_id"] == test_quiz["id"]
        db_execute("DELETE FROM quiz_questions WHERE id = %s", (data["question"]["id"],))

    def test_create_question_invalid_quiz(self, client, admin_user):
        """Creating a question for a non-existent quiz returns 404."""
        response = client.post(
            "/quizzes/99999999/questions",
            json={"question_text": "X?", "question_order": 1},
            headers=admin_user["headers"]
        )
        assert response.status_code == 404

    def test_create_question_requires_admin(self, client, student_user, test_quiz):
        """Students cannot create questions."""
        response = client.post(
            f"/quizzes/{test_quiz['id']}/questions",
            json={"question_text": "Hacked?", "question_order": 1},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


# ============================================================
# Option Creation Tests
# ============================================================

class TestOptionCreation:

    def test_create_option_invalid_label(self, client, admin_user, test_quiz):
        """Option label must be A-D."""
        question_id = test_quiz["questions"][0]["id"]
        response = client.post(
            f"/quizzes/questions/{question_id}/options",
            json={"option_label": "E", "option_text": "Bad", "is_correct": False},
            headers=admin_user["headers"]
        )
        assert response.status_code == 400

    def test_create_option_requires_admin(self, client, student_user, test_quiz):
        """Students cannot create options."""
        question_id = test_quiz["questions"][0]["id"]
        response = client.post(
            f"/quizzes/questions/{question_id}/options",
            json={"option_label": "A", "option_text": "Hacked", "is_correct": True},
            headers=student_user["headers"]
        )
        assert response.status_code == 403


# ============================================================
# Quiz Retrieval Tests
# ============================================================

class TestQuizRetrieval:

    def test_get_quiz_no_correct_answers(
        self, client, student_user, test_quiz, quiz_enrollment
    ):
        """Students can retrieve a quiz but correct answers are NOT in response."""
        response = client.get(
            f"/quizzes/{test_quiz['id']}",
            headers=student_user["headers"]
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.json()}"
        )
        data = response.json()
        assert "quiz" in data
        # CRITICAL: is_correct must NOT be exposed to students
        for question in data["quiz"]["questions"]:
            for option in question["options"]:
                assert "is_correct" not in option, (
                    "SECURITY VIOLATION: is_correct field leaked to student!"
                )

    def test_get_quiz_unenrolled_student(self, client, admin_user, test_quiz):
        """An unenrolled user (admin) cannot call the student quiz endpoint."""
        response = client.get(
            f"/quizzes/{test_quiz['id']}",
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_get_quiz_not_found(self, client, student_user, quiz_enrollment):
        """Non-existent quiz returns 404."""
        response = client.get(
            "/quizzes/99999999",
            headers=student_user["headers"]
        )
        assert response.status_code == 404


# ============================================================
# Quiz Submission Tests
# ============================================================

class TestQuizSubmission:

    def test_submit_quiz_all_correct(
        self, client, student_user, test_quiz, quiz_enrollment
    ):
        """Student gets 100% when all answers are correct."""
        answers = {
            str(test_quiz["questions"][0]["id"]): test_quiz["questions"][0]["correct"],
            str(test_quiz["questions"][1]["id"]): test_quiz["questions"][1]["correct"]
        }
        response = client.post(
            f"/quizzes/{test_quiz['id']}/submit",
            json={"answers": answers},
            headers=student_user["headers"]
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.json()}"
        )
        result = response.json()["result"]
        assert result["score"] == 100
        assert result["passed"] is True
        assert result["correct_answers"] == 2
        assert result["total_questions"] == 2

    def test_submit_quiz_all_wrong(
        self, client, student_user, test_quiz, quiz_enrollment
    ):
        """Student gets 0% when all answers are wrong."""
        answers = {
            str(test_quiz["questions"][0]["id"]): "C",
            str(test_quiz["questions"][1]["id"]): "C"
        }
        response = client.post(
            f"/quizzes/{test_quiz['id']}/submit",
            json={"answers": answers},
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["score"] == 0
        assert result["passed"] is False

    def test_submit_quiz_partial_score(
        self, client, student_user, test_quiz, quiz_enrollment
    ):
        """Partial correct answers yield partial score."""
        answers = {
            str(test_quiz["questions"][0]["id"]): test_quiz["questions"][0]["correct"],
            str(test_quiz["questions"][1]["id"]): "C"  # wrong
        }
        response = client.post(
            f"/quizzes/{test_quiz['id']}/submit",
            json={"answers": answers},
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["score"] == 50
        assert result["passed"] is False  # passing_score is 60

    def test_submit_quiz_requires_student(self, client, admin_user, test_quiz):
        """Admins cannot submit quizzes (wrong role)."""
        response = client.post(
            f"/quizzes/{test_quiz['id']}/submit",
            json={"answers": {}},
            headers=admin_user["headers"]
        )
        assert response.status_code == 403

    def test_submit_quiz_saves_attempt(
        self, client, student_user, test_quiz, quiz_enrollment
    ):
        """Quiz attempts are stored in the database."""
        answers = {
            str(test_quiz["questions"][0]["id"]): test_quiz["questions"][0]["correct"],
            str(test_quiz["questions"][1]["id"]): test_quiz["questions"][1]["correct"]
        }
        response = client.post(
            f"/quizzes/{test_quiz['id']}/submit",
            json={"answers": answers},
            headers=student_user["headers"]
        )
        assert response.status_code == 200
        attempt_id = response.json()["result"]["attempt_id"]

        rows = db_execute(
            "SELECT id, score, passed FROM quiz_attempts WHERE id = %s",
            (attempt_id,),
            fetch=True
        )
        assert len(rows) == 1
        assert rows[0][1] == 100
        assert rows[0][2] is True
