from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.core.security import get_current_user, require_role
from app.schemas.mechanic import (
    MechanicNearbyResult, MechanicUpdate, MechanicProfile, MechanicDashboard, MechanicMe, MechanicPublicProfile
)

router = APIRouter(prefix="/mechanics", tags=["Mechanics"])


def _window_clause(column: str, range_key: str) -> str:
    windows = {
        "week": f"{column} >= NOW() - INTERVAL '7 days'",
        "month": f"DATE_TRUNC('month', {column}) = DATE_TRUNC('month', NOW())",
        "six_months": f"{column} >= NOW() - INTERVAL '6 months'",
        "year": f"DATE_TRUNC('year', {column}) = DATE_TRUNC('year', NOW())",
        "all": "TRUE",
    }
    return windows.get(range_key, windows["week"])


# ------------------------------------------------------------------
# GET /mechanics/nearby  — geospatial search (core feature)
# Uses PostGIS ST_DWithin + ST_Distance, hits the GIST index
# ------------------------------------------------------------------
@router.get("/nearby", response_model=list[MechanicNearbyResult])
async def get_nearby_mechanics(
    lat: float = Query(..., description="Your latitude"),
    lng: float = Query(..., description="Your longitude"),
    radius_km: float = Query(10.0, ge=1, le=50, description="Search radius in km"),
    vehicle_type: Optional[str] = Query(None, description="Filter by vehicle type"),
    db: AsyncSession = Depends(get_db),
):
    vehicle_filter = ""
    params: dict = {"lat": lat, "lng": lng, "radius_m": radius_km * 1000}

    if vehicle_type:
        vehicle_filter = "AND :vtype = ANY(m.vehicle_types)"
        params["vtype"] = vehicle_type

    query = text(f"""
        SELECT
            m.id::TEXT                                                  AS mechanic_id,
            m.user_id::TEXT                                             AS user_id,
            u.name,
            u.phone,
            m.address,
            m.specialization,
            m.vehicle_types,
            m.is_available,
            CAST(m.rating AS FLOAT)                                     AS rating,
            m.total_reviews,
            ST_Y(m.location::geometry)                                  AS lat,
            ST_X(m.location::geometry)                                  AS lng,
            ROUND(
                CAST(ST_Distance(
                    m.location,
                    ST_MakePoint(:lng, :lat)::GEOGRAPHY
                ) / 1000 AS NUMERIC), 2
            )                                                           AS distance_km
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        WHERE
            u.is_active = TRUE
            AND m.approval_status = 'approved'
            AND m.is_available = TRUE
            AND ST_DWithin(
                m.location,
                ST_MakePoint(:lng, :lat)::GEOGRAPHY,
                :radius_m
            )
            {vehicle_filter}
        ORDER BY distance_km ASC, m.rating DESC
    """)

    result = await db.execute(query, params)
    rows = result.mappings().all()
    return [MechanicNearbyResult(**dict(r)) for r in rows]


