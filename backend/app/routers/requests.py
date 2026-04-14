from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.models.service_request import ServiceRequest, JobUpdate
from app.models.review import Review, Alert
from app.models.vehicle import Vehicle
from app.core.security import get_current_user, require_role
from app.schemas.requests import (
    ServiceRequestCreate, StatusUpdate,
    ServiceRequestOut, ServiceRequestDetail,
    ReviewCreate, ReviewOut, JobUpdateOut,
)

router = APIRouter(tags=["Service Requests"])


def _estimate_completion_total(problem_desc: str) -> float:
    problem = (problem_desc or "").lower()
    if any(term in problem for term in ["engine", "transmission", "gear"]):
        return 249.0
    if any(term in problem for term in ["battery", "start", "starter", "alternator"]):
        return 179.0
    if any(term in problem for term in ["brake", "tyre", "tire", "puncture", "wheel"]):
        return 159.0
    if any(term in problem for term in ["ac", "cooling", "radiator", "coolant"]):
        return 189.0
    return 149.0


# ------------------------------------------------------------------
# POST /requests  — owner creates a new service request
# ------------------------------------------------------------------
@router.post("/requests", response_model=ServiceRequestOut, status_code=201)
async def create_request(
    payload: ServiceRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    vehicle_check = await db.execute(
        select(Vehicle.id).where(
            Vehicle.id == payload.vehicle_id,
            Vehicle.owner_id == current_user.id,
        )
    )
    if vehicle_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="That vehicle does not belong to you")

    mechanic_id = None
    if payload.mechanic_id:
        mechanic_check = await db.execute(
            select(Mechanic).where(Mechanic.id == payload.mechanic_id)
        )
        mechanic = mechanic_check.scalar_one_or_none()
        if not mechanic:
            raise HTTPException(status_code=404, detail="Selected mechanic not found")
        mechanic_id = mechanic.id

    create_result = await db.execute(
        text("""
            INSERT INTO service_requests (
                owner_id,
                mechanic_id,
                vehicle_id,
                problem_desc,
                status,
                owner_location
            )
            VALUES (
                :owner_id,
                :mechanic_id,
                :vehicle_id,
                :problem_desc,
                'requested',
                ST_MakePoint(:lng, :lat)::GEOGRAPHY
            )
            RETURNING id
        """),
        {
            "owner_id": current_user.id,
            "mechanic_id": mechanic_id,
            "vehicle_id": payload.vehicle_id,
            "problem_desc": payload.problem_desc,
            "lng": payload.lng,
            "lat": payload.lat,
        },
    )
    req_id = create_result.scalar_one()

    # Log the initial status
    db.add(JobUpdate(
        request_id=req_id,
        status="requested",
        updated_by=current_user.id,
        note="Owner submitted the request" if not mechanic_id else "Owner requested a specific mechanic",
    ))

    await db.commit()
    created = await db.execute(
        text("""
            SELECT
                sr.id::TEXT AS id,
                sr.owner_id::TEXT AS owner_id,
                sr.mechanic_id::TEXT AS mechanic_id,
                sr.vehicle_id::TEXT AS vehicle_id,
                sr.problem_desc,
                sr.status::TEXT AS status,
                CAST(sr.total_cost AS FLOAT) AS total_cost,
                u.name AS owner_name,
                CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label,
                v.license_plate,
                ST_Y(sr.owner_location::geometry) AS lat,
                ST_X(sr.owner_location::geometry) AS lng,
                sr.created_at,
                sr.updated_at
            FROM service_requests sr
            JOIN users u ON u.id = sr.owner_id
            JOIN vehicles v ON v.id = sr.vehicle_id
            WHERE sr.id = :rid
        """),
        {"rid": req_id},
    )
    row = created.mappings().first()
    if not row:
        raise HTTPException(status_code=500, detail="Request was created but could not be loaded")
    return ServiceRequestOut(**dict(row))


