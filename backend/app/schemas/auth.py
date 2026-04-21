from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    gender: str | None = None
    street_address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    role: Literal["owner", "mechanic"] = "owner"
    address: str | None = None
    specialization: str | None = None
    work_hours: str | None = None
    vehicle_types: list[str] | None = None
    lat: float | None = None
    lng: float | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str
    registration_status: str = "approved"
    detail: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None
    gender: str | None
    street_address: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    street_address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
