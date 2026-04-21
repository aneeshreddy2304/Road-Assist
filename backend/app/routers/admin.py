import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.email import send_email
from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.models.warehouse import Warehouse
from app.core.security import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


def _normalize_lookup_query(value: str) -> str:
    return (value or "").strip().upper()


def _window_clause(column: str, range_key: str) -> str:
    windows = {
        "day": f"{column} >= NOW() - INTERVAL '1 day'",
        "week": f"{column} >= NOW() - INTERVAL '7 days'",
        "month": f"{column} >= NOW() - INTERVAL '30 days'",
        "year": f"{column} >= NOW() - INTERVAL '365 days'",
        "all": "TRUE",
    }
    return windows.get(range_key, windows["week"])


def _bucket_expression(column: str, range_key: str) -> tuple[str, str]:
    if range_key == "day":
        return f"date_trunc('hour', {column})", "HH24:00"
    if range_key in {"week", "month"}:
        return f"date_trunc('day', {column})", "Mon DD"
    if range_key == "year":
        return f"date_trunc('month', {column})", "Mon YYYY"
    return f"date_trunc('month', {column})", "Mon YYYY"


@router.get("/analytics")
async def get_analytics(
    range_key: str = Query(default="week", alias="range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    request_window = _window_clause("sr.created_at", range_key)
    completion_window = _window_clause("rt.completed_at", range_key)
    appointment_window = _window_clause("scheduled_for", range_key)
    volume_bucket, volume_label = _bucket_expression("sr.created_at", range_key)
    earnings_bucket, earnings_label = _bucket_expression("rt.completed_at", range_key)

    summary = await db.execute(text(f"""
        WITH request_times AS (
            SELECT
                sr.id,
                sr.status,
                sr.created_at,
                sr.total_cost,
                MIN(ju.created_at) FILTER (WHERE ju.status = 'accepted') AS accepted_at,
                MIN(ju.created_at) FILTER (WHERE ju.status = 'completed') AS completed_at
            FROM service_requests sr
            LEFT JOIN job_updates ju ON ju.request_id = sr.id
            WHERE {request_window}
            GROUP BY sr.id, sr.status, sr.created_at, sr.total_cost
        )
        SELECT
            COUNT(*) AS total_requests,
            COUNT(*) FILTER (WHERE status = 'requested') AS requested,
            COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE status IN ('requested','accepted','in_progress')) AS active,
            COALESCE(SUM(total_cost) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
            ROUND(AVG(total_cost) FILTER (WHERE status = 'completed'), 2) AS avg_job_value,
            ROUND(
                AVG(
                    GREATEST(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 3600, 0)
                ) FILTER (WHERE accepted_at IS NOT NULL),
                2
            ) AS avg_response_hours,
            ROUND(
                AVG(
                    GREATEST(EXTRACT(EPOCH FROM (completed_at - accepted_at)) / 3600, 0)
                ) FILTER (WHERE accepted_at IS NOT NULL AND completed_at IS NOT NULL),
                2
            ) AS avg_completion_hours
        FROM request_times
    """))
    stats = dict(summary.mappings().first())

    top_parts = await db.execute(text("""
        SELECT sp.part_name, SUM(srp.quantity_used) AS times_used
        FROM service_request_parts srp
        JOIN spare_parts sp ON sp.id = srp.part_id
        GROUP BY sp.part_name
        ORDER BY times_used DESC
        LIMIT 10
    """))

    users_by_role = await db.execute(text("""
        SELECT role, COUNT(*) AS count FROM users GROUP BY role
    """))

    mechanics_online = await db.execute(text("""
        SELECT COUNT(*) AS count
        FROM mechanics
        WHERE is_available = TRUE
    """))

    funnel = {
        "requested": int(stats.get("requested") or 0),
        "accepted": int(stats.get("accepted") or 0),
        "in_progress": int(stats.get("in_progress") or 0),
        "completed": int(stats.get("completed") or 0),
    }

    earnings_trend = await db.execute(text(f"""
        WITH request_times AS (
            SELECT
                sr.id,
                sr.total_cost,
                MIN(ju.created_at) FILTER (WHERE ju.status = 'completed') AS completed_at
            FROM service_requests sr
            LEFT JOIN job_updates ju ON ju.request_id = sr.id
            GROUP BY sr.id, sr.total_cost
        )
        SELECT
            TO_CHAR({earnings_bucket}, '{earnings_label}') AS label,
            COALESCE(SUM(rt.total_cost), 0) AS revenue
        FROM request_times rt
        WHERE rt.completed_at IS NOT NULL
          AND {completion_window}
        GROUP BY 1, {earnings_bucket}
        ORDER BY {earnings_bucket}
    """))

    request_volume = await db.execute(text(f"""
        SELECT
            TO_CHAR({volume_bucket}, '{volume_label}') AS label,
            COUNT(*) AS total
        FROM service_requests sr
        WHERE {request_window}
        GROUP BY 1, {volume_bucket}
        ORDER BY {volume_bucket}
    """))

    leaderboard = await db.execute(text(f"""
        WITH request_times AS (
            SELECT
                sr.id,
                sr.mechanic_id,
                sr.total_cost,
                MIN(ju.created_at) FILTER (WHERE ju.status = 'completed') AS completed_at
            FROM service_requests sr
            LEFT JOIN job_updates ju ON ju.request_id = sr.id
            WHERE sr.mechanic_id IS NOT NULL
            GROUP BY sr.id, sr.mechanic_id, sr.total_cost
        )
        SELECT
            m.id,
            u.name,
            CAST(m.rating AS FLOAT) AS rating,
            m.is_available,
            COUNT(rt.id) FILTER (WHERE rt.completed_at IS NOT NULL AND {completion_window.replace('rt.completed_at', 'completed_at')}) AS completed_jobs,
            COALESCE(SUM(rt.total_cost) FILTER (WHERE rt.completed_at IS NOT NULL AND {completion_window.replace('rt.completed_at', 'completed_at')}), 0) AS revenue
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN request_times rt ON rt.mechanic_id = m.id
        GROUP BY m.id, u.name, m.rating, m.is_available
        ORDER BY completed_jobs DESC, revenue DESC, rating DESC
        LIMIT 8
    """))

    low_stock = await db.execute(text("""
        SELECT
            sp.id,
            sp.part_name,
            sp.quantity,
            u.name AS mechanic_name,
            m.address,
            CASE
                WHEN sp.quantity = 0 THEN 'out'
                WHEN sp.quantity <= 2 THEN 'critical'
                ELSE 'warning'
            END AS severity
        FROM spare_parts sp
        JOIN mechanics m ON m.id = sp.mechanic_id
        JOIN users u ON u.id = m.user_id
        WHERE sp.quantity < 4
        ORDER BY sp.quantity ASC, u.name ASC, sp.part_name ASC
        LIMIT 20
    """))

    appointments_summary = await db.execute(text(f"""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'requested') AS requested,
            COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
        FROM appointments
        WHERE {appointment_window}
    """))

    appointments_calendar = await db.execute(text(f"""
        SELECT
            a.id,
            CONCAT('AP-', UPPER(SUBSTRING(a.id::TEXT, 1, 8))) AS appointment_ref,
            a.status,
            a.service_type,
            a.scheduled_for,
            owner.name AS owner_name,
            mechanic_user.name AS mechanic_name
        FROM appointments a
        JOIN users owner ON owner.id = a.owner_id
        JOIN mechanics m ON m.id = a.mechanic_id
        JOIN users mechanic_user ON mechanic_user.id = m.user_id
        WHERE {appointment_window}
        ORDER BY a.scheduled_for ASC
        LIMIT 10
    """))

    appointments_summary_views = await db.execute(text("""
        SELECT
            'this_month' AS view_key,
            TO_CHAR(date_trunc('month', NOW()), 'Mon YYYY') AS label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'requested') AS requested,
            COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
        FROM appointments
        WHERE scheduled_for >= date_trunc('month', NOW())
          AND scheduled_for < date_trunc('month', NOW()) + INTERVAL '1 month'

        UNION ALL

        SELECT
            'last_month' AS view_key,
            TO_CHAR(date_trunc('month', NOW()) - INTERVAL '1 month', 'Mon YYYY') AS label,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'requested') AS requested,
            COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
        FROM appointments
        WHERE scheduled_for >= date_trunc('month', NOW()) - INTERVAL '1 month'
          AND scheduled_for < date_trunc('month', NOW())
    """))

    appointments_calendar_views_result = await db.execute(text("""
        SELECT
            'this_month' AS view_key,
            a.id,
            CONCAT('AP-', UPPER(SUBSTRING(a.id::TEXT, 1, 8))) AS appointment_ref,
            a.status,
            a.service_type,
            a.scheduled_for,
            owner.name AS owner_name,
            mechanic_user.name AS mechanic_name
        FROM appointments a
        JOIN users owner ON owner.id = a.owner_id
        JOIN mechanics m ON m.id = a.mechanic_id
        JOIN users mechanic_user ON mechanic_user.id = m.user_id
        WHERE a.scheduled_for >= date_trunc('month', NOW())
          AND a.scheduled_for < date_trunc('month', NOW()) + INTERVAL '1 month'

        UNION ALL

        SELECT
            'last_month' AS view_key,
            a.id,
            CONCAT('AP-', UPPER(SUBSTRING(a.id::TEXT, 1, 8))) AS appointment_ref,
            a.status,
            a.service_type,
            a.scheduled_for,
            owner.name AS owner_name,
            mechanic_user.name AS mechanic_name
        FROM appointments a
        JOIN users owner ON owner.id = a.owner_id
        JOIN mechanics m ON m.id = a.mechanic_id
        JOIN users mechanic_user ON mechanic_user.id = m.user_id
        WHERE a.scheduled_for >= date_trunc('month', NOW()) - INTERVAL '1 month'
          AND a.scheduled_for < date_trunc('month', NOW())
        ORDER BY scheduled_for ASC
    """))

    unresolved_alerts = await db.execute(text("""
        SELECT
            a.id,
            a.alert_type,
            a.message,
            a.created_at,
            u.name AS mechanic_name,
            COALESCE(sp.part_name, 'System') AS part_name
        FROM alerts a
        JOIN mechanics m ON m.id = a.mechanic_id
        JOIN users u ON u.id = m.user_id
        LEFT JOIN spare_parts sp ON sp.id = a.part_id
        WHERE a.is_resolved = FALSE
        ORDER BY a.created_at DESC
        LIMIT 12
    """))

    latest_requests = await db.execute(text(f"""
        SELECT
            sr.id,
            CONCAT('RA-', UPPER(SUBSTRING(sr.id::TEXT, 1, 8))) AS request_ref,
            sr.status,
            sr.problem_desc,
            sr.total_cost,
            sr.estimated_cost,
            sr.created_at,
            owner.name AS owner_name,
            COALESCE(mech_user.name, 'Unassigned') AS mechanic_name
        FROM service_requests sr
        JOIN users owner ON owner.id = sr.owner_id
        LEFT JOIN mechanics m ON m.id = sr.mechanic_id
        LEFT JOIN users mech_user ON mech_user.id = m.user_id
        WHERE {request_window}
        ORDER BY sr.created_at DESC
        LIMIT 12
    """))

    appointment_summary_views_map = {
        row["view_key"]: dict(row)
        for row in appointments_summary_views.mappings().all()
    }
    appointment_calendar_views_map = {"this_month": [], "last_month": []}
    for row in appointments_calendar_views_result.mappings().all():
        item = dict(row)
        view_key = item.pop("view_key")
        appointment_calendar_views_map.setdefault(view_key, []).append(item)

    return {
        "summary": stats,
        "filters": {"range": range_key},
        "funnel": funnel,
        "earnings_trend": [dict(r) for r in earnings_trend.mappings().all()],
        "request_volume": [dict(r) for r in request_volume.mappings().all()],
        "leaderboard": [dict(r) for r in leaderboard.mappings().all()],
        "low_stock": [dict(r) for r in low_stock.mappings().all()],
        "appointments_summary": dict(appointments_summary.mappings().first()),
        "appointments_calendar": [dict(r) for r in appointments_calendar.mappings().all()],
        "appointments_summary_views": appointment_summary_views_map,
        "appointments_calendar_views": appointment_calendar_views_map,
        "unresolved_alerts": [dict(r) for r in unresolved_alerts.mappings().all()],
        "latest_requests": [dict(r) for r in latest_requests.mappings().all()],
        "mechanics_online": int((mechanics_online.mappings().first() or {}).get("count") or 0),
        "top_parts": [dict(r) for r in top_parts.mappings().all()],
        "users_by_role": {r["role"]: r["count"] for r in users_by_role.mappings().all()},
    }


@router.get("/mechanics")
async def list_all_mechanics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(text("""
        SELECT m.id, u.id AS user_id, u.name, u.email, u.phone,
               u.gender, u.street_address, u.city, u.state, u.postal_code, u.is_active,
               m.specialization, m.work_hours, m.vehicle_types, m.approval_status, m.is_available,
               CAST(m.rating AS FLOAT) AS rating,
               m.total_reviews, m.address, m.created_at,
               ST_Y(m.location::geometry) AS lat,
               ST_X(m.location::geometry) AS lng
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        ORDER BY CASE WHEN m.approval_status = 'pending' THEN 0 ELSE 1 END, m.created_at DESC
    """))
    return [dict(r) for r in result.mappings().all()]


@router.get("/warehouses")
async def list_all_warehouses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(text("""
        SELECT
            w.id,
            u.id AS user_id,
            u.name,
            u.email,
            u.phone,
            u.gender,
            u.street_address,
            u.city,
            u.state,
            u.postal_code,
            u.is_active,
            w.name AS warehouse_name,
            w.address,
            CAST(w.lat AS FLOAT) AS lat,
            CAST(w.lng AS FLOAT) AS lng,
            w.contact_phone,
            w.description,
            w.fulfillment_hours,
            w.approval_status,
            w.is_active AS warehouse_active,
            w.created_at,
            COUNT(wp.id) AS inventory_items
        FROM warehouses w
        JOIN users u ON u.id = w.user_id
        LEFT JOIN warehouse_parts wp ON wp.warehouse_id = w.id
        GROUP BY
            w.id, u.id, u.name, u.email, u.phone, u.gender, u.street_address, u.city, u.state, u.postal_code, u.is_active,
            w.name, w.address, w.lat, w.lng, w.contact_phone, w.description, w.fulfillment_hours, w.approval_status, w.is_active, w.created_at
        ORDER BY CASE WHEN w.approval_status = 'pending' THEN 0 ELSE 1 END, w.created_at DESC
    """))
    return [dict(r) for r in result.mappings().all()]


@router.patch("/mechanics/{mechanic_id}/approve", status_code=200)
async def approve_mechanic_registration(
    mechanic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        text(
            """
            SELECT m.id, m.user_id, u.name, u.email
            FROM mechanics m
            JOIN users u ON u.id = m.user_id
            WHERE m.id = :mid
            """
        ),
        {"mid": mechanic_id},
    )
    mechanic = result.mappings().first()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    await db.execute(
        text(
            """
            UPDATE mechanics
            SET approval_status = 'approved', is_available = TRUE
            WHERE id = :mid
            """
        ),
        {"mid": mechanic_id},
    )
    await db.commit()

    email_sent = await asyncio.to_thread(
        send_email,
        mechanic["email"],
        "RoadAssist mechanic registration approved",
        (
            f"Hello {mechanic['name']},\n\n"
            "Your mechanic registration for RoadAssist has been approved. "
            "You can now sign in with the email address and password you registered with.\n\n"
            "Thanks,\nRoadAssist Admin"
        ),
    )
    return {"detail": "Mechanic approved", "email_sent": email_sent}


@router.patch("/warehouses/{warehouse_id}/approve", status_code=200)
async def approve_warehouse_registration(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        text(
            """
            SELECT w.id, w.user_id, w.name AS warehouse_name, u.name, u.email
            FROM warehouses w
            JOIN users u ON u.id = w.user_id
            WHERE w.id = :wid
            """
        ),
        {"wid": warehouse_id},
    )
    warehouse = result.mappings().first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    await db.execute(
        text(
            """
            UPDATE warehouses
            SET approval_status = 'approved', is_active = TRUE
            WHERE id = :wid
            """
        ),
        {"wid": warehouse_id},
    )
    await db.commit()

    email_sent = await asyncio.to_thread(
        send_email,
        warehouse["email"],
        "RoadAssist warehouse registration approved",
        (
            f"Hello {warehouse['name']},\n\n"
            f"Your warehouse registration for {warehouse['warehouse_name']} has been approved. "
            "You can now sign in with the email address and password you registered with.\n\n"
            "Thanks,\nRoadAssist Admin"
        ),
    )
    return {"detail": "Warehouse approved", "email_sent": email_sent}


@router.patch("/mechanics/{mechanic_id}/decline", status_code=200)
async def decline_mechanic_registration(
    mechanic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        text(
            """
            SELECT m.id, m.user_id, u.name, u.email
            FROM mechanics m
            JOIN users u ON u.id = m.user_id
            WHERE m.id = :mid
            """
        ),
        {"mid": mechanic_id},
    )
    mechanic = result.mappings().first()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")

    await db.execute(
        text(
            """
            UPDATE mechanics
            SET approval_status = 'declined', is_available = FALSE
            WHERE id = :mid
            """
        ),
        {"mid": mechanic_id},
    )
    await db.commit()

    email_sent = await asyncio.to_thread(
        send_email,
        mechanic["email"],
        "RoadAssist mechanic registration update",
        (
            f"Hello {mechanic['name']},\n\n"
            "Your mechanic registration request for RoadAssist was declined after review. "
            "You cannot sign in as a mechanic at this time. Please contact the admin team if you believe this is an error.\n\n"
            "Thanks,\nRoadAssist Admin"
        ),
    )
    return {"detail": "Mechanic declined", "email_sent": email_sent}


@router.patch("/warehouses/{warehouse_id}/decline", status_code=200)
async def decline_warehouse_registration(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        text(
            """
            SELECT w.id, w.user_id, w.name AS warehouse_name, u.name, u.email
            FROM warehouses w
            JOIN users u ON u.id = w.user_id
            WHERE w.id = :wid
            """
        ),
        {"wid": warehouse_id},
    )
    warehouse = result.mappings().first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    await db.execute(
        text(
            """
            UPDATE warehouses
            SET approval_status = 'declined', is_active = FALSE
            WHERE id = :wid
            """
        ),
        {"wid": warehouse_id},
    )
    await db.commit()

    email_sent = await asyncio.to_thread(
        send_email,
        warehouse["email"],
        "RoadAssist warehouse registration update",
        (
            f"Hello {warehouse['name']},\n\n"
            f"Your warehouse registration request for {warehouse['warehouse_name']} was declined after review. "
            "You cannot sign in as a warehouse at this time. Please contact the admin team if you believe this is an error.\n\n"
            "Thanks,\nRoadAssist Admin"
        ),
    )
    return {"detail": "Warehouse declined", "email_sent": email_sent}


@router.get("/owners")
async def list_all_owners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(text("""
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.street_address,
            u.city,
            u.state,
            u.postal_code,
            u.created_at,
            u.is_active,
            COUNT(v.id) AS vehicle_count
        FROM users u
        LEFT JOIN vehicles v ON v.owner_id = u.id
        WHERE u.role = 'owner'
        GROUP BY u.id, u.name, u.email, u.phone, u.street_address, u.city, u.state, u.postal_code, u.created_at, u.is_active
        ORDER BY u.created_at DESC
    """))
    return [dict(r) for r in result.mappings().all()]


@router.patch("/mechanics/{mechanic_id}/deactivate", status_code=200)
async def deactivate_mechanic(
    mechanic_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Mechanic).where(Mechanic.id == mechanic_id))
    mechanic = result.scalar_one_or_none()
    if not mechanic:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Mechanic not found")

    await db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :uid"),
        {"uid": mechanic.user_id},
    )
    await db.commit()
    return {"detail": "Mechanic deactivated"}


