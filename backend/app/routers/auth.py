import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.elements import WKTElement

from app.core.email import send_email
from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.models.warehouse import Warehouse
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut, ProfileUpdateRequest

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _notify_admins_of_registration(db: AsyncSession, *, applicant_role: str, applicant_name: str, applicant_email: str, summary: str) -> None:
    admin_result = await db.execute(
        select(User.email).where(User.role == "admin", User.is_active.is_(True))
    )
    admin_emails = [email for email in admin_result.scalars().all() if email]
    if not admin_emails:
        return

    subject = f"New RoadAssist {applicant_role} registration pending review"
    body = (
        "A new registration is waiting for admin approval.\n\n"
        f"Role: {applicant_role.title()}\n"
        f"Applicant: {applicant_name}\n"
        f"Email: {applicant_email}\n"
        f"Submitted details: {summary}\n\n"
        "Approve or decline this registration from the admin dashboard."
    )

    await asyncio.gather(
        *(asyncio.to_thread(send_email, email, subject, body) for email in admin_emails),
        return_exceptions=True,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email not already taken
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        gender=payload.gender,
        street_address=payload.street_address,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
        role=payload.role,
    )
    db.add(user)
    await db.flush()  # get user.id before committing

    approval_status = "approved"
    registration_detail = None
    if payload.role == "mechanic":
        if payload.lat is None or payload.lng is None:
            raise HTTPException(status_code=422, detail="Mechanic center location is required")
        if not payload.address or not payload.specialization:
            raise HTTPException(status_code=422, detail="Mechanic workshop address and specialization are required")

        mechanic = Mechanic(
            user_id=user.id,
            location=WKTElement(f"POINT({payload.lng} {payload.lat})", srid=4326),
            address=payload.address,
            specialization=payload.specialization,
            work_hours=payload.work_hours,
            vehicle_types=payload.vehicle_types or [],
            approval_status="pending",
            is_available=False,
        )
        db.add(mechanic)
        approval_status = "pending"
        registration_detail = "Registration submitted. An admin will review your mechanic application and email you the result."
    elif payload.role == "warehouse":
        if payload.lat is None or payload.lng is None:
            raise HTTPException(status_code=422, detail="Warehouse location is required")
        if not payload.address or not payload.warehouse_name or not payload.fulfillment_hours:
            raise HTTPException(status_code=422, detail="Warehouse name, address, and fulfillment hours are required")

        warehouse = Warehouse(
            user_id=user.id,
            name=payload.warehouse_name,
            address=payload.address,
            lat=payload.lat,
            lng=payload.lng,
            contact_phone=payload.phone,
            description=payload.warehouse_description,
            fulfillment_hours=payload.fulfillment_hours,
            approval_status="pending",
            is_active=True,
        )
        db.add(warehouse)
        approval_status = "pending"
        registration_detail = "Registration submitted. An admin will review your warehouse application and email you the result."

    await db.commit()
    await db.refresh(user)

    if approval_status == "pending":
        if payload.role == "mechanic":
            summary = (
                f"Workshop address: {payload.address}; "
                f"Specialization: {payload.specialization}; "
                f"Work hours: {payload.work_hours or 'Not provided'}; "
                f"Vehicle types: {', '.join(payload.vehicle_types or []) or 'Not provided'}; "
                f"Location: {payload.lat}, {payload.lng}"
            )
        else:
            summary = (
                f"Warehouse name: {payload.warehouse_name}; "
                f"Address: {payload.address}; "
                f"Fulfillment hours: {payload.fulfillment_hours}; "
                f"Description: {payload.warehouse_description or 'Not provided'}; "
                f"Location: {payload.lat}, {payload.lng}; "
                f"Phone: {payload.phone or 'Not provided'}"
            )
        await _notify_admins_of_registration(
            db,
            applicant_role=payload.role,
            applicant_name=user.name,
            applicant_email=user.email,
            summary=summary,
        )
        return TokenResponse(
            role=str(user.role),
            user_id=str(user.id),
            name=user.name,
            registration_status="pending",
            detail=registration_detail,
        )

    token = create_access_token({"sub": str(user.id), "role": str(user.role)})
    return TokenResponse(
        access_token=token,
        role=str(user.role),
        user_id=str(user.id),
        name=user.name,
        registration_status="approved",
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(User).where(User.email == payload.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        if user.role == "mechanic":
            mechanic_result = await db.execute(select(Mechanic).where(Mechanic.user_id == user.id))
            mechanic = mechanic_result.scalar_one_or_none()
            if not mechanic:
                raise HTTPException(status_code=403, detail="Mechanic profile not found")
            if mechanic.approval_status == "pending":
                raise HTTPException(status_code=403, detail="Your mechanic registration is still pending admin approval")
            if mechanic.approval_status == "declined":
                raise HTTPException(status_code=403, detail="Your mechanic registration was declined. Please contact the admin team")
        elif user.role == "warehouse":
            warehouse_result = await db.execute(select(Warehouse).where(Warehouse.user_id == user.id))
            warehouse = warehouse_result.scalar_one_or_none()
            if not warehouse:
                raise HTTPException(status_code=403, detail="Warehouse profile not found")
            if warehouse.approval_status == "pending":
                raise HTTPException(status_code=403, detail="Your warehouse registration is still pending admin approval")
            if warehouse.approval_status == "declined":
                raise HTTPException(status_code=403, detail="Your warehouse registration was declined. Please contact the admin team")

        token = create_access_token({"sub": str(user.id), "role": str(user.role)})
        return TokenResponse(
            access_token=token,
            role=str(user.role),
            user_id=str(user.id),
            name=user.name,
            registration_status="approved",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user
