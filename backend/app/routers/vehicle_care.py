import json
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import AsyncSessionLocal, get_db
from app.models.user import User


router = APIRouter(prefix="/vehicle-care", tags=["Vehicle Care"])
CALIFORNIA_TZ = ZoneInfo("America/Los_Angeles")
UPLOAD_DIRECTORY = Path(__file__).resolve().parents[2] / "uploads" / "vehicle-care"
MAX_INVOICE_BYTES = 10 * 1024 * 1024
ALLOWED_INVOICE_TYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_INVOICE_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png"}


class CheckinCreate(BaseModel):
    odometer_miles: int = Field(ge=0)
    note: str | None = Field(default=None, max_length=2000)
    recorded_on: date | None = None


class NotificationUpdate(BaseModel):
    read: bool = True


def _plain(value):
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


async def _owned_vehicle(db: AsyncSession, owner_id: str, vehicle_id: str) -> dict:
    result = await db.execute(
        text(
            """
            SELECT id::text, nickname, make, model, year, license_plate, vehicle_type
            FROM vehicles
            WHERE id = CAST(:vehicle_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
            """
        ),
        {"vehicle_id": vehicle_id, "owner_id": owner_id},
    )
    vehicle = result.mappings().first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _plain(dict(vehicle))


def _monthly_due_at(now: datetime) -> datetime:
    return datetime.combine(now.date().replace(day=1), time(9, 0), tzinfo=CALIFORNIA_TZ).astimezone(timezone.utc)


