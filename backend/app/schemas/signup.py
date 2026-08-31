from pydantic import BaseModel, EmailStr, model_validator


class AdminSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if len(self.password) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not self.name.strip():
            raise ValueError("Name is required")
        return self
