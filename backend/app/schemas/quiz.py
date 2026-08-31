from pydantic import BaseModel
from typing import Dict, Optional


class QuizCreateRequest(BaseModel):
    module_id: int
    title: str
    description: str
    passing_score: int = 60


class QuizUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    passing_score: Optional[int] = None


class QuestionCreateRequest(BaseModel):
    question_text: str
    question_order: int


class QuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = None
    question_order: Optional[int] = None


class OptionCreateRequest(BaseModel):
    option_label: str   # A, B, C, or D
    option_text: str
    is_correct: bool


class OptionUpdateRequest(BaseModel):
    option_text: Optional[str] = None
    is_correct: Optional[bool] = None


class SubmitQuizRequest(BaseModel):
    # Keys are question_id (as string), values are option_label selected
    answers: Dict[str, str]
