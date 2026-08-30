from pydantic import BaseModel
from typing import Dict


class QuizCreateRequest(BaseModel):
    module_id: int
    title: str
    description: str
    passing_score: int = 60


class QuestionCreateRequest(BaseModel):
    question_text: str
    question_order: int


class OptionCreateRequest(BaseModel):
    option_label: str   # A, B, C, or D
    option_text: str
    is_correct: bool


class SubmitQuizRequest(BaseModel):
    # Keys are question_id (as string), values are option_label selected
    answers: Dict[str, str]
