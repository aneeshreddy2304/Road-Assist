"""Owner-facing California service directory and fixed-price parts marketplace.

The directory intentionally stores public business identity/location and the
services published by the business, while every contact route is synthetic for
the demo.  No live business is contacted through this application.
"""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User


router = APIRouter(prefix="/owner-marketplace", tags=["Owner Marketplace"])


class PartOrderCreate(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=10)
    delivery_name: str = Field(min_length=2, max_length=120)
    delivery_address: str = Field(min_length=8, max_length=500)
    delivery_phone: str = Field(min_length=7, max_length=40)
    delivery_notes: str | None = Field(default=None, max_length=1000)


class ProviderBookingCreate(BaseModel):
    provider_id: str
    vehicle_id: str | None = None
    requested_for: datetime
    service_type: str = Field(min_length=2, max_length=160)
    notes: str | None = Field(default=None, max_length=1000)


class ProviderBookingUpdate(BaseModel):
    requested_for: datetime | None = None
    status: str | None = None


def _plain(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


def _require_owner(current_user: User) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access is required")
    return current_user


def _provider_inventory(category: str, services: list[str] | None) -> list[dict]:
    """Return safe demo inventory matched to the provider's published work.

    Business identity and services are public directory data; quantities and
    prices are deliberately synthetic so the owner can verify likely parts
    before creating a request without representing live business stock.
    """
    service_text = " ".join(services or []).lower()
    catalog: list[tuple[str, str, float, int]] = []
    if "oil" in service_text:
        catalog.extend([("Synthetic 0W-20 oil", "Fluids", 39.99, 12), ("Premium oil filter", "Filters", 12.49, 8)])
    if "brake" in service_text:
        catalog.extend([("Ceramic brake pad set", "Brakes", 64.99, 4), ("DOT 4 brake fluid", "Fluids", 14.99, 7)])
    if "battery" in service_text or "jump" in service_text:
        catalog.append(("AGM replacement battery", "Electrical", 189.99, 3))
    if "tire" in service_text or category == "tire":
        catalog.extend([("All-season tire", "Tires", 129.99, 6), ("Tire repair kit", "Tires", 24.99, 9)])
    if "diagnostic" in service_text:
        catalog.append(("OBD-II diagnostic adapter", "Diagnostics", 34.99, 5))
    if category == "parts":
        catalog.extend([("Windshield wiper pair", "Visibility", 29.99, 14), ("Engine air filter", "Filters", 18.99, 11)])
    if not catalog:
        catalog = [("Emergency roadside kit", "Roadside", 42.99, 5)]

    seen: set[str] = set()
    return [
        {"name": name, "category": part_category, "price": price, "quantity": quantity, "availability": "In stock" if quantity > 0 else "Unavailable"}
        for name, part_category, price, quantity in catalog
        if not (name in seen or seen.add(name))
    ]


@router.get("/providers")
async def list_providers(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    category: str | None = Query(default=None),
    service_mode: str | None = Query(default=None),
    query: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_db),
):
    """List the curated California demo directory, with simple usable filters."""
    filters = ["is_active = TRUE"]
    params: dict[str, object] = {}
    if category and category != "all":
        filters.append("category = :category")
        params["category"] = category
    if service_mode and service_mode != "all":
        filters.append(":service_mode = ANY(service_modes)")
        params["service_mode"] = service_mode
    if query and query.strip():
        filters.append("(name ILIKE :query OR city ILIKE :query OR :query = ANY(services))")
        params["query"] = f"%{query.strip()}%"

    distance = "NULL::FLOAT AS distance_km"
    order = "city ASC, name ASC"
    if lat is not None and lng is not None:
        distance = "ROUND(CAST(ST_Distance(location, ST_MakePoint(:lng, :lat)::GEOGRAPHY) / 1000 AS NUMERIC), 2) AS distance_km"
        params.update({"lat": lat, "lng": lng})
        order = "distance_km ASC NULLS LAST, name ASC"

    sql = f"""
      SELECT id::text, name, category, city, state, address,
             ST_Y(location::geometry)::float AS lat,
             ST_X(location::geometry)::float AS lng,
             services, service_modes, can_schedule, description,
             synthetic_phone, synthetic_email, website_url, {distance}
      FROM owner_directory_providers
      WHERE {' AND '.join(filters)}
      ORDER BY {order}
    """
    result = await db.execute(text(sql), params)
    providers = [_plain(dict(row)) for row in result.mappings().all()]
    for provider in providers:
        provider["inventory"] = _provider_inventory(provider["category"], provider.get("services"))
    return providers


