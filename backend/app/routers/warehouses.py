from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.warehouse import (
    WarehouseDetailOut,
    WarehouseInboxItem,
    WarehouseMessageCreate,
    WarehouseMessageOut,
    WarehouseOrderCreate,
    WarehouseOrderDetailOut,
    WarehouseOrderGroupCreate,
    WarehouseOrderGroupOut,
    WarehouseOrderLineOut,
    WarehouseOrderOut,
    WarehouseOrderUpdate,
    WarehousePartCreate,
    WarehousePartOut,
    WarehousePartUpdate,
    WarehouseSummaryOut,
)

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])
DEFAULT_WAREHOUSE_LAT = 37.5407
DEFAULT_WAREHOUSE_LNG = -77.4360

ACTIVE_WAREHOUSE_ORDER_STATUSES = (
    "requested",
    "accepted",
    "packed",
    "awaiting_shipping",
    "shipped",
    "out_for_delivery",
)


async def _get_mechanic_profile_id(db: AsyncSession, user_id: str) -> str:
    result = await db.execute(
        text("SELECT id::text FROM mechanics WHERE user_id = CAST(:user_id AS UUID)"),
        {"user_id": user_id},
    )
    mechanic_id = result.scalar_one_or_none()
    if not mechanic_id:
        raise HTTPException(status_code=404, detail="Mechanic profile not found")
    return mechanic_id


async def _get_warehouse_profile_id(db: AsyncSession, user_id: str) -> str:
    result = await db.execute(
        text("SELECT id::text FROM warehouses WHERE user_id = CAST(:user_id AS UUID)"),
        {"user_id": user_id},
    )
    warehouse_id = result.scalar_one_or_none()
    if not warehouse_id:
        raise HTTPException(status_code=404, detail="Warehouse profile not found")
    return warehouse_id


async def _table_has_column(db: AsyncSession, table_name: str, column_name: str) -> bool:
    result = await db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
            )
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return bool(result.scalar())


async def _warehouse_column_map(db: AsyncSession) -> dict[str, bool]:
    columns = [
        "lat",
        "lng",
        "contact_phone",
        "description",
        "fulfillment_hours",
        "approval_status",
    ]
    return {column: await _table_has_column(db, "warehouses", column) for column in columns}


async def _warehouse_part_column_map(db: AsyncSession) -> dict[str, bool]:
    columns = [
        "manufacturer",
        "lead_time_label",
        "compatible_vehicles",
    ]
    return {column: await _table_has_column(db, "warehouse_parts", column) for column in columns}


def _warehouse_select_columns(columns: dict[str, bool]) -> str:
    lat_expr = f"CAST(w.lat AS FLOAT) AS lat" if columns.get("lat") else f"{DEFAULT_WAREHOUSE_LAT}::FLOAT AS lat"
    lng_expr = f"CAST(w.lng AS FLOAT) AS lng" if columns.get("lng") else f"{DEFAULT_WAREHOUSE_LNG}::FLOAT AS lng"
    contact_phone_expr = "w.contact_phone" if columns.get("contact_phone") else "NULL::VARCHAR AS contact_phone"
    description_expr = "w.description" if columns.get("description") else "NULL::TEXT AS description"
    fulfillment_expr = "w.fulfillment_hours" if columns.get("fulfillment_hours") else "NULL::VARCHAR AS fulfillment_hours"
    return ",\n            ".join(
        [
            lat_expr,
            lng_expr,
            contact_phone_expr,
            description_expr,
            fulfillment_expr,
        ]
    )


def _warehouse_part_select_columns(columns: dict[str, bool]) -> str:
    compatible_expr = (
        "COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles"
        if columns.get("compatible_vehicles")
        else "ARRAY[]::text[] AS compatible_vehicles"
    )
    manufacturer_expr = "wp.manufacturer" if columns.get("manufacturer") else "NULL::VARCHAR AS manufacturer"
    lead_time_expr = "wp.lead_time_label" if columns.get("lead_time_label") else "NULL::VARCHAR AS lead_time_label"
    return ",\n                ".join([compatible_expr, manufacturer_expr, lead_time_expr])


def _build_order_ref() -> str:
    return f"WO-{str(uuid4()).split('-')[0].upper()}"


def _normalize_order_status(status: str | None) -> str | None:
    if not status:
        return status
    if status == "confirmed":
        return "accepted"
    return status


