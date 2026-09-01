from pydantic import BaseModel, EmailStr, Field, field_validator


class CreateStudentRequest(BaseModel):
    name: str
    email: EmailStr
    password: str | None = None
    course_id: int | None = None
