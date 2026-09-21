"""Persistence APIs for the full Wingman role workspaces.

The visual prototype contains rich profiles and receipt panels.  This router
turns those pieces into real, role-scoped data without introducing payment
processing or storing card information.
"""

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User


router = APIRouter(prefix="/workspace", tags=["Workspace"])


class OwnerWorkspaceProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    preferred_language: str | None = Field(default=None, max_length=40)
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_relationship: str | None = Field(default=None, max_length=80)
    emergency_contact_phone: str | None = Field(default=None, max_length=40)
    default_vehicle_id: str | None = None
    preferred_service_mode: str | None = Field(default=None, max_length=32)
    preferred_appointment_time: str | None = Field(default=None, max_length=32)
    accessibility_notes: str | None = None
    notify_request_updates: bool | None = None
    notify_appointment_reminders: bool | None = None
    notify_vehicle_care: bool | None = None
    notify_messages: bool | None = None
    notify_order_updates: bool | None = None


class BusinessWorkspaceProfileUpdate(BaseModel):
    business_name: str | None = Field(default=None, max_length=180)
    business_category: str | None = Field(default=None, max_length=80)
    contact_person: str | None = Field(default=None, max_length=120)
    website_url: HttpUrl | None = None
    description: str | None = None
    street_address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    service_modes: list[str] | None = None
    service_radius_miles: int | None = Field(default=None, ge=0, le=500)
    areas_served: str | None = None
    business_hours: dict[str, object] | None = None
    holiday_hours: str | None = None
    offered_services: list[str] | None = None
    makes_serviced: str | None = None
    vehicle_types_supported: str | None = None
    powertrains_supported: str | None = None
    languages_spoken: str | None = None
    facilities: list[str] | None = None
    credentials: dict[str, object] | None = None
    accepts_new_work: bool | None = None
    appointments_required: bool | None = None
    walk_ins_accepted: bool | None = None
    warranty_or_returns_policy: str | None = None
    arrival_or_pickup_instructions: str | None = None
    accepted_payment_methods: str | None = None
    fulfillment_minimum_order: float | None = Field(default=None, ge=0)
    fulfillment_cutoff_time: str | None = None
    fulfillment_processing_time: str | None = Field(default=None, max_length=120)


class InvoiceItemInput(BaseModel):
    description: str = Field(min_length=1, max_length=240)
    quantity: int = Field(default=1, ge=1, le=1000)
    unit_price: float = Field(default=0, ge=0)


class InvoiceCreate(BaseModel):
    owner_id: str
    provider_name: str = Field(min_length=1, max_length=180)
    request_id: str | None = None
    appointment_id: str | None = None
    taxes_and_fees: float = Field(default=0, ge=0)
    provider_note: str | None = None
    items: list[InvoiceItemInput] = Field(min_length=1, max_length=50)


class InvoiceStatusUpdate(BaseModel):
    status: str = Field(pattern="^(draft|issued|paid|void)$")