async def _create_notification(
    db: AsyncSession,
    owner_id: str,
    vehicle_id: str,
    reminder_id: str,
    kind: str,
    title: str,
    body: str,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO owner_notifications (id, owner_id, vehicle_id, reminder_id, kind, title, body)
            SELECT CAST(:id AS UUID), CAST(:owner_id AS UUID), CAST(:vehicle_id AS UUID),
                   CAST(:reminder_id AS UUID), :kind, :title, :body
            WHERE NOT EXISTS (
              SELECT 1 FROM owner_notifications WHERE reminder_id = CAST(:reminder_id AS UUID)
            )
            """
        ),
        {
            "id": str(uuid4()), "owner_id": owner_id, "vehicle_id": vehicle_id,
            "reminder_id": reminder_id, "kind": kind, "title": title, "body": body,
        },
    )


async def _refresh_owner_reminders(db: AsyncSession, owner_id: str) -> None:
    """Create the owner’s monthly and service-due reminders when they become due."""
    now = datetime.now(CALIFORNIA_TZ)
    month_start = now.date().replace(day=1)
    vehicles = await db.execute(
        text("SELECT id::text, COALESCE(nickname, CONCAT(year, ' ', make, ' ', model)) AS label FROM vehicles WHERE owner_id = CAST(:owner_id AS UUID)"),
        {"owner_id": owner_id},
    )
    for vehicle in vehicles.mappings().all():
        vehicle_id = str(vehicle["id"])
        label = vehicle["label"]

        if now >= datetime.combine(month_start, time(9, 0), tzinfo=CALIFORNIA_TZ):
            checkin_exists = await db.execute(
                text(
                    """
                    SELECT EXISTS(
                      SELECT 1 FROM vehicle_checkins
                      WHERE vehicle_id = CAST(:vehicle_id AS UUID)
                        AND recorded_on >= :month_start
                    )
                    """
                ),
                {"vehicle_id": vehicle_id, "month_start": month_start},
            )
            if not checkin_exists.scalar():
                reminder_id = str(uuid4())
                await db.execute(
                    text(
                        """
                        INSERT INTO vehicle_care_reminders
                          (id, vehicle_id, owner_id, reminder_type, reference_month, due_at)
                        VALUES
                          (CAST(:id AS UUID), CAST(:vehicle_id AS UUID), CAST(:owner_id AS UUID),
                           'monthly_checkin', :reference_month, :due_at)
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {
                        "id": reminder_id, "vehicle_id": vehicle_id, "owner_id": owner_id,
                        "reference_month": month_start, "due_at": _monthly_due_at(now),
                    },
                )
                reminder = await db.execute(
                    text(
                        """
                        SELECT id::text FROM vehicle_care_reminders
                        WHERE owner_id = CAST(:owner_id AS UUID) AND vehicle_id = CAST(:vehicle_id AS UUID)
                          AND reminder_type = 'monthly_checkin' AND reference_month = :reference_month
                        """
                    ),
                    {"owner_id": owner_id, "vehicle_id": vehicle_id, "reference_month": month_start},
                )
                stored_id = reminder.scalar_one()
                await _create_notification(
                    db, owner_id, vehicle_id, str(stored_id), "monthly_checkin",
                    f"Monthly check-in for {label}",
                    "Add the current odometer reading and any issues you noticed this month.",
                )

        latest_service = await db.execute(
            text(
                """
                SELECT id::text, next_due_date, next_due_miles
                FROM vehicle_service_records
                WHERE vehicle_id = CAST(:vehicle_id AS UUID)
                ORDER BY service_date DESC, created_at DESC
                LIMIT 1
                """
            ),
            {"vehicle_id": vehicle_id},
        )
        service = latest_service.mappings().first()
        if not service or (not service["next_due_date"] and service["next_due_miles"] is None):
            continue

        reading = await db.execute(
            text(
                """
                SELECT GREATEST(
                  COALESCE((SELECT MAX(odometer_miles) FROM vehicle_checkins WHERE vehicle_id = CAST(:vehicle_id AS UUID)), 0),
                  COALESCE((SELECT MAX(odometer_miles) FROM vehicle_service_records WHERE vehicle_id = CAST(:vehicle_id AS UUID)), 0)
                )
                """
            ),
            {"vehicle_id": vehicle_id},
        )
        current_miles = int(reading.scalar() or 0)
        date_due = bool(service["next_due_date"] and now.date() >= service["next_due_date"])
        miles_due = bool(service["next_due_miles"] is not None and current_miles >= service["next_due_miles"])
        if not date_due and not miles_due:
            continue

        reminder_id = str(uuid4())
        await db.execute(
            text(
                """
                INSERT INTO vehicle_care_reminders
                  (id, vehicle_id, owner_id, source_service_record_id, reminder_type, due_at, target_date, target_miles)
                VALUES
                  (CAST(:id AS UUID), CAST(:vehicle_id AS UUID), CAST(:owner_id AS UUID),
                   CAST(:record_id AS UUID), 'service_due', NOW(), :target_date, :target_miles)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "id": reminder_id, "vehicle_id": vehicle_id, "owner_id": owner_id,
                "record_id": service["id"], "target_date": service["next_due_date"],
                "target_miles": service["next_due_miles"],
            },
        )
        reminder = await db.execute(
            text(
                """
                SELECT id::text FROM vehicle_care_reminders
                WHERE vehicle_id = CAST(:vehicle_id AS UUID)
                  AND source_service_record_id = CAST(:record_id AS UUID)
                  AND reminder_type = 'service_due'
                """
            ),
            {"vehicle_id": vehicle_id, "record_id": service["id"]},
        )
        stored_id = reminder.scalar_one()
        reason = "date and mileage" if date_due and miles_due else "date" if date_due else "mileage"
        await _create_notification(
            db, owner_id, vehicle_id, str(stored_id), "service_due",
            f"Service due for {label}", f"This vehicle is due for service based on its target {reason}.",
        )


async def refresh_all_owner_reminders() -> None:
    """Refresh in-app Vehicle Care reminders for every active owner.

    The task is safe to run repeatedly. Partial unique indexes ensure that the
    same monthly or service-due reminder is never created twice.
    """
    async with AsyncSessionLocal() as db:
        try:
            owners = await db.execute(
                text("SELECT id::text FROM users WHERE role = 'owner' AND is_active = TRUE")
            )
            for owner_id in owners.scalars().all():
                await _refresh_owner_reminders(db, str(owner_id))
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def _vehicle_summary(db: AsyncSession, owner_id: str, vehicle_id: str) -> dict:
    vehicle = await _owned_vehicle(db, owner_id, vehicle_id)
    current_miles = await db.execute(
        text(
            """
            SELECT GREATEST(
              COALESCE((SELECT MAX(odometer_miles) FROM vehicle_checkins WHERE vehicle_id = CAST(:vehicle_id AS UUID)), 0),
              COALESCE((SELECT MAX(odometer_miles) FROM vehicle_service_records WHERE vehicle_id = CAST(:vehicle_id AS UUID)), 0)
            )
            """
        ),
        {"vehicle_id": vehicle_id},
    )
    latest_service = await db.execute(
        text(
            """
            SELECT id::text, service_date, odometer_miles, provider_name, total_cost, notes,
                   invoice_filename, next_due_date, next_due_miles, created_at
            FROM vehicle_service_records
            WHERE vehicle_id = CAST(:vehicle_id AS UUID)
            ORDER BY service_date DESC, created_at DESC LIMIT 1
            """
        ),
        {"vehicle_id": vehicle_id},
    )
    service = latest_service.mappings().first()
    today = datetime.now(CALIFORNIA_TZ).date()
    mileage = int(current_miles.scalar() or 0)
    state = "on_track"
    if service:
        due_date = service["next_due_date"]
        due_miles = service["next_due_miles"]
        overdue = bool((due_date and today > due_date) or (due_miles is not None and mileage >= due_miles))
        soon = bool(
            (due_date and 0 <= (due_date - today).days <= 30)
            or (due_miles is not None and mileage < due_miles and due_miles - mileage <= 500)
        )
        state = "service_overdue" if overdue else "due_soon" if soon else "on_track"
    return {
        "vehicle": vehicle,
        "current_odometer_miles": mileage or None,
        "last_service": _plain(dict(service)) if service else None,
        "next_due_date": _plain(service["next_due_date"]) if service else None,
        "next_due_miles": int(service["next_due_miles"]) if service and service["next_due_miles"] is not None else None,
        "state": state,
    }


@router.get("/notifications")
async def list_notifications(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    await _refresh_owner_reminders(db, current_user.id)
    result = await db.execute(
        text(
            """
            SELECT n.id::text, n.kind, n.title, n.body, n.read_at, n.completed_at, n.created_at,
                   n.vehicle_id::text, COALESCE(v.nickname, CONCAT(v.year, ' ', v.make, ' ', v.model)) AS vehicle_label
            FROM owner_notifications n JOIN vehicles v ON v.id = n.vehicle_id
            WHERE n.owner_id = CAST(:owner_id AS UUID)
            ORDER BY n.completed_at NULLS FIRST, n.created_at DESC
            """
        ),
        {"owner_id": current_user.id},
    )
    return [_plain(dict(row)) for row in result.mappings().all()]


@router.patch("/notifications/{notification_id}")
async def update_notification(
    notification_id: str, payload: NotificationUpdate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        text(
            """
            UPDATE owner_notifications SET read_at = CASE WHEN :read THEN COALESCE(read_at, NOW()) ELSE NULL END
            WHERE id = CAST(:id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
            RETURNING id::text
            """
        ),
        {"id": notification_id, "owner_id": current_user.id, "read": payload.read},
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.get("/vehicles/{vehicle_id}")
async def get_vehicle_care(
    vehicle_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    await _owned_vehicle(db, current_user.id, vehicle_id)
    await _refresh_owner_reminders(db, current_user.id)
    summary = await _vehicle_summary(db, current_user.id, vehicle_id)
    checkins = await db.execute(
        text(
            """SELECT id::text, recorded_on, odometer_miles, note, created_at
               FROM vehicle_checkins WHERE vehicle_id = CAST(:vehicle_id AS UUID)
               ORDER BY recorded_on DESC, created_at DESC"""
        ),
        {"vehicle_id": vehicle_id},
    )
    services = await db.execute(
        text(
            """
            SELECT sr.id::text, sr.service_date, sr.odometer_miles, sr.provider_name, sr.total_cost, sr.notes,
                   sr.invoice_filename, sr.next_due_date, sr.next_due_miles, sr.created_at,
                   COALESCE(json_agg(sri.description ORDER BY sri.created_at) FILTER (WHERE sri.id IS NOT NULL), '[]'::json) AS completed_items
            FROM vehicle_service_records sr
            LEFT JOIN vehicle_service_record_items sri ON sri.service_record_id = sr.id
            WHERE sr.vehicle_id = CAST(:vehicle_id AS UUID)
            GROUP BY sr.id
            ORDER BY sr.service_date DESC, sr.created_at DESC
            """
        ),
        {"vehicle_id": vehicle_id},
    )
    reminders = await db.execute(
        text(
            """SELECT id::text, reminder_type, due_at, target_date, target_miles, status
               FROM vehicle_care_reminders
               WHERE vehicle_id = CAST(:vehicle_id AS UUID) AND status = 'active'
               ORDER BY due_at DESC"""
        ),
        {"vehicle_id": vehicle_id},
    )
    return {
        "summary": summary,
        "checkins": [_plain(dict(row)) for row in checkins.mappings().all()],
        "service_records": [_plain(dict(row)) for row in services.mappings().all()],
        "active_reminders": [_plain(dict(row)) for row in reminders.mappings().all()],
    }


@router.post("/vehicles/{vehicle_id}/checkins", status_code=201)
async def create_checkin(
    vehicle_id: str, payload: CheckinCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    await _owned_vehicle(db, current_user.id, vehicle_id)
    recorded_on = payload.recorded_on or datetime.now(CALIFORNIA_TZ).date()
    if recorded_on > datetime.now(CALIFORNIA_TZ).date():
        raise HTTPException(status_code=422, detail="A check-in date cannot be in the future")
    checkin_id = str(uuid4())
    await db.execute(
        text(
            """
            INSERT INTO vehicle_checkins (id, vehicle_id, owner_id, recorded_on, odometer_miles, note)
            VALUES (CAST(:id AS UUID), CAST(:vehicle_id AS UUID), CAST(:owner_id AS UUID), :recorded_on, :odometer_miles, :note)
            """
        ),
        {"id": checkin_id, "vehicle_id": vehicle_id, "owner_id": current_user.id, "recorded_on": recorded_on,
         "odometer_miles": payload.odometer_miles, "note": payload.note.strip() if payload.note else None},
    )
    month_start = recorded_on.replace(day=1)
    await db.execute(
        text(
            """
            UPDATE vehicle_care_reminders
            SET status = 'resolved', resolved_at = NOW()
            WHERE vehicle_id = CAST(:vehicle_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
              AND reminder_type = 'monthly_checkin' AND reference_month = :reference_month AND status = 'active'
            """
        ),
        {"vehicle_id": vehicle_id, "owner_id": current_user.id, "reference_month": month_start},
    )
    await db.execute(
        text(
            """
            UPDATE owner_notifications n SET completed_at = NOW()
            FROM vehicle_care_reminders r
            WHERE n.reminder_id = r.id AND r.vehicle_id = CAST(:vehicle_id AS UUID)
              AND r.owner_id = CAST(:owner_id AS UUID) AND r.reminder_type = 'monthly_checkin'
              AND r.reference_month = :reference_month
            """
        ),
        {"vehicle_id": vehicle_id, "owner_id": current_user.id, "reference_month": month_start},
    )
    return {"id": checkin_id, "recorded_on": recorded_on, "odometer_miles": payload.odometer_miles, "note": payload.note}


@router.post("/vehicles/{vehicle_id}/service-records", status_code=201)
async def create_service_record(
    vehicle_id: str,
    service_date: date = Form(...),
    odometer_miles: int = Form(..., ge=0),
    provider_name: str = Form(..., min_length=1, max_length=160),
    completed_items: str = Form(...),
    total_cost: float = Form(0, ge=0),
    notes: str | None = Form(None),
    next_due_date: date | None = Form(None),
    next_due_miles: int | None = Form(None, ge=0),
    invoice: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    await _owned_vehicle(db, current_user.id, vehicle_id)
    if service_date > datetime.now(CALIFORNIA_TZ).date():
        raise HTTPException(status_code=422, detail="A service date cannot be in the future")
    try:
        items = [str(item).strip() for item in json.loads(completed_items) if str(item).strip()]
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=422, detail="Completed work items are invalid")
    if not items:
        raise HTTPException(status_code=422, detail="Add at least one completed work item")

    invoice_filename = None
    storage_key = None
    content_type = None
    if invoice and invoice.filename:
        suffix = Path(invoice.filename).suffix.lower()
        if invoice.content_type not in ALLOWED_INVOICE_TYPES or suffix not in ALLOWED_INVOICE_SUFFIXES:
            raise HTTPException(status_code=422, detail="Invoice must be a PDF, JPG, or PNG")
        contents = await invoice.read()
        if len(contents) > MAX_INVOICE_BYTES:
            raise HTTPException(status_code=422, detail="Invoice must be 10 MB or smaller")
        UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
        storage_key = f"{uuid4()}{suffix}"
        (UPLOAD_DIRECTORY / storage_key).write_bytes(contents)
        invoice_filename = Path(invoice.filename).name[:255]
        content_type = invoice.content_type

    record_id = str(uuid4())
    await db.execute(
        text(
            """
            INSERT INTO vehicle_service_records
              (id, vehicle_id, owner_id, service_date, odometer_miles, provider_name, total_cost, notes,
               invoice_filename, invoice_storage_key, invoice_content_type, next_due_date, next_due_miles)
            VALUES
              (CAST(:id AS UUID), CAST(:vehicle_id AS UUID), CAST(:owner_id AS UUID), :service_date,
               :odometer_miles, :provider_name, :total_cost, :notes, :invoice_filename, :storage_key,
               :content_type, :next_due_date, :next_due_miles)
            """
        ),
        {"id": record_id, "vehicle_id": vehicle_id, "owner_id": current_user.id, "service_date": service_date,
         "odometer_miles": odometer_miles, "provider_name": provider_name.strip(), "total_cost": total_cost,
         "notes": notes.strip() if notes else None, "invoice_filename": invoice_filename, "storage_key": storage_key,
         "content_type": content_type, "next_due_date": next_due_date, "next_due_miles": next_due_miles},
    )
    for item in items:
        await db.execute(
            text("INSERT INTO vehicle_service_record_items (id, service_record_id, description) VALUES (CAST(:id AS UUID), CAST(:record_id AS UUID), :description)"),
            {"id": str(uuid4()), "record_id": record_id, "description": item},
        )
    await db.execute(
        text(
            """
            UPDATE vehicle_care_reminders
            SET status = 'resolved', resolved_at = NOW(), resolved_by_service_record_id = CAST(:record_id AS UUID)
            WHERE vehicle_id = CAST(:vehicle_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
              AND reminder_type = 'service_due' AND status = 'active'
            """
        ),
        {"record_id": record_id, "vehicle_id": vehicle_id, "owner_id": current_user.id},
    )
    await db.execute(
        text(
            """
            UPDATE owner_notifications n SET completed_at = NOW()
            FROM vehicle_care_reminders r
            WHERE n.reminder_id = r.id AND r.vehicle_id = CAST(:vehicle_id AS UUID)
              AND r.owner_id = CAST(:owner_id AS UUID) AND r.reminder_type = 'service_due'
              AND r.resolved_by_service_record_id = CAST(:record_id AS UUID)
            """
        ),
        {"record_id": record_id, "vehicle_id": vehicle_id, "owner_id": current_user.id},
    )
    return {"id": record_id, "invoice_filename": invoice_filename}


@router.get("/service-records/{record_id}/invoice")
async def download_invoice(
    record_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        text(
            """
            SELECT invoice_filename, invoice_storage_key, invoice_content_type
            FROM vehicle_service_records
            WHERE id = CAST(:record_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
            """
        ),
        {"record_id": record_id, "owner_id": current_user.id},
    )
    invoice = result.mappings().first()
    if not invoice or not invoice["invoice_storage_key"]:
        raise HTTPException(status_code=404, detail="Invoice not found")
    path = UPLOAD_DIRECTORY / invoice["invoice_storage_key"]
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Invoice file is unavailable")
    return FileResponse(path, media_type=invoice["invoice_content_type"], filename=invoice["invoice_filename"])