@router.get("/parts")
async def list_owner_parts(
    query: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    filters = ["p.is_active = TRUE", "d.is_active = TRUE"]
    params: dict[str, object] = {}
    if query and query.strip():
        filters.append("(p.name ILIKE :query OR COALESCE(p.brand, '') ILIKE :query)")
        params["query"] = f"%{query.strip()}%"
    if category and category != "all":
        filters.append("p.category = :category")
        params["category"] = category
    result = await db.execute(
        text(
            f"""
            SELECT p.id::text, p.name, p.brand, p.category, p.price, p.stock_count,
                   p.description, d.name AS retailer_name, d.city AS retailer_city,
                   d.synthetic_phone, d.website_url
            FROM owner_part_products p
            JOIN owner_directory_providers d ON d.id = p.provider_id
            WHERE {' AND '.join(filters)}
            ORDER BY p.category, p.name
            """
        ),
        params,
    )
    return [_plain(dict(row)) for row in result.mappings().all()]


@router.post("/orders", status_code=201)
async def create_owner_part_order(
    payload: PartOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)
    product = await db.execute(
        text(
            """
            SELECT p.id::text, p.name, p.price, p.stock_count, d.name AS retailer_name
            FROM owner_part_products p
            JOIN owner_directory_providers d ON d.id = p.provider_id
            WHERE p.id = CAST(:product_id AS UUID) AND p.is_active = TRUE AND d.is_active = TRUE
            """
        ),
        {"product_id": payload.product_id},
    )
    product = product.mappings().first()
    if not product:
        raise HTTPException(status_code=404, detail="Part is not available")
    if int(product["stock_count"]) < payload.quantity:
        raise HTTPException(status_code=409, detail="That quantity is no longer available")

    order_id = str(uuid4())
    reference = f"PO-{order_id.split('-')[0].upper()}"
    total = Decimal(product["price"]) * payload.quantity
    await db.execute(
        text(
            """
            INSERT INTO owner_part_orders
              (id, order_ref, owner_id, product_id, quantity, unit_price, total_price,
               delivery_name, delivery_address, delivery_phone, delivery_notes, status)
            VALUES
              (CAST(:id AS UUID), :order_ref, CAST(:owner_id AS UUID), CAST(:product_id AS UUID),
               :quantity, :unit_price, :total_price, :delivery_name, :delivery_address,
               :delivery_phone, :delivery_notes, 'confirmed')
            """
        ),
        {
            "id": order_id, "order_ref": reference, "owner_id": current_user.id,
            "product_id": payload.product_id, "quantity": payload.quantity,
            "unit_price": product["price"], "total_price": total,
            "delivery_name": payload.delivery_name, "delivery_address": payload.delivery_address,
            "delivery_phone": payload.delivery_phone, "delivery_notes": payload.delivery_notes,
        },
    )
    await db.execute(
        text("UPDATE owner_part_products SET stock_count = stock_count - :quantity WHERE id = CAST(:product_id AS UUID)"),
        {"quantity": payload.quantity, "product_id": payload.product_id},
    )
    await db.commit()
    return {
        "id": order_id, "order_ref": reference, "status": "confirmed",
        "product_name": product["name"], "retailer_name": product["retailer_name"],
        "total_price": float(total), "delivery_estimate": "Delivery details confirmed. Demo tracking will update here.",
    }


@router.post("/bookings", status_code=201)
async def create_provider_booking(
    payload: ProviderBookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)
    provider = await db.execute(
        text("SELECT id::text, name FROM owner_directory_providers WHERE id = CAST(:id AS UUID) AND is_active = TRUE AND can_schedule = TRUE"),
        {"id": payload.provider_id},
    )
    provider = provider.mappings().first()
    if not provider:
        raise HTTPException(status_code=404, detail="This provider does not offer scheduling in the demo")
    if payload.vehicle_id:
        vehicle = await db.execute(
            text("SELECT 1 FROM vehicles WHERE id = CAST(:vehicle_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)"),
            {"vehicle_id": payload.vehicle_id, "owner_id": current_user.id},
        )
        if not vehicle.scalar():
            raise HTTPException(status_code=403, detail="That vehicle does not belong to you")
    booking_id = str(uuid4())
    await db.execute(
        text("""
          INSERT INTO owner_provider_appointments
            (id, owner_id, provider_id, vehicle_id, requested_for, service_type, notes, status)
          VALUES (CAST(:id AS UUID), CAST(:owner_id AS UUID), CAST(:provider_id AS UUID),
                  CAST(:vehicle_id AS UUID), :requested_for, :service_type, :notes, 'requested')
        """),
        {"id": booking_id, "owner_id": current_user.id, "provider_id": payload.provider_id,
         "vehicle_id": payload.vehicle_id, "requested_for": payload.requested_for,
         "service_type": payload.service_type, "notes": payload.notes},
    )
    await db.commit()
    return {"id": booking_id, "provider_name": provider["name"], "status": "requested", "requested_for": payload.requested_for.isoformat()}


@router.get("/bookings")
async def list_provider_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)
    result = await db.execute(text("""
      SELECT a.id::text, a.requested_for, a.service_type, a.notes, a.status, a.created_at,
             d.name AS provider_name, d.address AS provider_address,
             CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label
      FROM owner_provider_appointments a
      JOIN owner_directory_providers d ON d.id = a.provider_id
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.owner_id = CAST(:owner_id AS UUID)
      ORDER BY a.requested_for ASC
    """), {"owner_id": current_user.id})
    return [_plain(dict(row)) for row in result.mappings().all()]


