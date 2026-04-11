from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


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
        role=payload.role,
    )
    db.add(user)
    await db.flush()  # get user.id before committing

    # If registering as mechanic, create a blank mechanic profile
    # (they can fill in location/specialization later via PATCH /mechanics/me)
    if payload.role == "mechanic":
        mechanic = Mechanic(
            user_id=user.id,
            # Default to Richmond city centre until mechanic sets a real location.
            location=text("ST_MakePoint(-77.4360, 37.5407)::GEOGRAPHY"),
        )
        db.add(mechanic)

    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": str(user.role)})
    return TokenResponse(
        access_token=token,
        role=str(user.role),
        user_id=str(user.id),
        name=user.name,
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

        token = create_access_token({"sub": str(user.id), "role": str(user.role)})
        return TokenResponse(
            access_token=token,
            role=str(user.role),
            user_id=str(user.id),
            name=user.name,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
