from pydantic import BaseModel, EmailStr


class CreateStudentRequest(BaseModel):
    name: str
    email: EmailStr
    password: str | None = None