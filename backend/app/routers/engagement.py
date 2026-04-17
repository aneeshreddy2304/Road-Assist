import re
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.engagement import Appointment, ChatMessage
from app.models.mechanic import Mechanic
from app.models.service_request import ServiceRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.engagement import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStatusUpdate,
    AvailabilitySlotOut,
    ChatMessageCreate,
    ChatMessageOut,
)

router = APIRouter(tags=["Appointments & Chat"])


def _parse_work_hours(work_hours: str | None) -> tuple[time, time]:
    if not work_hours:
        return time(9, 0), time(17, 0)

    match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)", work_hours, re.I)
    if not match:
        return time(9, 0), time(17, 0)

    start = datetime.strptime(match.group(1).upper().replace(" ", ""), "%I:%M%p").time()
    end = datetime.strptime(match.group(2).upper().replace(" ", ""), "%I:%M%p").time()
    return start, end


async def _get_mechanic_for_user(db: AsyncSession, user_id: str) -> Mechanic | None:
    result = await db.execute(select(Mechanic).where(Mechanic.user_id == user_id))
    return result.scalar_one_or_none()


async def _chat_request_refs_enabled(db: AsyncSession) -> bool:
    result = await db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'chat_messages'
                  AND column_name = 'request_id'
            )
            """
        )
    )
    return bool(result.scalar())


@router.get("/appointments/availability", response_model=list[AvailabilitySlotOut])
async def get_mechanic_availability(
    mechanic_id: str = Query(...),
    day: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mechanic_result = await db.execute(select(Mechanic).where(Mechanic.id == mechanic_id))
    mechanic = mechanic_result.scalar_one_or_none()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    start_time, end_time = _parse_work_hours(mechanic.work_hours)
    start_dt = datetime.combine(day, start_time).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(day, end_time).replace(tzinfo=timezone.utc)

    appt_result = await db.execute(
        select(Appointment.scheduled_for).where(
            Appointment.mechanic_id == mechanic_id,
            Appointment.status.in_(("requested", "confirmed")),
            Appointment.scheduled_for >= start_dt,
            Appointment.scheduled_for < end_dt,
        )
    )
    taken = {item.isoformat() for item in appt_result.scalars().all()}

    slots: list[AvailabilitySlotOut] = []
    cursor = start_dt
    while cursor < end_dt:
        if cursor.isoformat() not in taken and cursor > datetime.now(timezone.utc):
            slots.append(
                AvailabilitySlotOut(
                    starts_at=cursor,
                    label=cursor.astimezone().strftime("%a, %b %d · %I:%M %p"),
                )
            )
        cursor += timedelta(hours=1)
    return slots[:10]


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    if payload.vehicle_id:
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == payload.vehicle_id, Vehicle.owner_id == current_user.id)
        )
        if vehicle_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="That vehicle does not belong to you")

    mechanic_result = await db.execute(
        text(
            """
            SELECT m.id::text AS mechanic_id, u.name AS mechanic_name, m.work_hours
            FROM mechanics m
            JOIN users u ON u.id = m.user_id
            WHERE m.id = :mid
            """
        ),
        {"mid": payload.mechanic_id},
    )
    mechanic = mechanic_result.mappings().first()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    appointment = Appointment(
        owner_id=current_user.id,
        mechanic_id=payload.mechanic_id,
        vehicle_id=payload.vehicle_id,
        scheduled_for=payload.scheduled_for,
        service_type=payload.service_type,
        notes=payload.notes,
        status="requested",
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    vehicle_label = None
    license_plate = None
    if payload.vehicle_id:
        vehicle_result = await db.execute(
            select(Vehicle).where(Vehicle.id == payload.vehicle_id)
        )
        vehicle = vehicle_result.scalar_one_or_none()
        if vehicle:
            vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}"
            license_plate = vehicle.license_plate

    return AppointmentOut(
        id=appointment.id,
        owner_id=appointment.owner_id,
        mechanic_id=appointment.mechanic_id,
        vehicle_id=appointment.vehicle_id,
        owner_name=current_user.name,
        mechanic_name=mechanic["mechanic_name"],
        vehicle_label=vehicle_label,
        license_plate=license_plate,
        scheduled_for=appointment.scheduled_for,
        service_type=appointment.service_type,
        notes=appointment.notes,
        status=appointment.status,
        estimated_cost=float(appointment.estimated_cost) if appointment.estimated_cost is not None else None,
        work_hours=mechanic["work_hours"],
        created_at=appointment.created_at,
    )


@router.get("/appointments", response_model=list[AppointmentOut])
async def list_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    params: dict[str, object] = {}
    where_clause = ""

    if current_user.role == "owner":
        where_clause = "WHERE a.owner_id = :uid"
        params["uid"] = current_user.id
    elif current_user.role == "mechanic":
        mechanic = await _get_mechanic_for_user(db, current_user.id)
        if not mechanic:
            return []
        where_clause = "WHERE a.mechanic_id = :mid"
        params["mid"] = mechanic.id
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        text(
            f"""
            SELECT
                a.id::text AS id,
                a.owner_id::text AS owner_id,
                a.mechanic_id::text AS mechanic_id,
                a.vehicle_id::text AS vehicle_id,
                ou.name AS owner_name,
                mu.name AS mechanic_name,
                CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label,
                v.license_plate,
                a.scheduled_for,
                a.service_type,
                a.notes,
                a.status::text AS status,
                CAST(a.estimated_cost AS FLOAT) AS estimated_cost,
                m.work_hours,
                a.created_at
            FROM appointments a
            JOIN users ou ON ou.id = a.owner_id
            JOIN mechanics m ON m.id = a.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            LEFT JOIN vehicles v ON v.id = a.vehicle_id
            {where_clause}
            ORDER BY a.scheduled_for ASC
            """
        ),
        params,
    )
    return [AppointmentOut(**dict(row)) for row in result.mappings().all()]


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
async def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment_result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = appointment_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "owner" and appointment.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "mechanic":
        mechanic = await _get_mechanic_for_user(db, current_user.id)
        if not mechanic or appointment.mechanic_id != mechanic.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if payload.status is not None:
        appointment.status = payload.status
    if payload.scheduled_for is not None:
        appointment.scheduled_for = payload.scheduled_for
    if payload.service_type is not None:
        appointment.service_type = payload.service_type
    if payload.notes is not None:
        appointment.notes = payload.notes
    if payload.estimated_cost is not None and current_user.role == "mechanic":
        appointment.estimated_cost = payload.estimated_cost
    await db.commit()

    refreshed = await list_appointments(db=db, current_user=current_user)
    for item in refreshed:
        if item.id == appointment_id:
            return item
    raise HTTPException(status_code=404, detail="Appointment not found after update")


@router.get("/messages/thread", response_model=list[ChatMessageOut])
async def get_messages_thread(
    mechanic_id: str | None = Query(None),
    owner_id: str | None = Query(None),
    request_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_refs_enabled = await _chat_request_refs_enabled(db)

    if current_user.role == "owner":
        if not mechanic_id:
            raise HTTPException(status_code=422, detail="mechanic_id is required")
        owner_id = current_user.id
    elif current_user.role == "mechanic":
        mechanic = await _get_mechanic_for_user(db, current_user.id)
        if not mechanic:
            return []
        mechanic_id = mechanic.id
        if not owner_id:
            raise HTTPException(status_code=422, detail="owner_id is required")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if request_refs_enabled:
        result = await db.execute(
            text(
                """
                SELECT
                    c.id::text AS id,
                    c.owner_id::text AS owner_id,
                    c.mechanic_id::text AS mechanic_id,
                    c.request_id::text AS request_id,
                    CASE WHEN c.request_id IS NOT NULL THEN CONCAT('RA-', UPPER(SUBSTRING(c.request_id::TEXT, 1, 8))) END AS request_ref,
                    c.sender_user_id::text AS sender_user_id,
                    c.sender_role::text AS sender_role,
                    u.name AS sender_name,
                    c.message,
                    c.created_at
                FROM chat_messages c
                JOIN users u ON u.id = c.sender_user_id
                WHERE c.owner_id = :owner_id
                  AND c.mechanic_id = :mechanic_id
                  AND (:request_id IS NULL OR c.request_id = :request_id)
                ORDER BY c.created_at ASC
                """
            ),
            {"owner_id": owner_id, "mechanic_id": mechanic_id, "request_id": request_id},
        )
    else:
        result = await db.execute(
            text(
                """
                SELECT
                    c.id::text AS id,
                    c.owner_id::text AS owner_id,
                    c.mechanic_id::text AS mechanic_id,
                    NULL::text AS request_id,
                    NULL::text AS request_ref,
                    c.sender_user_id::text AS sender_user_id,
                    c.sender_role::text AS sender_role,
                    u.name AS sender_name,
                    c.message,
                    c.created_at
                FROM chat_messages c
                JOIN users u ON u.id = c.sender_user_id
                WHERE c.owner_id = :owner_id
                  AND c.mechanic_id = :mechanic_id
                ORDER BY c.created_at ASC
                """
            ),
            {"owner_id": owner_id, "mechanic_id": mechanic_id},
        )
    return [ChatMessageOut(**dict(row)) for row in result.mappings().all()]


@router.post("/messages/thread", response_model=ChatMessageOut, status_code=201)
async def send_message(
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_refs_enabled = await _chat_request_refs_enabled(db)

    if current_user.role == "owner":
        if not payload.mechanic_id:
            raise HTTPException(status_code=422, detail="mechanic_id is required")
        owner_id = current_user.id
        mechanic_id = payload.mechanic_id
        sender_role = "owner"
    elif current_user.role == "mechanic":
        mechanic = await _get_mechanic_for_user(db, current_user.id)
        if not mechanic:
            raise HTTPException(status_code=404, detail="Mechanic profile not found")
        if not payload.owner_id:
            raise HTTPException(status_code=422, detail="owner_id is required")
        owner_id = payload.owner_id
        mechanic_id = mechanic.id
        sender_role = "mechanic"
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.request_id:
        request_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == payload.request_id))
        request = request_result.scalar_one_or_none()
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        if request.owner_id != owner_id or request.mechanic_id != mechanic_id:
            raise HTTPException(status_code=403, detail="That request does not belong to this conversation")

    if request_refs_enabled:
        message = ChatMessage(
            owner_id=owner_id,
            mechanic_id=mechanic_id,
            request_id=payload.request_id,
            sender_user_id=current_user.id,
            sender_role=sender_role,
            message=payload.message,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)

        return ChatMessageOut(
            id=message.id,
            owner_id=message.owner_id,
            mechanic_id=message.mechanic_id,
            request_id=message.request_id,
            request_ref=f"RA-{str(message.request_id)[:8].upper()}" if message.request_id else None,
            sender_user_id=message.sender_user_id,
            sender_role=message.sender_role,
            sender_name=current_user.name,
            message=message.message,
            created_at=message.created_at,
        )

    message_id = str(uuid4())
    inserted = await db.execute(
        text(
            """
            INSERT INTO chat_messages (
                id,
                owner_id,
                mechanic_id,
                sender_user_id,
                sender_role,
                message
            )
            VALUES (
                :id,
                :owner_id,
                :mechanic_id,
                :sender_user_id,
                :sender_role,
                :message
            )
            RETURNING created_at
            """
        ),
        {
            "id": message_id,
            "owner_id": owner_id,
            "mechanic_id": mechanic_id,
            "sender_user_id": current_user.id,
            "sender_role": sender_role,
            "message": payload.message,
        },
    )
    await db.commit()
    created_at = inserted.scalar_one()

    return ChatMessageOut(
        id=message_id,
        owner_id=owner_id,
        mechanic_id=mechanic_id,
        request_id=None,
        request_ref=None,
        sender_user_id=current_user.id,
        sender_role=sender_role,
        sender_name=current_user.name,
        message=payload.message,
        created_at=created_at,
    )


@router.get("/messages/inbox")
async def get_messages_inbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_refs_enabled = await _chat_request_refs_enabled(db)

    if current_user.role == "owner":
        if request_refs_enabled:
            result = await db.execute(
                text(
                    """
                    SELECT DISTINCT ON (c.mechanic_id, c.request_id)
                        c.id::text AS id,
                        c.owner_id::text AS owner_id,
                        c.mechanic_id::text AS mechanic_id,
                        c.request_id::text AS request_id,
                        CASE WHEN c.request_id IS NOT NULL THEN CONCAT('RA-', UPPER(SUBSTRING(c.request_id::TEXT, 1, 8))) END AS request_ref,
                        c.sender_role::text AS sender_role,
                        c.message,
                        c.created_at,
                        u.name AS counterpart_name,
                        m.address AS counterpart_address
                    FROM chat_messages c
                    JOIN mechanics m ON m.id = c.mechanic_id
                    JOIN users u ON u.id = m.user_id
                    WHERE c.owner_id = :uid
                    ORDER BY c.mechanic_id, c.request_id, c.created_at DESC
                    """
                ),
                {"uid": current_user.id},
            )
        else:
            result = await db.execute(
                text(
                    """
                    SELECT DISTINCT ON (c.mechanic_id)
                        c.id::text AS id,
                        c.owner_id::text AS owner_id,
                        c.mechanic_id::text AS mechanic_id,
                        NULL::text AS request_id,
                        NULL::text AS request_ref,
                        c.sender_role::text AS sender_role,
                        c.message,
                        c.created_at,
                        u.name AS counterpart_name,
                        m.address AS counterpart_address
                    FROM chat_messages c
                    JOIN mechanics m ON m.id = c.mechanic_id
                    JOIN users u ON u.id = m.user_id
                    WHERE c.owner_id = :uid
                    ORDER BY c.mechanic_id, c.created_at DESC
                    """
                ),
                {"uid": current_user.id},
            )
    elif current_user.role == "mechanic":
        mechanic = await _get_mechanic_for_user(db, current_user.id)
        if not mechanic:
            return []
        if request_refs_enabled:
            result = await db.execute(
                text(
                    """
                    SELECT DISTINCT ON (c.owner_id, c.request_id)
                        c.id::text AS id,
                        c.owner_id::text AS owner_id,
                        c.mechanic_id::text AS mechanic_id,
                        c.request_id::text AS request_id,
                        CASE WHEN c.request_id IS NOT NULL THEN CONCAT('RA-', UPPER(SUBSTRING(c.request_id::TEXT, 1, 8))) END AS request_ref,
                        c.sender_role::text AS sender_role,
                        c.message,
                        c.created_at,
                        u.name AS counterpart_name,
                        TRIM(BOTH ', ' FROM CONCAT_WS(', ', u.street_address, u.city, u.state, u.postal_code)) AS counterpart_address
                    FROM chat_messages c
                    JOIN users u ON u.id = c.owner_id
                    WHERE c.mechanic_id = :mid
                    ORDER BY c.owner_id, c.request_id, c.created_at DESC
                    """
                ),
                {"mid": mechanic.id},
            )
        else:
            result = await db.execute(
                text(
                    """
                    SELECT DISTINCT ON (c.owner_id)
                        c.id::text AS id,
                        c.owner_id::text AS owner_id,
                        c.mechanic_id::text AS mechanic_id,
                        NULL::text AS request_id,
                        NULL::text AS request_ref,
                        c.sender_role::text AS sender_role,
                        c.message,
                        c.created_at,
                        u.name AS counterpart_name,
                        TRIM(BOTH ', ' FROM CONCAT_WS(', ', u.street_address, u.city, u.state, u.postal_code)) AS counterpart_address
                    FROM chat_messages c
                    JOIN users u ON u.id = c.owner_id
                    WHERE c.mechanic_id = :mid
                    ORDER BY c.owner_id, c.created_at DESC
                    """
                ),
                {"mid": mechanic.id},
            )
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return [dict(row) for row in result.mappings().all()]