# ------------------------------------------------------------------
# GET /requests  — list requests (owners see theirs, mechanics see theirs)
# ------------------------------------------------------------------
@router.get("/requests", response_model=list[ServiceRequestOut])
async def list_requests(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = []
    params: dict[str, object] = {}

    if current_user.role == "owner":
        conditions.append("sr.owner_id = :uid")
        params["uid"] = current_user.id
    elif current_user.role == "mechanic":
        mech = await db.execute(select(Mechanic).where(Mechanic.user_id == current_user.id))
        mechanic = mech.scalar_one_or_none()
        if not mechanic:
            return []
        conditions.append("sr.mechanic_id = :mid")
        params["mid"] = mechanic.id

    if status:
        conditions.append("sr.status = :status")
        params["status"] = status

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    result = await db.execute(
        text(f"""
            SELECT
                sr.id::TEXT AS id,
                sr.owner_id::TEXT AS owner_id,
                sr.mechanic_id::TEXT AS mechanic_id,
                sr.vehicle_id::TEXT AS vehicle_id,
                sr.problem_desc,
                sr.status::TEXT AS status,
                CAST(sr.total_cost AS FLOAT) AS total_cost,
                u.name AS owner_name,
                CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label,
                v.license_plate,
                ST_Y(sr.owner_location::geometry) AS lat,
                ST_X(sr.owner_location::geometry) AS lng,
                sr.created_at,
                sr.updated_at
            FROM service_requests sr
            JOIN users u ON u.id = sr.owner_id
            JOIN vehicles v ON v.id = sr.vehicle_id
            {where_clause}
            ORDER BY sr.created_at DESC
        """),
        params,
    )
    rows = result.mappings().all()
    return [ServiceRequestOut(**dict(row)) for row in rows]


# ------------------------------------------------------------------
# GET /requests/open  — open pool mechanics can browse and accept
# ------------------------------------------------------------------
@router.get("/requests/open", response_model=list[ServiceRequestOut])
async def list_open_requests(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(10.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech = await db.execute(select(Mechanic).where(Mechanic.user_id == current_user.id))
    mechanic = mech.scalar_one_or_none()
    if not mechanic:
        return []

    result = await db.execute(
        text("""
        SELECT
            sr.id::TEXT AS id,
            sr.owner_id::TEXT AS owner_id,
            sr.mechanic_id::TEXT AS mechanic_id,
            sr.vehicle_id::TEXT AS vehicle_id,
            sr.problem_desc,
            sr.status::TEXT AS status,
            CAST(sr.total_cost AS FLOAT) AS total_cost,
            u.name AS owner_name,
            CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label,
            v.license_plate,
            ST_Y(sr.owner_location::geometry) AS lat,
            ST_X(sr.owner_location::geometry) AS lng,
            sr.created_at,
            sr.updated_at
        FROM service_requests sr
        JOIN users u ON u.id = sr.owner_id
        JOIN vehicles v ON v.id = sr.vehicle_id
            WHERE
                sr.status = 'requested'
                AND (
                    sr.mechanic_id = :mechanic_id
                    OR (
                        sr.mechanic_id IS NULL
                        AND ST_DWithin(
                            sr.owner_location,
                            ST_MakePoint(:lng, :lat)::GEOGRAPHY,
                            :radius_m
                        )
                    )
                )
            ORDER BY sr.created_at ASC
        """),
        {"lat": lat, "lng": lng, "radius_m": radius_km * 1000, "mechanic_id": mechanic.id},
    )
    rows = result.mappings().all()
    return [ServiceRequestOut(**dict(r)) for r in rows]


@router.get("/requests/history/owner", response_model=list[dict])
async def owner_history_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    result = await db.execute(
        text("""
            SELECT
                sr.id::text AS request_id,
                sr.problem_desc,
                sr.status::text AS status,
                sr.total_cost,
                sr.created_at,
                COALESCE(mu.name, 'Awaiting assignment') AS mechanic_name,
                CONCAT(v.year, ' ', v.make, ' ', v.model) AS vehicle_label,
                v.license_plate
            FROM service_requests sr
            JOIN vehicles v ON v.id = sr.vehicle_id
            LEFT JOIN mechanics m ON m.id = sr.mechanic_id
            LEFT JOIN users mu ON mu.id = m.user_id
            WHERE sr.owner_id = :owner_id
            ORDER BY sr.created_at DESC
        """),
        {"owner_id": current_user.id},
    )
    return [dict(row) for row in result.mappings().all()]


# ------------------------------------------------------------------
# GET /requests/:id  — full detail including job update history
# ------------------------------------------------------------------
@router.get("/requests/{request_id}", response_model=ServiceRequestDetail)
async def get_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Access check
    if current_user.role == "owner" and req.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    updates_result = await db.execute(
        select(JobUpdate)
        .where(JobUpdate.request_id == request_id)
        .order_by(JobUpdate.created_at.asc())
    )
    updates = updates_result.scalars().all()

    return ServiceRequestDetail(
        **{c.key: getattr(req, c.key) for c in req.__table__.columns},
        job_updates=[JobUpdateOut.model_validate(u) for u in updates],
    )


# ------------------------------------------------------------------
# PATCH /requests/:id/status  — mechanic updates job status
# Calls the sp_accept_job stored procedure when accepting
# ------------------------------------------------------------------
@router.patch("/requests/{request_id}/status", response_model=ServiceRequestOut)
async def update_request_status(
    request_id: str,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Get mechanic profile
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()

    # Use stored procedure for acceptance — atomic assign + log
    if payload.status == "accepted":
        if not mechanic:
            raise HTTPException(status_code=403, detail="Only mechanics can accept jobs")
        try:
            await db.execute(
                text("CALL sp_accept_job(:rid, :mid)"),
                {"rid": request_id, "mid": mechanic.id},
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    else:
        # For other transitions, update directly + log
        valid_transitions = {
            "accepted":    ["in_progress", "cancelled"],
            "in_progress": ["completed", "cancelled"],
        }
        allowed = valid_transitions.get(req.status, [])
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{req.status}' to '{payload.status}'",
            )

        req.status = payload.status
        if payload.status == "completed" and req.total_cost is None:
            req.total_cost = _estimate_completion_total(req.problem_desc)
        updater_id = mechanic.user_id if mechanic else current_user.id
        db.add(JobUpdate(
            request_id=req.id,
            status=payload.status,
            updated_by=updater_id,
            note=payload.note or f"Status updated to {payload.status}",
        ))

    await db.commit()
    await db.refresh(req)

    # Refresh materialized view after completion
    if payload.status == "completed":
        await db.execute(
            text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mechanic_dashboard")
        )
        await db.commit()

    return req


# ------------------------------------------------------------------
# GET /requests/:id/history  — full status trail
# ------------------------------------------------------------------
@router.get("/requests/{request_id}/history", response_model=list[JobUpdateOut])
async def get_request_history(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(JobUpdate)
        .where(JobUpdate.request_id == request_id)
        .order_by(JobUpdate.created_at.asc())
    )
    return result.scalars().all()


# ------------------------------------------------------------------
# POST /reviews  — owner submits review after job completion
# The trg_update_mechanic_rating trigger fires automatically
# ------------------------------------------------------------------
@router.post("/reviews", response_model=ReviewOut, status_code=201)
async def submit_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=422, detail="Rating must be 1–5")

    # Validate request is completed and belongs to owner
    req_result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == payload.request_id)
    )
    req = req_result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    if req.status != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed jobs")
    if req.mechanic_id is None:
        raise HTTPException(status_code=400, detail="No mechanic assigned to this request")

    # Check not already reviewed
    existing = await db.execute(
        select(Review).where(Review.request_id == payload.request_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already reviewed this job")

    review = Review(
        request_id=payload.request_id,
        owner_id=current_user.id,
        mechanic_id=req.mechanic_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    # trg_update_mechanic_rating fires automatically in DB
    return review


# ------------------------------------------------------------------
# GET /alerts  — mechanic's unresolved alerts
# ------------------------------------------------------------------
@router.get("/alerts", response_model=list[dict])
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()
    if not mechanic:
        return []

    result = await db.execute(
        select(Alert)
        .where(Alert.mechanic_id == mechanic.id, Alert.is_resolved == False)
        .order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "message": a.message,
            "part_id": a.part_id,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


# ------------------------------------------------------------------
# PATCH /alerts/:id/resolve
# ------------------------------------------------------------------
@router.patch("/alerts/{alert_id}/resolve", status_code=200)
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()

    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.mechanic_id == mechanic.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_resolved = True
    await db.commit()
    return {"detail": "Alert resolved"}
