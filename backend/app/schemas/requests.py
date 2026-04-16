from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal


class ServiceRequestCreate(BaseModel):
    vehicle_id: str
    problem_desc: str
    lat: float
    lng: float
    mechanic_id: str | None = None
    requested_completion_hours: int | None = None


class StatusUpdate(BaseModel):
    status: Literal["accepted", "in_progress", "completed", "cancelled"]
    note: str | None = None
    estimated_cost: float | None = None
    final_cost: float | None = None


class JobUpdateOut(BaseModel):
    id: str
    status: str
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceRequestOut(BaseModel):
    id: str
    owner_id: str
    mechanic_id: str | None
    vehicle_id: str
    problem_desc: str
    status: str
    estimated_cost: float | None
    total_cost: float | None
    owner_name: str | None = None
    vehicle_label: str | None = None
    license_plate: str | None = None
    owner_address: str | None = None
    lat: float | None = None
    lng: float | None = None
    requested_completion_hours: int | None = None
    deadline_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceRequestDetail(ServiceRequestOut):
    job_updates: list[JobUpdateOut] = []


class ReviewCreate(BaseModel):
    request_id: str
    rating: int
    comment: str | None = None

    def validate_rating(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewOut(BaseModel):
    id: str
    request_id: str
    mechanic_id: str
    rating: int
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