def _detail(error: Exception, fallback: str) -> HTTPException:
    return HTTPException(status_code=500, detail=fallback)


@router.get("/marketplace", response_model=list[WarehouseSummaryOut])
async def get_marketplace(
    query: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    await _get_mechanic_profile_id(db, current_user.id)
    warehouse_columns = await _warehouse_column_map(db)
    approval_filter = "AND w.approval_status = 'approved'" if warehouse_columns.get("approval_status") else ""
    warehouse_selects = _warehouse_select_columns(warehouse_columns)
    search_filter = ""
    params: dict[str, object] = {}
    if query and query.strip():
        search_filter = """
          AND (
            w.name ILIKE :like_query
            OR w.address ILIKE :like_query
            OR EXISTS (
              SELECT 1
              FROM warehouse_parts wp2
              WHERE wp2.warehouse_id = w.id
                AND (wp2.part_name ILIKE :like_query OR COALESCE(wp2.part_number, '') ILIKE :like_query)
            )
          )
        """
        params["like_query"] = f"%{query.strip()}%"
    sql = """
        SELECT
            w.id::text,
            w.user_id::text,
            w.name,
            w.address,
            {warehouse_selects},
            w.is_active,
            COUNT(wp.id) FILTER (WHERE wp.quantity > 0) AS available_parts,
            COUNT(wp.id) FILTER (WHERE wp.quantity <= wp.min_threshold) AS low_stock_parts,
            COALESCE(SUM(wp.quantity), 0) AS total_stock_units,
            u.email
        FROM warehouses w
        JOIN users u ON u.id = w.user_id
        LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
        WHERE w.is_active = TRUE
          {approval_filter}
          {search_filter}
        GROUP BY w.id, u.email
        ORDER BY available_parts DESC, w.name ASC
    """.format(approval_filter=approval_filter, warehouse_selects=warehouse_selects, search_filter=search_filter)
    result = await db.execute(text(sql), params)
    return [
        WarehouseSummaryOut(**row, average_shipping_time="Varies by stocked part")
        for row in result.mappings().all()
    ]


@router.get("/marketplace/parts", response_model=list[WarehousePartOut])
async def search_marketplace_parts(
    query: str = Query(..., min_length=2),
    warehouse_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    await _get_mechanic_profile_id(db, current_user.id)
    warehouse_columns = await _warehouse_column_map(db)
    warehouse_part_columns = await _warehouse_part_column_map(db)
    approval_filter = "AND w.approval_status = 'approved'" if warehouse_columns.get("approval_status") else ""
    warehouse_part_selects = _warehouse_part_select_columns(warehouse_part_columns)
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
            {warehouse_part_selects},
            (wp.quantity <= wp.min_threshold) AS is_low_stock,
            wp.created_at,
            wp.updated_at
        FROM warehouse_parts wp
        JOIN warehouses w ON w.id = wp.warehouse_id
        WHERE w.is_active = TRUE
          {approval_filter}
          AND wp.quantity > 0
          AND (:warehouse_id IS NULL OR wp.warehouse_id = CAST(:warehouse_id AS UUID))
          AND (
            wp.part_name ILIKE :like_query
            OR COALESCE(wp.part_number, '') ILIKE :like_query
            OR COALESCE(wp.manufacturer, '') ILIKE :like_query
        )
        ORDER BY wp.quantity DESC, wp.part_name ASC
    """.format(approval_filter=approval_filter, warehouse_part_selects=warehouse_part_selects)
    result = await db.execute(text(sql), {"warehouse_id": warehouse_id, "like_query": f"%{query.strip()}%"})
    return [WarehousePartOut(**row) for row in result.mappings().all()]


@router.get("/marketplace/{warehouse_id}", response_model=WarehouseDetailOut)
async def get_marketplace_warehouse_detail(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    await _get_mechanic_profile_id(db, current_user.id)
    warehouse_columns = await _warehouse_column_map(db)
    warehouse_part_columns = await _warehouse_part_column_map(db)
    approval_filter = "AND w.approval_status = 'approved'" if warehouse_columns.get("approval_status") else ""
    warehouse_selects = _warehouse_select_columns(warehouse_columns)
    warehouse_part_selects = _warehouse_part_select_columns(warehouse_part_columns)
    warehouse_result = await db.execute(
        text(
            """
            SELECT
                w.id::text,
                w.user_id::text,
                w.name,
                w.address,
                {warehouse_selects},
                w.is_active,
                COUNT(wp.id) FILTER (WHERE wp.quantity > 0) AS available_parts,
                COUNT(wp.id) FILTER (WHERE wp.quantity <= wp.min_threshold) AS low_stock_parts,
                COALESCE(SUM(wp.quantity), 0) AS total_stock_units,
                u.email
            FROM warehouses w
            JOIN users u ON u.id = w.user_id
            LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
            WHERE w.id = CAST(:warehouse_id AS UUID)
              AND w.is_active = TRUE
              {approval_filter}
            GROUP BY w.id, u.email
            """.format(approval_filter=approval_filter, warehouse_selects=warehouse_selects)
        ),
        {"warehouse_id": warehouse_id},
    )
    warehouse = warehouse_result.mappings().first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    inventory_result = await db.execute(
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
                {warehouse_part_selects},
                (wp.quantity <= wp.min_threshold) AS is_low_stock,
                wp.created_at,
                wp.updated_at
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.warehouse_id = CAST(:warehouse_id AS UUID)
            ORDER BY wp.quantity DESC, wp.part_name ASC
            """.format(warehouse_part_selects=warehouse_part_selects)
        ),
        {"warehouse_id": warehouse_id},
    )
    inventory = [WarehousePartOut(**row) for row in inventory_result.mappings().all()]

    shipping_labels = [item.lead_time_label for item in inventory if item.lead_time_label]
    average_shipping_time = shipping_labels[0] if shipping_labels else "Varies by stocked part"
    return WarehouseDetailOut(
        **warehouse,
        average_shipping_time=average_shipping_time,
        inventory=inventory,
    )


