from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str


class ActivateAccountRequest(BaseModel):
    token: str
    password: str
    confirm_password: str


class ResendActivationRequest(BaseModel):
    email: EmailStr


class TestEmailRequest(BaseModel):
    email: EmailStr