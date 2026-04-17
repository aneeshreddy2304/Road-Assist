from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.core.security import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


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
            ROUND(AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)) / 3600) FILTER (WHERE accepted_at IS NOT NULL), 2) AS avg_response_hours,
            ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - accepted_at)) / 3600) FILTER (WHERE accepted_at IS NOT NULL AND completed_at IS NOT NULL), 2) AS avg_completion_hours
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
        SELECT m.id, u.name, u.email, u.phone,
               m.specialization, m.is_available,
               CAST(m.rating AS FLOAT) AS rating,
               m.total_reviews, m.address
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        ORDER BY m.rating DESC
    """))
    return [dict(r) for r in result.mappings().all()]


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