@router.get("/me", response_model=WarehouseSummaryOut)
async def get_my_warehouse(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    warehouse_columns = await _warehouse_column_map(db)
    warehouse_selects = _warehouse_select_columns(warehouse_columns)
    result = await db.execute(
        text(
            """
            SELECT
                w.id::text,
                w.user_id::text,
                w.name,
                w.address,
                {warehouse_selects},
                w.is_active,
                COUNT(wp.id) FILTER (WHERE wp.quantity > 0) AS available_parts,
                COUNT(wp.id) FILTER (WHERE wp.quantity <= wp.min_threshold) AS low_stock_parts,
                COALESCE(SUM(wp.quantity), 0) AS total_stock_units
            FROM warehouses w
            LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
            WHERE w.id = CAST(:warehouse_id AS UUID)
            GROUP BY w.id
            """.format(warehouse_selects=warehouse_selects)
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
    warehouse_part_columns = await _warehouse_part_column_map(db)
    warehouse_part_selects = _warehouse_part_select_columns(warehouse_part_columns)
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
                {warehouse_part_selects},
                (wp.quantity <= wp.min_threshold) AS is_low_stock,
                wp.created_at,
                wp.updated_at
            FROM warehouse_parts wp
            JOIN warehouses w ON w.id = wp.warehouse_id
            WHERE wp.warehouse_id = CAST(:warehouse_id AS UUID)
            ORDER BY wp.part_name ASC
            """.format(warehouse_part_selects=warehouse_part_selects)
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


@router.get("/orders", response_model=list[WarehouseOrderGroupOut])
async def get_warehouse_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        sql = """
            WITH order_lines AS (
                SELECT
                    COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) AS order_ref,
                    wo.warehouse_id,
                    wo.mechanic_id,
                    wo.status,
                    wo.quantity,
                    wo.total_price,
                    wo.note,
                    wo.created_at,
                    wo.updated_at
                FROM warehouse_orders wo
                WHERE wo.mechanic_id = CAST(:profile_id AS UUID)
            )
            SELECT
                ol.order_ref,
                ol.warehouse_id::text,
                w.name AS warehouse_name,
                ol.mechanic_id::text,
                mu.name AS mechanic_name,
                MIN(CASE WHEN ol.status::text = 'confirmed' THEN 'accepted' ELSE ol.status::text END) AS status,
                COUNT(*) AS line_count,
                COALESCE(SUM(ol.quantity), 0) AS total_quantity,
                CAST(COALESCE(SUM(ol.total_price), 0) AS FLOAT) AS total_price,
                MAX(ol.note) AS note,
                MIN(ol.created_at) AS created_at,
                MAX(ol.updated_at) AS updated_at
            FROM order_lines ol
            JOIN warehouses w ON w.id = ol.warehouse_id
            JOIN mechanics m ON m.id = ol.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            GROUP BY ol.order_ref, ol.warehouse_id, w.name, ol.mechanic_id, mu.name
            ORDER BY MIN(ol.created_at) DESC
        """
        profile_id = await _get_mechanic_profile_id(db, current_user.id)
    else:
        sql = """
            WITH order_lines AS (
                SELECT
                    COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) AS order_ref,
                    wo.warehouse_id,
                    wo.mechanic_id,
                    wo.status,
                    wo.quantity,
                    wo.total_price,
                    wo.note,
                    wo.created_at,
                    wo.updated_at
                FROM warehouse_orders wo
                WHERE wo.warehouse_id = CAST(:profile_id AS UUID)
            )
            SELECT
                ol.order_ref,
                ol.warehouse_id::text,
                w.name AS warehouse_name,
                ol.mechanic_id::text,
                mu.name AS mechanic_name,
                MIN(CASE WHEN ol.status::text = 'confirmed' THEN 'accepted' ELSE ol.status::text END) AS status,
                COUNT(*) AS line_count,
                COALESCE(SUM(ol.quantity), 0) AS total_quantity,
                CAST(COALESCE(SUM(ol.total_price), 0) AS FLOAT) AS total_price,
                MAX(ol.note) AS note,
                MIN(ol.created_at) AS created_at,
                MAX(ol.updated_at) AS updated_at
            FROM order_lines ol
            JOIN warehouses w ON w.id = ol.warehouse_id
            JOIN mechanics m ON m.id = ol.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            GROUP BY ol.order_ref, ol.warehouse_id, w.name, ol.mechanic_id, mu.name
            ORDER BY MIN(ol.created_at) DESC
        """
        profile_id = await _get_warehouse_profile_id(db, current_user.id)

    result = await db.execute(text(sql), {"profile_id": profile_id})
    return [WarehouseOrderGroupOut(**row) for row in result.mappings().all()]


@router.get("/orders/{order_ref}", response_model=WarehouseOrderDetailOut)
async def get_warehouse_order_detail(
    order_ref: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic", "warehouse")),
):
    if current_user.role == "mechanic":
        profile_id = await _get_mechanic_profile_id(db, current_user.id)
        visibility_clause = "wo.mechanic_id = CAST(:profile_id AS UUID)"
    else:
        profile_id = await _get_warehouse_profile_id(db, current_user.id)
        visibility_clause = "wo.warehouse_id = CAST(:profile_id AS UUID)"

    summary_result = await db.execute(
        text(
            f"""
            WITH order_lines AS (
                SELECT
                    COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) AS order_ref,
                    wo.warehouse_id,
                    wo.mechanic_id,
                    wo.status,
                    wo.quantity,
                    wo.total_price,
                    wo.note,
                    wo.created_at,
                    wo.updated_at
                FROM warehouse_orders wo
                WHERE COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) = :order_ref
                  AND {visibility_clause}
            )
            SELECT
                ol.order_ref,
                ol.warehouse_id::text,
                w.name AS warehouse_name,
                ol.mechanic_id::text,
                mu.name AS mechanic_name,
                MIN(CASE WHEN ol.status::text = 'confirmed' THEN 'accepted' ELSE ol.status::text END) AS status,
                COUNT(*) AS line_count,
                COALESCE(SUM(ol.quantity), 0) AS total_quantity,
                CAST(COALESCE(SUM(ol.total_price), 0) AS FLOAT) AS total_price,
                MAX(ol.note) AS note,
                MIN(ol.created_at) AS created_at,
                MAX(ol.updated_at) AS updated_at
            FROM order_lines ol
            JOIN warehouses w ON w.id = ol.warehouse_id
            JOIN mechanics m ON m.id = ol.mechanic_id
            JOIN users mu ON mu.id = m.user_id
            GROUP BY ol.order_ref, ol.warehouse_id, w.name, ol.mechanic_id, mu.name
            """
        ),
        {"order_ref": order_ref, "profile_id": profile_id},
    )
    summary = summary_result.mappings().first()
    if not summary:
        raise HTTPException(status_code=404, detail="Order not found")

    items_result = await db.execute(
        text(
            f"""
            SELECT
                wo.id::text,
                COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) AS order_ref,
                wo.warehouse_part_id::text AS warehouse_part_id,
                wp.part_name,
                wp.part_number,
                wp.manufacturer,
                wp.lead_time_label,
                wo.quantity,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                CAST(wo.total_price AS FLOAT) AS total_price,
                CASE WHEN wo.status::text = 'confirmed' THEN 'accepted' ELSE wo.status::text END AS status
            FROM warehouse_orders wo
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) = :order_ref
              AND {visibility_clause}
            ORDER BY wp.part_name ASC, wo.created_at ASC
            """
        ),
        {"order_ref": order_ref, "profile_id": profile_id},
    )
    items = [WarehouseOrderLineOut(**row) for row in items_result.mappings().all()]
    return WarehouseOrderDetailOut(**summary, items=items)


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
                CASE WHEN wo.status::text = 'confirmed' THEN 'accepted' ELSE wo.status::text END AS status,
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


@router.post("/orders/group", response_model=WarehouseOrderDetailOut, status_code=201)
async def create_warehouse_order_group(
    payload: WarehouseOrderGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mechanic_id = await _get_mechanic_profile_id(db, current_user.id)
    if not payload.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    order_ref = _build_order_ref()
    order_rows: list[dict] = []
    total_quantity = 0
    total_price = 0.0

    for item in payload.items:
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
                    wp.manufacturer,
                    wp.lead_time_label,
                    w.name AS warehouse_name
                FROM warehouse_parts wp
                JOIN warehouses w ON w.id = wp.warehouse_id
                WHERE wp.id = CAST(:part_id AS UUID)
                  AND wp.warehouse_id = CAST(:warehouse_id AS UUID)
                  AND w.is_active = TRUE
                  AND w.approval_status = 'approved'
                """
            ),
            {"part_id": item.warehouse_part_id, "warehouse_id": payload.warehouse_id},
        )
        part = part_result.mappings().first()
        if not part:
            raise HTTPException(status_code=404, detail="Warehouse part not found")
        if int(part["quantity"]) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Requested quantity exceeds stock for {part['part_name']}")

        line_total = round(float(part["price"]) * item.quantity, 2)
        order_id = str(uuid4())
        await db.execute(
            text(
                """
                INSERT INTO warehouse_orders (
                    id, order_ref, warehouse_id, mechanic_id, warehouse_part_id, quantity, status,
                    unit_price, total_price, note, inventory_deducted, inventory_received
                )
                VALUES (
                    :id, :order_ref, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID),
                    CAST(:warehouse_part_id AS UUID), :quantity, 'requested', :unit_price, :total_price,
                    :note, FALSE, FALSE
                )
                """
            ),
            {
                "id": order_id,
                "order_ref": order_ref,
                "warehouse_id": payload.warehouse_id,
                "mechanic_id": mechanic_id,
                "warehouse_part_id": item.warehouse_part_id,
                "quantity": item.quantity,
                "unit_price": part["price"],
                "total_price": line_total,
                "note": payload.note,
            },
        )
        order_rows.append(
            {
                "id": order_id,
                "order_ref": order_ref,
                "warehouse_part_id": item.warehouse_part_id,
                "part_name": part["part_name"],
                "part_number": part["part_number"],
                "manufacturer": part["manufacturer"],
                "lead_time_label": part["lead_time_label"],
                "quantity": item.quantity,
                "unit_price": float(part["price"]),
                "total_price": line_total,
                "status": "requested",
            }
        )
        total_quantity += item.quantity
        total_price += line_total

    if payload.note:
        await db.execute(
            text(
                """
                INSERT INTO warehouse_messages (
                    id, warehouse_id, mechanic_id, warehouse_order_id, sender_user_id, sender_role, message
                )
                VALUES (
                    :id, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID), NULL,
                    CAST(:sender_user_id AS UUID), 'mechanic', :message
                )
                """
            ),
            {
                "id": str(uuid4()),
                "warehouse_id": payload.warehouse_id,
                "mechanic_id": mechanic_id,
                "sender_user_id": current_user.id,
                "message": payload.note,
            },
        )

    await db.commit()

    warehouse_result = await db.execute(
        text(
            """
            SELECT
                w.id::text AS warehouse_id,
                w.name AS warehouse_name,
                m.id::text AS mechanic_id,
                u.name AS mechanic_name
            FROM warehouses w
            JOIN mechanics m ON m.id = CAST(:mechanic_id AS UUID)
            JOIN users u ON u.id = m.user_id
            WHERE w.id = CAST(:warehouse_id AS UUID)
            """
        ),
        {"warehouse_id": payload.warehouse_id, "mechanic_id": mechanic_id},
    )
    meta = warehouse_result.mappings().first()
    return WarehouseOrderDetailOut(
        order_ref=order_ref,
        warehouse_id=meta["warehouse_id"],
        warehouse_name=meta["warehouse_name"],
        mechanic_id=meta["mechanic_id"],
        mechanic_name=meta["mechanic_name"],
        status="requested",
        line_count=len(order_rows),
        total_quantity=total_quantity,
        total_price=round(total_price, 2),
        note=payload.note,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        items=[WarehouseOrderLineOut(**row) for row in order_rows],
    )