@router.patch("/bookings/{booking_id}")
async def update_provider_booking(
    booking_id: str,
    payload: ProviderBookingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)
    if payload.status not in {None, "requested", "cancelled"}:
        raise HTTPException(status_code=400, detail="Owners can only request or cancel an appointment")
    current = await db.execute(
        text("""
          SELECT id::text, requested_for, status
          FROM owner_provider_appointments
          WHERE id = CAST(:booking_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
        """),
        {"booking_id": booking_id, "owner_id": current_user.id},
    )
    current = current.mappings().first()
    if not current:
        raise HTTPException(status_code=404, detail="Appointment not found")
    requested_for = payload.requested_for or current["requested_for"]
    status = payload.status or ("requested" if payload.requested_for else current["status"])
    await db.execute(
        text("""
          UPDATE owner_provider_appointments
          SET requested_for = :requested_for, status = :status
          WHERE id = CAST(:booking_id AS UUID) AND owner_id = CAST(:owner_id AS UUID)
        """),
        {
            "booking_id": booking_id,
            "owner_id": current_user.id,
            "requested_for": requested_for,
            "status": status,
        },
    )
    await db.commit()
    return {"id": booking_id, "requested_for": requested_for.isoformat(), "status": status}


@router.get("/orders")
async def list_owner_part_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)
    result = await db.execute(
        text(
            """
            SELECT o.id::text, o.order_ref, o.quantity, o.unit_price, o.total_price, o.status,
                   o.delivery_name, o.delivery_address, o.delivery_phone, o.delivery_notes,
                   o.created_at, p.name AS product_name, d.name AS retailer_name
            FROM owner_part_orders o
            JOIN owner_part_products p ON p.id = o.product_id
            JOIN owner_directory_providers d ON d.id = p.provider_id
            WHERE o.owner_id = CAST(:owner_id AS UUID)
            ORDER BY o.created_at DESC
            """
        ),
        {"owner_id": current_user.id},
    )
    return [_plain(dict(row)) for row in result.mappings().all()]