@router.patch("/warehouses/{warehouse_id}/deactivate", status_code=200)
async def deactivate_warehouse(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    await db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :uid"),
        {"uid": warehouse.user_id},
    )
    await db.execute(
        text("UPDATE warehouses SET is_active = FALSE WHERE id = :wid"),
        {"wid": warehouse_id},
    )
    await db.commit()
    return {"detail": "Warehouse deactivated"}


@router.get("/lookup")
async def lookup_work_item(
    query: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    normalized = _normalize_lookup_query(query)
    if not normalized:
        raise HTTPException(status_code=400, detail="Search query is required")

    request_result = await db.execute(
        text(
            """
            SELECT
                'service_request' AS item_type,
                sr.id::text AS id,
                CONCAT('RA-', UPPER(SUBSTRING(sr.id::TEXT, 1, 8))) AS ref,
                sr.status::text AS status,
                sr.problem_desc AS title,
                owner.name AS owner_name,
                COALESCE(mech_user.name, 'Unassigned') AS mechanic_name,
                sr.created_at AS event_at,
                CAST(COALESCE(sr.total_cost, sr.estimated_cost, 0) AS FLOAT) AS amount
            FROM service_requests sr
            JOIN users owner ON owner.id = sr.owner_id
            LEFT JOIN mechanics m ON m.id = sr.mechanic_id
            LEFT JOIN users mech_user ON mech_user.id = m.user_id
            WHERE sr.id::text = :raw
               OR CONCAT('RA-', UPPER(SUBSTRING(sr.id::TEXT, 1, 8))) = :normalized
            LIMIT 1
            """
        ),
        {"raw": query.strip(), "normalized": normalized},
    )
    request_item = request_result.mappings().first()
    if request_item:
        return dict(request_item)

    appointment_result = await db.execute(
        text(
            """
            SELECT
                'appointment' AS item_type,
                a.id::text AS id,
                CONCAT('AP-', UPPER(SUBSTRING(a.id::TEXT, 1, 8))) AS ref,
                a.status::text AS status,
                a.service_type AS title,
                owner.name AS owner_name,
                mech_user.name AS mechanic_name,
                a.scheduled_for AS event_at,
                CAST(COALESCE(a.estimated_cost, 0) AS FLOAT) AS amount
            FROM appointments a
            JOIN users owner ON owner.id = a.owner_id
            JOIN mechanics m ON m.id = a.mechanic_id
            JOIN users mech_user ON mech_user.id = m.user_id
            WHERE a.id::text = :raw
               OR CONCAT('AP-', UPPER(SUBSTRING(a.id::TEXT, 1, 8))) = :normalized
            LIMIT 1
            """
        ),
        {"raw": query.strip(), "normalized": normalized},
    )
    appointment_item = appointment_result.mappings().first()
    if appointment_item:
        return dict(appointment_item)

    raise HTTPException(status_code=404, detail="No request or appointment matched that ID")


@router.patch("/owners/{owner_id}/deactivate", status_code=200)
async def deactivate_owner(
    owner_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == owner_id, User.role == "owner"))
    owner = result.scalar_one_or_none()
    if not owner:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Owner not found")

    await db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :uid"),
        {"uid": owner.id},
    )
    await db.commit()
    return {"detail": "Owner deactivated"}