@router.patch("/orders/group/{order_ref}", response_model=WarehouseOrderDetailOut)
async def update_warehouse_order_group(
    order_ref: str,
    payload: WarehouseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("warehouse")),
):
    warehouse_id = await _get_warehouse_profile_id(db, current_user.id)
    next_status = _normalize_order_status(payload.status)
    if not next_status and payload.unit_price is None and payload.note is None:
        raise HTTPException(status_code=400, detail="No updates provided")

    rows_result = await db.execute(
        text(
            """
            SELECT
                wo.id::text,
                wo.mechanic_id::text AS mechanic_id,
                wo.warehouse_part_id::text AS warehouse_part_id,
                wo.quantity,
                CASE WHEN wo.status::text = 'confirmed' THEN 'accepted' ELSE wo.status::text END AS status,
                wo.inventory_deducted,
                wo.inventory_received,
                CAST(wo.unit_price AS FLOAT) AS unit_price,
                wp.part_name,
                wp.part_number,
                COALESCE(wp.compatible_vehicles::text[], '{}') AS compatible_vehicles
            FROM warehouse_orders wo
            LEFT JOIN warehouse_parts wp ON wp.id = wo.warehouse_part_id
            WHERE wo.warehouse_id = CAST(:warehouse_id AS UUID)
              AND COALESCE(wo.order_ref, 'WO-' || UPPER(SUBSTRING(wo.id::text, 1, 8))) = :order_ref
            ORDER BY wo.created_at ASC
            """
        ),
        {"warehouse_id": warehouse_id, "order_ref": order_ref},
    )
    rows = rows_result.mappings().all()
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")

    should_deduct_inventory = next_status in {
        "accepted",
        "packed",
        "awaiting_shipping",
        "shipped",
        "out_for_delivery",
        "delivered",
    }

    if should_deduct_inventory:
        for row in rows:
            if row["inventory_deducted"] or not row["warehouse_part_id"]:
                continue
            stock_result = await db.execute(
                text(
                    """
                    SELECT quantity
                    FROM warehouse_parts
                    WHERE id = CAST(:part_id AS UUID)
                      AND warehouse_id = CAST(:warehouse_id AS UUID)
                    """
                ),
                {"part_id": row["warehouse_part_id"], "warehouse_id": warehouse_id},
            )
            available = stock_result.scalar_one_or_none()
            if available is None:
                raise HTTPException(status_code=400, detail=f"Inventory source missing for {row['part_name'] or 'a line item'}")
            if int(available) < int(row["quantity"]):
                raise HTTPException(status_code=400, detail=f"Not enough stock left for {row['part_name'] or 'a line item'}")
            await db.execute(
                text(
                    """
                    UPDATE warehouse_parts
                    SET quantity = quantity - :quantity,
                        updated_at = NOW()
                    WHERE id = CAST(:part_id AS UUID)
                      AND warehouse_id = CAST(:warehouse_id AS UUID)
                    """
                ),
                {"part_id": row["warehouse_part_id"], "warehouse_id": warehouse_id, "quantity": row["quantity"]},
            )

    updates = payload.model_dump(exclude_none=True)
    if next_status:
        updates["status"] = next_status
    if "unit_price" in updates:
        updates["total_price_sql"] = True

    set_clauses: list[str] = []
    params: dict[str, object] = {"warehouse_id": warehouse_id, "order_ref": order_ref}

    if "status" in updates:
        set_clauses.append("status = :status")
        params["status"] = updates["status"]
    if "unit_price" in updates:
        set_clauses.append("unit_price = :unit_price")
        set_clauses.append("total_price = :unit_price * quantity")
        params["unit_price"] = updates["unit_price"]
    if "note" in updates:
        set_clauses.append("note = :note")
        params["note"] = updates["note"]
    if should_deduct_inventory:
        set_clauses.append("inventory_deducted = TRUE")
    if next_status == "delivered":
        set_clauses.append("inventory_received = TRUE")
    set_clauses.append("updated_at = NOW()")

    await db.execute(
        text(
            f"""
            UPDATE warehouse_orders
            SET {", ".join(set_clauses)}
            WHERE warehouse_id = CAST(:warehouse_id AS UUID)
              AND COALESCE(order_ref, 'WO-' || UPPER(SUBSTRING(id::text, 1, 8))) = :order_ref
            """
        ),
        params,
    )

    if next_status == "delivered":
        for row in rows:
            if row["inventory_received"]:
                continue
            existing_result = await db.execute(
                text(
                    """
                    SELECT id::text, quantity
                    FROM spare_parts
                    WHERE mechanic_id = CAST(:mechanic_id AS UUID)
                      AND LOWER(part_name) = LOWER(:part_name)
                      AND COALESCE(LOWER(part_number), '') = COALESCE(LOWER(:part_number), '')
                    LIMIT 1
                    """
                ),
                {
                    "mechanic_id": row["mechanic_id"],
                    "part_name": row["part_name"] or "Warehouse item",
                    "part_number": row["part_number"],
                },
            )
            existing = existing_result.mappings().first()
            if existing:
                await db.execute(
                    text(
                        """
                        UPDATE spare_parts
                        SET quantity = quantity + :quantity,
                            price = COALESCE(:price, price),
                            updated_at = NOW()
                        WHERE id = CAST(:part_id AS UUID)
                        """
                    ),
                    {
                        "part_id": existing["id"],
                        "quantity": row["quantity"],
                        "price": row["unit_price"],
                    },
                )
            else:
                await db.execute(
                    text(
                        """
                        INSERT INTO spare_parts (
                            id, mechanic_id, part_name, part_number, quantity, min_threshold, price, compatible_vehicles
                        )
                        VALUES (
                            :id, CAST(:mechanic_id AS UUID), :part_name, :part_number, :quantity, 2, :price,
                            CAST(:compatible_vehicles AS vehicle_type[])
                        )
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "mechanic_id": row["mechanic_id"],
                        "part_name": row["part_name"] or "Warehouse item",
                        "part_number": row["part_number"],
                        "quantity": row["quantity"],
                        "price": row["unit_price"] or 0,
                        "compatible_vehicles": row["compatible_vehicles"],
                    },
                )

    if next_status:
        await db.execute(
            text(
                """
                INSERT INTO warehouse_messages (
                    id, warehouse_id, mechanic_id, warehouse_order_id, sender_user_id, sender_role, message
                )
                VALUES (
                    :id, CAST(:warehouse_id AS UUID), CAST(:mechanic_id AS UUID), NULL,
                    CAST(:sender_user_id AS UUID), 'warehouse', :message
                )
                """
            ),
            {
                "id": str(uuid4()),
                "warehouse_id": warehouse_id,
                "mechanic_id": rows[0]["mechanic_id"],
                "sender_user_id": current_user.id,
                "message": f"Order {order_ref} updated to {next_status.replace('_', ' ')}.",
            },
        )

    await db.commit()
    return await get_warehouse_order_detail(order_ref=order_ref, db=db, current_user=current_user)


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


@router.delete("/messages/thread")
async def delete_warehouse_thread(
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
            DELETE FROM warehouse_messages
            WHERE warehouse_id = CAST(:warehouse_id AS UUID)
              AND mechanic_id = CAST(:mechanic_id AS UUID)
            """
        ),
        params,
    )
    await db.commit()
    return {"detail": "Conversation deleted", "deleted_count": result.rowcount or 0}