@router.get("/me", response_model=MechanicMe)
async def get_my_mechanic_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    query = text("""
        SELECT
            m.id::TEXT AS mechanic_id,
            m.user_id::TEXT AS user_id,
            u.name,
            u.email,
            u.phone,
            m.address,
            m.specialization,
            m.work_hours,
            m.vehicle_types,
            m.approval_status,
            m.is_available,
            CAST(m.rating AS FLOAT) AS rating,
            m.total_reviews,
            ST_Y(m.location::geometry) AS lat,
            ST_X(m.location::geometry) AS lng
        FROM mechanics m
        JOIN users u ON u.id = m.user_id
        WHERE m.user_id = :uid
    """)
    result = await db.execute(query, {"uid": current_user.id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Mechanic profile not found")
    return MechanicMe(**dict(row))


# ------------------------------------------------------------------
# GET /mechanics/:id  — public mechanic profile
# ------------------------------------------------------------------
@router.get("/{mechanic_id}", response_model=MechanicPublicProfile)
async def get_mechanic(
    mechanic_id: str,
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    distance_select = "NULL::FLOAT AS distance_km"
    params: dict[str, object] = {"mid": mechanic_id}

    if lat is not None and lng is not None:
        distance_select = """
            ROUND(
                CAST(ST_Distance(
                    m.location,
                    ST_MakePoint(:lng, :lat)::GEOGRAPHY
                ) / 1000 AS NUMERIC), 2
            ) AS distance_km
        """
        params["lat"] = lat
        params["lng"] = lng

    result = await db.execute(
        text(f"""
            SELECT
                m.id::TEXT AS mechanic_id,
                m.user_id::TEXT AS user_id,
                u.name,
                u.phone,
                m.address,
                m.specialization,
                m.vehicle_types,
                m.is_available,
                CAST(m.rating AS FLOAT) AS rating,
                m.total_reviews,
                ST_Y(m.location::geometry) AS lat,
                ST_X(m.location::geometry) AS lng,
                {distance_select}
            FROM mechanics m
            JOIN users u ON u.id = m.user_id
            WHERE m.id = :mid AND u.is_active = TRUE AND m.approval_status = 'approved'
        """),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    return MechanicPublicProfile(**dict(row))


# ------------------------------------------------------------------
# GET /mechanics/:id/dashboard  — mechanic's own dashboard
# Reads from the materialized view mv_mechanic_dashboard
# ------------------------------------------------------------------
@router.get("/{mechanic_id}/dashboard", response_model=MechanicDashboard)
async def get_mechanic_dashboard(
    mechanic_id: str,
    range_key: str = Query(default="week", alias="range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Mechanics can only see their own dashboard; admins can see all
    if current_user.role == "mechanic":
        result = await db.execute(
            select(Mechanic).where(Mechanic.user_id == current_user.id)
        )
        mechanic = result.scalar_one_or_none()
        if not mechanic or mechanic.id != mechanic_id:
            raise HTTPException(status_code=403, detail="Access denied")

    request_window = _window_clause("sr.created_at", range_key)
    completion_window = _window_clause("rt.completed_at", range_key)
    inventory_window = _window_clause("COALESCE(sp.updated_at, sp.created_at)", range_key)

    row = await db.execute(
        text(
            f"""
            WITH request_timeline AS (
                SELECT
                    sr.id,
                    sr.mechanic_id,
                    sr.status,
                    sr.total_cost,
                    sr.created_at,
                    MIN(ju.created_at) FILTER (WHERE ju.status = 'completed') AS completed_at
                FROM service_requests sr
                LEFT JOIN job_updates ju ON ju.request_id = sr.id
                WHERE sr.mechanic_id = :mid
                GROUP BY sr.id, sr.mechanic_id, sr.status, sr.total_cost, sr.created_at
            ),
            request_stats AS (
                SELECT
                    COUNT(*) FILTER (WHERE {request_window.replace('sr.created_at', 'created_at')}) AS total_jobs,
                    COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND {completion_window.replace('rt.completed_at', 'completed_at')}) AS completed_jobs,
                    COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress')) AS active_jobs,
                    COALESCE(SUM(total_cost) FILTER (WHERE completed_at IS NOT NULL AND {completion_window.replace('rt.completed_at', 'completed_at')}), 0) AS total_earnings
                FROM request_timeline
            ),
            inventory_stats AS (
                SELECT
                    COUNT(*) FILTER (WHERE {inventory_window.replace('COALESCE(sp.updated_at, sp.created_at)', 'COALESCE(updated_at, created_at)')}) AS inventory_items,
                    COUNT(*) FILTER (
                        WHERE quantity < min_threshold
                          AND {inventory_window.replace('COALESCE(sp.updated_at, sp.created_at)', 'COALESCE(updated_at, created_at)')}
                    ) AS low_stock_alerts
                FROM spare_parts
                WHERE mechanic_id = :mid
            )
            SELECT
                m.id::TEXT AS mechanic_id,
                u.name AS mechanic_name,
                CAST(m.rating AS FLOAT) AS rating,
                m.total_reviews,
                rs.total_jobs,
                rs.completed_jobs,
                rs.active_jobs,
                CAST(rs.total_earnings AS FLOAT) AS total_earnings,
                CAST(rs.total_earnings AS FLOAT) AS earnings_this_week,
                ist.inventory_items,
                ist.low_stock_alerts
            FROM mechanics m
            JOIN users u ON u.id = m.user_id
            CROSS JOIN request_stats rs
            CROSS JOIN inventory_stats ist
            WHERE m.id = :mid
            """
        ),
        {"mid": mechanic_id},
    )
    data = row.mappings().first()
    if not data:
        raise HTTPException(status_code=404, detail="Dashboard data not found")
    return MechanicDashboard(**dict(data))


# ------------------------------------------------------------------
# PATCH /mechanics/me  — mechanic updates their own profile
# ------------------------------------------------------------------
@router.patch("/me", response_model=MechanicProfile)
async def update_my_profile(
    payload: MechanicUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = result.scalar_one_or_none()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic profile not found")

    if payload.address is not None:
        mechanic.address = payload.address
    if payload.specialization is not None:
        mechanic.specialization = payload.specialization
    if payload.work_hours is not None:
        mechanic.work_hours = payload.work_hours
    if payload.vehicle_types is not None:
        mechanic.vehicle_types = payload.vehicle_types
    if payload.is_available is not None:
        mechanic.is_available = payload.is_available

    # Update location if lat/lng provided
    if payload.lat is not None and payload.lng is not None:
        await db.execute(
            text("UPDATE mechanics SET location = ST_MakePoint(:lng, :lat)::GEOGRAPHY WHERE id = :mid"),
            {"lng": payload.lng, "lat": payload.lat, "mid": mechanic.id},
        )

    await db.commit()
    await db.refresh(mechanic)
    return mechanic
