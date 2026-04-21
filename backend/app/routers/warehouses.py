from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.warehouse import (
    WarehouseInboxItem,
    WarehouseMessageCreate,
    WarehouseMessageOut,
    WarehouseOrderCreate,
    WarehouseOrderOut,
    WarehouseOrderUpdate,
    WarehousePartCreate,
    WarehousePartOut,
    WarehousePartUpdate,
    WarehouseSummaryOut,
)

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])


async def _get_mechanic_profile_id(db: AsyncSession, user_id: str) -> str:
    result = await db.execute(text("SELECT id::text FROM mechanics WHERE user_id = :user_id"), {"user_id": user_id})
    mechanic_id = result.scalar_one_or_none()
    if not mechanic_id:
        raise HTTPException(status_code=404, detail="Mechanic profile not found")
    return mechanic_id


async def _get_warehouse_profile_id(db: AsyncSession, user_id: str) -> str:
    result = await db.execute(text("SELECT id::text FROM warehouses WHERE user_id = :user_id"), {"user_id": user_id})
    warehouse_id = result.scalar_one_or_none()
    if not warehouse_id:
        raise HTTPException(status_code=404, detail="Warehouse profile not found")
    return warehouse_id


def _detail(error: Exception, fallback: str) -> HTTPException:
    return HTTPException(status_code=500, detail=fallback)


