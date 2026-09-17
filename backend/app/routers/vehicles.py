from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


class VehicleCreate(BaseModel):
    nickname: str | None = None
    make: str
    model: str
    year: int
    license_plate: str
    vehicle_type: str
    fuel_type: str | None = None
    color: str | None = None
    notes: str | None = None


class VehicleUpdate(BaseModel):
    nickname: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    license_plate: str | None = None
    vehicle_type: str | None = None
    fuel_type: str | None = None
    color: str | None = None
    notes: str | None = None


class VehicleOut(BaseModel):
    id: str
    owner_id: str
    nickname: str | None
    make: str
    model: str
    year: int
    license_plate: str
    vehicle_type: str
    fuel_type: str | None
    color: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class QuickVehicleNoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class QuickVehicleNoteOut(BaseModel):
    id: str
    note: str
    created_at: str


@router.get("", response_model=list[VehicleOut])
async def list_my_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        select(Vehicle).where(Vehicle.owner_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=VehicleOut, status_code=201)
async def add_vehicle(
    payload: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    vehicle = Vehicle(owner_id=current_user.id, **payload.model_dump())
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleOut)
async def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.owner_id == current_user.id)
    )
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)
    return vehicle


@router.get("/{vehicle_id}/quick-notes", response_model=list[QuickVehicleNoteOut])
async def list_quick_vehicle_notes(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    vehicle = (await db.execute(select(Vehicle.id).where(Vehicle.id == vehicle_id, Vehicle.owner_id == current_user.id))).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    rows = await db.execute(text("""
        SELECT id::text, note, created_at::text
        FROM vehicle_quick_notes
        WHERE vehicle_id = CAST(:vehicle_id AS UUID) AND owner_id = :owner_id
        ORDER BY created_at DESC
    """), {"vehicle_id": vehicle_id, "owner_id": str(current_user.id)})
    return [dict(row) for row in rows.mappings().all()]


@router.post("/{vehicle_id}/quick-notes", response_model=QuickVehicleNoteOut, status_code=201)
async def create_quick_vehicle_note(
    vehicle_id: str,
    payload: QuickVehicleNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    vehicle = (await db.execute(select(Vehicle.id).where(Vehicle.id == vehicle_id, Vehicle.owner_id == current_user.id))).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    note_id = str(uuid4())
    row = (await db.execute(text("""
        INSERT INTO vehicle_quick_notes (id, vehicle_id, owner_id, note)
        VALUES (CAST(:id AS UUID), CAST(:vehicle_id AS UUID), :owner_id, :note)
        RETURNING id::text, note, created_at::text
    """), {"id": note_id, "vehicle_id": vehicle_id, "owner_id": str(current_user.id), "note": payload.note.strip()})).mappings().one()
    await db.commit()
    return dict(row)


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.owner_id == current_user.id)
    )
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await db.delete(vehicle)
    await db.commit()
