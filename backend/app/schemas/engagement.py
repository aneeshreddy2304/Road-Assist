from datetime import datetime

from pydantic import BaseModel


class AvailabilitySlotOut(BaseModel):
    starts_at: datetime
    label: str


class AppointmentCreate(BaseModel):
    mechanic_id: str
    vehicle_id: str | None = None
    scheduled_for: datetime
    service_type: str
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: str


class AppointmentOut(BaseModel):
    id: str
    owner_id: str
    mechanic_id: str
    vehicle_id: str | None = None
    owner_name: str | None = None
    mechanic_name: str | None = None
    vehicle_label: str | None = None
    license_plate: str | None = None
    scheduled_for: datetime
    service_type: str
    notes: str | None = None
    status: str
    estimated_cost: float | None = None
    work_hours: str | None = None
    created_at: datetime


class ChatMessageCreate(BaseModel):
    mechanic_id: str | None = None
    owner_id: str | None = None
    message: str


class ChatMessageOut(BaseModel):
    id: str
    owner_id: str
    mechanic_id: str
    sender_user_id: str
    sender_role: str
    sender_name: str
    message: str
    created_at: datetime