@router.get("/marketplace", response_model=list[WarehouseSummaryOut])
async def get_marketplace(
    query: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mechanic_id = await _get_mechanic_profile_id(db, current_user.id)
    sql = """
        SELECT
            w.id::text,
            w.user_id::text,
            w.name,
            w.address,
            CAST(w.lat AS FLOAT) AS lat,
            CAST(w.lng AS FLOAT) AS lng,
            w.contact_phone,
            w.description,
            w.fulfillment_hours,
            w.is_active,
            COUNT(wp.id) FILTER (WHERE wp.quantity > 0) AS available_parts,
            COUNT(wp.id) FILTER (WHERE wp.quantity <= wp.min_threshold) AS low_stock_parts,
            COALESCE(SUM(wp.quantity), 0) AS total_stock_units
        FROM warehouses w
        LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
        WHERE w.is_active = TRUE
          AND (
            :query IS NULL
            OR w.name ILIKE :like_query
            OR w.address ILIKE :like_query
            OR EXISTS (
              SELECT 1
              FROM warehouse_parts wp2
              WHERE wp2.warehouse_id = w.id
                AND (wp2.part_name ILIKE :like_query OR COALESCE(wp2.part_number, '') ILIKE :like_query)
            )
          )
        GROUP BY w.id
        ORDER BY available_parts DESC, w.name ASC
    """
    result = await db.execute(
        text(sql),
        {"query": query, "like_query": f"%{query.strip()}%" if query else None, "mechanic_id": mechanic_id},
    )
    return [WarehouseSummaryOut(**row) for row in result.mappings().all()]


@router.get("/marketplace/parts", response_model=list[WarehousePartOut])
async def search_marketplace_parts(
    query: str = Query(..., min_length=2),
    warehouse_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    await _get_mechanic_profile_id(db, current_user.id)
    sql = """
        SELECT
            wp.id::text,
            wp.warehouse_id::text,
            w.name AS warehouse_name,
            wp.part_name,
            wp.part_number,
            wp.quantity,
            wp.min_threshold,
            CAST(wp.price AS FLOAT) AS price,
            COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles,
            wp.manufacturer,
            wp.lead_time_label,
            (wp.quantity <= wp.min_threshold) AS is_low_stock,
            wp.created_at,
            wp.updated_at
        FROM warehouse_parts wp
        JOIN warehouses w ON w.id = wp.warehouse_id
        WHERE w.is_active = TRUE
          AND wp.quantity > 0
          AND (:warehouse_id IS NULL OR wp.warehouse_id = CAST(:warehouse_id AS UUID))
          AND (
            wp.part_name ILIKE :like_query
            OR COALESCE(wp.part_number, '') ILIKE :like_query
            OR COALESCE(wp.manufacturer, '') ILIKE :like_query
          )
        ORDER BY wp.quantity DESC, wp.part_name ASC
    """
    result = await db.execute(text(sql), {"warehouse_id": warehouse_id, "like_query": f"%{query.strip()}%"})
    return [WarehousePartOut(**row) for row in result.mappings().all()]


@router.get("/me", response_model=WarehouseSummaryOut)
async def get_my_warehouse(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    result = await db.execute(
        text(
            """
            SELECT
                w.id::text,
                w.user_id::text,
                w.name,
                w.address,
                CAST(w.lat AS FLOAT) AS lat,
                CAST(w.lng AS FLOAT) AS lng,
                w.contact_phone,
                w.description,
                w.fulfillment_hours,
                w.is_active,
                COUNT(wp.id) FILTER (WHERE wp.quantity > 0) AS available_parts,
                COUNT(wp.id) FILTER (WHERE wp.quantity <= wp.min_threshold) AS low_stock_parts,
                COALESCE(SUM(wp.quantity), 0) AS total_stock_units
            FROM warehouses w
            LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
            WHERE w.id = CAST(:warehouse_id AS UUID)
            GROUP BY w.id
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse profile not found")
    return WarehouseSummaryOut(**row)


@router.get("/inventory", response_model=list[WarehousePartOut])
async def get_warehouse_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    result = await db.execute(
        text(
            """
            SELECT
                wp.id::text,
                wp.warehouse_id::text,
                w.name AS warehouse_name,
                wp.part_name,
                wp.part_number,
                wp.quantity,
                wp.min_threshold,
                CAST(wp.price AS FLOAT) AS price,
                COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles,
                wp.manufacturer,
                wp.lead_time_label,
                (wp.quantity <= wp.min_threshold) AS is_low_stock,
                wp.created_at,
                wp.updated_at
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.warehouse_id = CAST(:warehouse_id AS UUID)
            ORDER BY wp.part_name ASC
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    return [WarehousePartOut(**row) for row in result.mappings().all()]


@router.post("/inventory", response_model=WarehousePartOut, status_code=201)
async def add_warehouse_part(
    payload: WarehousePartCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    part_id = str(uuid4())
    await db.execute(
        text(
            """
            INSERT INTO warehouse_parts (
                id, warehouse_id, part_name, part_number, quantity, min_threshold, price,
                compatible_vehicles, manufacturer, lead_time_label
            )
            VALUES (
                :id, CAST(:warehouse_id AS UUID), :part_name, :part_number, :quantity, :min_threshold, :price,
                CAST(:compatible_vehicles AS vehicle_type[]), :manufacturer, :lead_time_label
            )
            """
        ),
        {
            "id": part_id,
            "warehouse_id": warehouse_id,
            **payload.model_dump(),
        },
    )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT
                wp.id::text,
                wp.warehouse_id::text,
                w.name AS warehouse_name,
                wp.part_name,
                wp.part_number,
                wp.quantity,
                wp.min_threshold,
                CAST(wp.price AS FLOAT) AS price,
                COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles,
                wp.manufacturer,
                wp.lead_time_label,
                (wp.quantity <= wp.min_threshold) AS is_low_stock,
                wp.created_at,
                wp.updated_at
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.id = CAST(:part_id AS UUID)
            """
        ),
        {"part_id": part_id},
    )
    return WarehousePartOut(**result.mappings().first())


@router.patch("/inventory/{part_id}", response_model=WarehousePartOut)
async def update_warehouse_part(
    part_id: str,
    payload: WarehousePartUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    clauses = [f"{field} = :{field}" for field in updates.keys()]
    clauses.append("updated_at = NOW()")
    await db.execute(
        text(
            f"""
            UPDATE warehouse_parts
            SET {", ".join(clauses)}
            WHERE id = CAST(:part_id AS UUID)
              AND warehouse_id = CAST(:warehouse_id AS UUID)
            """
        ),
        {"part_id": part_id, "warehouse_id": warehouse_id, **updates},
    )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT
                wp.id::text,
                wp.warehouse_id::text,
                w.name AS warehouse_name,
                wp.part_name,
                wp.part_number,
                wp.quantity,
                wp.min_threshold,
                CAST(wp.price AS FLOAT) AS price,
                COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles,
                wp.manufacturer,
                wp.lead_time_label,
                (wp.quantity <= wp.min_threshold) AS is_low_stock,
                wp.created_at,
                wp.updated_at
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.id = CAST(:part_id AS UUID)
              AND wp.warehouse_id = CAST(:warehouse_id AS UUID)
            """
        ),
        {"part_id": part_id, "warehouse_id": warehouse_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse part not found")
    return WarehousePartOut(**row)


@router.get("/orders", response_model=list[WarehouseOrderOut])
async def get_warehouse_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        sql = """
            SELECT
                wo.id::text,
                wo.warehouse_id::text,
                w.name AS warehouse_name,
                wo.mechanic_id::text,
                mu.name AS mechanic_name,
                wo.warehouse_part_id::text,
                wp.part_name,
                wp.part_number,
                wo.quantity,
                wo.status::text AS status,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                CAST(wo.total_price AS FLOAT) AS total_price,
                wo.note,
                wo.created_at,
                wo.updated_at
            FROM warehouse_orders wo
            JOIN warehouses w ON w.id = wo.warehouse_id
            JOIN mechanics m ON m.id = wo.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE wo.mechanic_id = CAST(:profile_id AS UUID)
            ORDER BY wo.created_at DESC
        """
        profile_id = await _get_mechanic_profile_id(db, current_user.id)
    else:
        sql = """
            SELECT
                wo.id::text,
                wo.warehouse_id::text,
                w.name AS warehouse_name,
                wo.mechanic_id::text,
                mu.name AS mechanic_name,
                wo.warehouse_part_id::text,
                wp.part_name,
                wp.part_number,
                wo.quantity,
                wo.status::text AS status,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                CAST(wo.total_price AS FLOAT) AS total_price,
                wo.note,
                wo.created_at,
                wo.updated_at
            FROM warehouse_orders wo
            JOIN warehouses w ON w.id = wo.warehouse_id
            JOIN mechanics m ON m.id = wo.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE wo.warehouse_id = CAST(:profile_id AS UUID)
            ORDER BY wo.created_at DESC
        """
        profile_id = await _get_warehouse_profile_id(db, current_user.id)

    result = await db.execute(text(sql), {"profile_id": profile_id})
    return [WarehouseOrderOut(**row) for row in result.mappings().all()]


@router.post("/orders", response_model=WarehouseOrderOut, status_code=201)
async def create_warehouse_order(
    payload: WarehouseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mechanic_id = await _get_mechanic_profile_id(db, current_user.id)
    part_result = await db.execute(
        text(
            """
            SELECT
                wp.id::text,
                wp.warehouse_id::text,
                wp.part_name,
                wp.part_number,
                wp.quantity,
                CAST(wp.price AS FLOAT) AS price,
                w.name AS warehouse_name
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.id = CAST(:part_id AS UUID)
              AND wp.warehouse_id = CAST(:warehouse_id AS UUID)
              AND w.is_active = TRUE
            """
        ),
        {"part_id": payload.warehouse_part_id, "warehouse_id": payload.warehouse_id},
    )
    part = part_result.mappings().first()
    if not part:
        raise HTTPException(status_code=404, detail="Warehouse part not found")
    if int(part["quantity"]) < payload.quantity:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds warehouse stock")

    order_id = str(uuid4())
    total_price = round(float(part["price"]) * payload.quantity, 2)
    await db.execute(
        text(
            """
            INSERT INTO warehouse_orders (
                id, warehouse_id, mechanic_id, warehouse_part_id, quantity, status, unit_price, total_price, note
            )
            VALUES (
                :id, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID), CAST(:warehouse_part_id AS UUID),
                :quantity, 'requested', :unit_price, :total_price, :note
            )
            """
        ),
        {
            "id": order_id,
            "warehouse_id": payload.warehouse_id,
            "mechanic_id": mechanic_id,
            "warehouse_part_id": payload.warehouse_part_id,
            "quantity": payload.quantity,
            "unit_price": part["price"],
            "total_price": total_price,
            "note": payload.note,
        },
    )
    if payload.note:
        await db.execute(
            text(
                """
                INSERT INTO warehouse_messages (
                    id, warehouse_id, mechanic_id, warehouse_order_id, sender_user_id, sender_role, message
                ) VALUES (
                    :id, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID), CAST(:order_id AS UUID),
                    CAST(:sender_user_id AS UUID), 'mechanic', :message
                )
                """
            ),
            {
                "id": str(uuid4()),
                "warehouse_id": payload.warehouse_id,
                "mechanic_id": mechanic_id,
                "order_id": order_id,
                "sender_user_id": current_user.id,
                "message": payload.note,
            },
        )
    await db.commit()

    result = await db.execute(
        text(
            """
            SELECT
                wo.id::text,
                wo.warehouse_id::text,
                w.name AS warehouse_name,
                wo.mechanic_id::text,
                mu.name AS mechanic_name,
                wo.warehouse_part_id::text,
                wp.part_name,
                wp.part_number,
                wo.quantity,
                wo.status::text AS status,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                CAST(wo.total_price AS FLOAT) AS total_price,
                wo.note,
                wo.created_at,
                wo.updated_at
            FROM warehouse_orders wo
            JOIN warehouses w ON w.id = wo.warehouse_id
            JOIN mechanics m ON m.id = wo.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE wo.id = CAST(:order_id AS UUID)
            """
        ),
        {"order_id": order_id},
    )
    return WarehouseOrderOut(**result.mappings().first())


@router.patch("/orders/{order_id}", response_model=WarehouseOrderOut)
async def update_warehouse_order(
    order_id: str,
    payload: WarehouseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    result = await db.execute(
        text(
            """
            SELECT warehouse_id::text, quantity, CAST(unit_price AS FLOAT) AS unit_price
            FROM warehouse_orders
            WHERE id = CAST(:order_id AS UUID)
            """
        ),
        {"order_id": order_id},
    )
    order = result.mappings().first()
    if not order or order["warehouse_id"] != warehouse_id:
        raise HTTPException(status_code=404, detail="Order not found")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    if "unit_price" in updates:
        updates["total_price"] = round(float(updates["unit_price"]) * int(order["quantity"]), 2)

    clauses = [f"{field} = :{field}" for field in updates.keys()]
    clauses.append("updated_at = NOW()")
    await db.execute(
        text(
            f"""
            UPDATE warehouse_orders
            SET {", ".join(clauses)}
            WHERE id = CAST(:order_id AS UUID)
              AND warehouse_id = CAST(:warehouse_id AS UUID)
            """
        ),
        {"order_id": order_id, "warehouse_id": warehouse_id, **updates},
    )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT
                wo.id::text,
                wo.warehouse_id::text,
                w.name AS warehouse_name,
                wo.mechanic_id::text,
                mu.name AS mechanic_name,
                wo.warehouse_part_id::text,
                wp.part_name,
                wp.part_number,
                wo.quantity,
                wo.status::text AS status,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                CAST(wo.total_price AS FLOAT) AS total_price,
                wo.note,
                wo.created_at,
                wo.updated_at
            FROM warehouse_orders wo
            JOIN warehouses w ON w.id = wo.warehouse_id
            JOIN mechanics m ON m.id = wo.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE wo.id = CAST(:order_id AS UUID)
            """
        ),
        {"order_id": order_id},
    )
    return WarehouseOrderOut(**result.mappings().first())


@router.get("/messages/inbox", response_model=list[WarehouseInboxItem])
async def get_warehouse_inbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        profile_id = await _get_mechanic_profile_id(db, current_user.id)
        sql = """
            SELECT DISTINCT ON (wm.warehouse_id, wm.mechanic_id)
                wm.warehouse_id::text AS warehouse_id,
                w.name AS warehouse_name,
                wm.mechanic_id::text AS mechanic_id,
                mu.name AS mechanic_name,
                wm.warehouse_order_id::text AS warehouse_order_id,
                wm.message AS latest_message,
                wm.created_at AS latest_at,
                wm.sender_role::text AS sender_role,
                0 AS unread_hint
            FROM warehouse_messages wm
            JOIN warehouses w ON w.id = wm.warehouse_id
            JOIN mechanics m ON m.id = wm.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            WHERE wm.mechanic_id = CAST(:profile_id AS UUID)
            ORDER BY wm.warehouse_id, wm.mechanic_id, wm.created_at DESC
        """
    else:
        profile_id = await _get_warehouse_profile_id(db, current_user.id)
        sql = """
            SELECT DISTINCT ON (wm.warehouse_id, wm.mechanic_id)
                wm.warehouse_id::text AS warehouse_id,
                w.name AS warehouse_name,
                wm.mechanic_id::text AS mechanic_id,
                mu.name AS mechanic_name,
                wm.warehouse_order_id::text AS warehouse_order_id,
                wm.message AS latest_message,
                wm.created_at AS latest_at,
                wm.sender_role::text AS sender_role,
                0 AS unread_hint
            FROM warehouse_messages wm
            JOIN warehouses w ON w.id = wm.warehouse_id
            JOIN mechanics m ON m.id = wm.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            WHERE wm.warehouse_id = CAST(:profile_id AS UUID)
            ORDER BY wm.warehouse_id, wm.mechanic_id, wm.created_at DESC
        """
    result = await db.execute(text(sql), {"profile_id": profile_id})
    return [WarehouseInboxItem(**row) for row in result.mappings().all()]


@router.get("/messages/thread", response_model=list[WarehouseMessageOut])
async def get_warehouse_thread(
    warehouse_id: str | None = None,
    mechanic_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        mechanic_profile_id = await _get_mechanic_profile_id(db, current_user.id)
        if not warehouse_id:
            raise HTTPException(status_code=422, detail="warehouse_id is required")
        params = {"warehouse_id": warehouse_id, "mechanic_id": mechanic_profile_id}
    else:
        warehouse_profile_id = await _get_warehouse_profile_id(db, current_user.id)
        if not mechanic_id:
            raise HTTPException(status_code=422, detail="mechanic_id is required")
        params = {"warehouse_id": warehouse_profile_id, "mechanic_id": mechanic_id}

    result = await db.execute(
        text(
            """
            SELECT
                wm.id::text,
                wm.warehouse_id::text,
                wm.mechanic_id::text,
                wm.warehouse_order_id::text,
                wm.sender_user_id::text,
                wm.sender_role::text AS sender_role,
                su.name AS sender_name,
                w.name AS warehouse_name,
                mu.name AS mechanic_name,
                wm.message,
                wm.created_at
            FROM warehouse_messages wm
            JOIN users su ON su.id = wm.sender_user_id
            JOIN warehouses w ON w.id = wm.warehouse_id
            JOIN mechanics m ON m.id = wm.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            WHERE wm.warehouse_id = CAST(:warehouse_id AS UUID)
              AND wm.mechanic_id = CAST(:mechanic_id AS UUID)
            ORDER BY wm.created_at ASC
            """
        ),
        params,
    )
    return [WarehouseMessageOut(**row) for row in result.mappings().all()]


@router.post("/messages/thread", response_model=WarehouseMessageOut, status_code=201)
async def send_warehouse_message(
    payload: WarehouseMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        mechanic_id = await _get_mechanic_profile_id(db, current_user.id)
        if not payload.warehouse_id:
            raise HTTPException(status_code=422, detail="warehouse_id is required")
        warehouse_id = payload.warehouse_id
        sender_role = "mechanic"
    else:
        warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
        if not payload.mechanic_id:
            raise HTTPException(status_code=422, detail="mechanic_id is required")
        mechanic_id = payload.mechanic_id
        sender_role = "warehouse"

    message_id = str(uuid4())
    await db.execute(
        text(
            """
            INSERT INTO warehouse_messages (
                id, warehouse_id, mechanic_id, warehouse_order_id, sender_user_id, sender_role, message
            )
            VALUES (
                :id, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID),
                CAST(NULLIF(:warehouse_order_id, '') AS UUID), CAST(:sender_user_id AS UUID), :sender_role, :message
            )
            """
        ),
        {
            "id": message_id,
            "warehouse_id": warehouse_id,
            "mechanic_id": mechanic_id,
            "warehouse_order_id": payload.warehouse_order_id or "",
            "sender_user_id": current_user.id,
            "sender_role": sender_role,
            "message": payload.message,
        },
    )
    await db.commit()
    result = await db.execute(
        text(
            """
            SELECT
                wm.id::text,
                wm.warehouse_id::text,
                wm.mechanic_id::text,
                wm.warehouse_order_id::text,
                wm.sender_user_id::text,
                wm.sender_role::text AS sender_role,
                su.name AS sender_name,
                w.name AS warehouse_name,
                mu.name AS mechanic_name,
                wm.message,
                wm.created_at
            FROM warehouse_messages wm
            JOIN users su ON su.id = wm.sender_user_id
            JOIN warehouses w ON w.id = wm.warehouse_id
            JOIN mechanics m ON m.id = wm.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            WHERE wm.id = CAST(:message_id AS UUID)
            """
        ),
        {"message_id": message_id},
    )
    return WarehouseMessageOut(**result.mappings().first())
