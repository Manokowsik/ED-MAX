from pydantic import BaseModel, Field, field_validator


class ProfileUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class DeleteAccountRequest(BaseModel):
    confirmation: str
    current_password: str
