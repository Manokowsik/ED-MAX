from pydantic import BaseModel
from typing import Optional


class CourseCreateRequest(BaseModel):
    title: str
    description: str


class CourseUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AssignCourseRequest(BaseModel):
    student_id: int