async def _owner_profile(db: AsyncSession, user_id: str) -> dict:
    row = (await db.execute(text("""
        SELECT u.id::TEXT AS user_id, u.name, u.email, u.phone, u.street_address,
               u.city, u.state, u.postal_code,
               p.display_name, p.preferred_language, p.emergency_contact_name,
               p.emergency_contact_relationship, p.emergency_contact_phone,
               p.default_vehicle_id::TEXT, p.preferred_service_mode,
               p.preferred_appointment_time, p.accessibility_notes,
               p.notify_request_updates, p.notify_appointment_reminders,
               p.notify_vehicle_care, p.notify_messages, p.notify_order_updates
        FROM users u
        LEFT JOIN owner_workspace_profiles p ON p.user_id = u.id
        WHERE u.id = :uid
    """), {"uid": user_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Owner profile not found")
    return dict(row)


@router.get("/owner-profile")
async def get_owner_workspace_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    return await _owner_profile(db, current_user.id)


@router.put("/owner-profile")
async def update_owner_workspace_profile(
    payload: OwnerWorkspaceProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    values = payload.model_dump(exclude_unset=True)
    if "default_vehicle_id" in values and values["default_vehicle_id"]:
        owned = (await db.execute(text("SELECT 1 FROM vehicles WHERE id = CAST(:id AS UUID) AND owner_id = :owner"), {
            "id": values["default_vehicle_id"], "owner": current_user.id,
        })).first()
        if not owned:
            raise HTTPException(status_code=422, detail="Default vehicle must belong to this owner")

    columns = ["user_id"] + list(values)
    placeholders = [":user_id"] + [f":{key}" for key in values]
    update_fields = [f"{key} = EXCLUDED.{key}" for key in values]
    if update_fields:
        update_fields.append("updated_at = NOW()")
        await db.execute(text(f"""
            INSERT INTO owner_workspace_profiles ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_fields)}
        """), {"user_id": current_user.id, **values})
        await db.commit()
    return await _owner_profile(db, current_user.id)


async def _business_profile(db: AsyncSession, user_id: str) -> dict:
    row = (await db.execute(text("""
        SELECT u.id::TEXT AS user_id, u.role, u.name, u.email, u.phone,
               p.business_name, p.business_category, p.contact_person,
               p.website_url, p.description, p.street_address, p.city, p.state,
               p.postal_code, p.service_modes, p.service_radius_miles,
               p.areas_served, p.business_hours, p.holiday_hours,
               p.offered_services, p.makes_serviced, p.vehicle_types_supported,
               p.powertrains_supported, p.languages_spoken, p.facilities,
               p.credentials, p.accepts_new_work, p.appointments_required,
               p.walk_ins_accepted, p.warranty_or_returns_policy,
               p.arrival_or_pickup_instructions, p.accepted_payment_methods,
               p.fulfillment_minimum_order, p.fulfillment_cutoff_time,
               p.fulfillment_processing_time
        FROM users u
        LEFT JOIN business_workspace_profiles p ON p.user_id = u.id
        WHERE u.id = :uid
    """), {"uid": user_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Business profile not found")
    return dict(row)


@router.get("/business-profile")
async def get_business_workspace_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"mechanic", "warehouse"}:
        raise HTTPException(status_code=403, detail="Business profiles are for mechanics and warehouses")
    return await _business_profile(db, current_user.id)


@router.put("/business-profile")
async def update_business_workspace_profile(
    payload: BusinessWorkspaceProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"mechanic", "warehouse"}:
        raise HTTPException(status_code=403, detail="Business profiles are for mechanics and warehouses")
    values = payload.model_dump(exclude_unset=True)
    if "website_url" in values and values["website_url"] is not None:
        values["website_url"] = str(values["website_url"])
    for json_key in ("business_hours", "credentials"):
        if json_key in values and values[json_key] is not None:
            values[json_key] = json.dumps(values[json_key])

    columns = ["user_id"] + list(values)
    placeholders = [":user_id"] + [f"CAST(:{key} AS JSONB)" if key in {"business_hours", "credentials"} else f":{key}" for key in values]
    update_fields = [f"{key} = EXCLUDED.{key}" for key in values]
    if update_fields:
        update_fields.append("updated_at = NOW()")
        await db.execute(text(f"""
            INSERT INTO business_workspace_profiles ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_fields)}
        """), {"user_id": current_user.id, **values})
        if current_user.role == "mechanic" and "accepts_new_work" in values:
            await db.execute(text("UPDATE mechanics SET is_available = :available, updated_at = NOW() WHERE user_id = :uid"), {
                "available": values["accepts_new_work"], "uid": current_user.id,
            })
        await db.commit()
    return await _business_profile(db, current_user.id)


def _invoice_payload(row: dict) -> dict:
    row["items"] = row.get("items") or []
    return row


@router.get("/invoices")
async def list_recorded_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"owner", "mechanic", "admin"}:
        raise HTTPException(status_code=403, detail="Invoices are unavailable for this account")
    condition = "i.owner_id = :uid" if current_user.role == "owner" else "i.provider_user_id = :uid"
    rows = (await db.execute(text(f"""
        SELECT i.id::TEXT, i.reference, i.owner_id::TEXT, i.provider_user_id::TEXT,
               i.request_id::TEXT, CASE WHEN i.request_id IS NOT NULL THEN CONCAT('RA-', UPPER(SUBSTRING(i.request_id::TEXT, 1, 8))) END AS request_ref,
               i.appointment_id::TEXT, i.provider_name, i.status,
               CAST(i.subtotal AS FLOAT) AS subtotal,
               CAST(i.taxes_and_fees AS FLOAT) AS taxes_and_fees,
               CAST(i.total AS FLOAT) AS total, i.payment_recorded_at,
               i.provider_note, i.created_at,
               COALESCE(json_agg(json_build_object(
                 'id', ii.id::TEXT, 'description', ii.description,
                 'quantity', ii.quantity, 'unit_price', CAST(ii.unit_price AS FLOAT),
                 'line_total', CAST(ii.line_total AS FLOAT)
               ) ORDER BY ii.created_at) FILTER (WHERE ii.id IS NOT NULL), '[]'::json) AS items
        FROM recorded_invoices i
        LEFT JOIN recorded_invoice_items ii ON ii.invoice_id = i.id
        WHERE {condition}
        GROUP BY i.id
        ORDER BY i.created_at DESC
    """), {"uid": current_user.id})).mappings().all()
    return [_invoice_payload(dict(row)) for row in rows]


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_recorded_invoice(
    payload: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    owner = (await db.execute(text("SELECT 1 FROM users WHERE id = CAST(:id AS UUID) AND role = 'owner'"), {
        "id": payload.owner_id,
    })).first()
    if not owner:
        raise HTTPException(status_code=422, detail="Invoice owner must be an active owner account")
    subtotal = round(sum(item.quantity * item.unit_price for item in payload.items), 2)
    taxes = round(payload.taxes_and_fees, 2)
    invoice_id = str(uuid4())
    reference = f"WM-{datetime.now(timezone.utc):%Y%m%d}-{invoice_id[:6].upper()}"
    await db.execute(text("""
        INSERT INTO recorded_invoices
          (id, reference, owner_id, provider_user_id, request_id, appointment_id,
           provider_name, status, subtotal, taxes_and_fees, total, provider_note)
        VALUES (CAST(:id AS UUID), :reference, CAST(:owner_id AS UUID), :provider_id,
                CAST(:request_id AS UUID), CAST(:appointment_id AS UUID), :provider_name,
                'issued', :subtotal, :taxes, :total, :note)
    """), {
        "id": invoice_id, "reference": reference, "owner_id": payload.owner_id,
        "provider_id": current_user.id, "request_id": payload.request_id,
        "appointment_id": payload.appointment_id, "provider_name": payload.provider_name,
        "subtotal": subtotal, "taxes": taxes, "total": round(subtotal + taxes, 2),
        "note": payload.provider_note,
    })
    for item in payload.items:
        line_total = round(item.quantity * item.unit_price, 2)
        await db.execute(text("""
            INSERT INTO recorded_invoice_items (id, invoice_id, description, quantity, unit_price, line_total)
            VALUES (CAST(:id AS UUID), CAST(:invoice_id AS UUID), :description, :quantity, :unit_price, :line_total)
        """), {
            "id": str(uuid4()), "invoice_id": invoice_id, "description": item.description,
            "quantity": item.quantity, "unit_price": item.unit_price, "line_total": line_total,
        })
    await db.commit()
    return {"id": invoice_id, "reference": reference, "status": "issued", "subtotal": subtotal, "total": round(subtotal + taxes, 2)}


@router.patch("/invoices/{invoice_id}/status")
async def update_recorded_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    result = await db.execute(text("""
        UPDATE recorded_invoices
        SET status = :status,
            payment_recorded_at = CASE WHEN :status = 'paid' THEN NOW() ELSE payment_recorded_at END,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND provider_user_id = :provider_id
        RETURNING id::TEXT, reference, status, payment_recorded_at
    """), {"id": invoice_id, "status": payload.status, "provider_id": current_user.id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()
    return dict(row)
