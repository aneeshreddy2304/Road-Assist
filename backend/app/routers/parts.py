import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.mechanic import Mechanic
from app.models.spare_part import SparePart
from app.core.security import get_current_user, require_role
from app.schemas.parts import (
    SparePartCreate,
    SparePartUpdate,
    SparePartOut,
    PartSearchResult,
    PartSuggestion,
)

router = APIRouter(prefix="/parts", tags=["Spare Parts"])


def _normalize_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _singularize(value: str) -> str:
    return value[:-1] if value.endswith("s") and len(value) > 3 else value


def _score_part_match(query: str, part_name: str, part_number: str | None = None) -> float:
    normalized_query = _normalize_term(query)
    normalized_name = _normalize_term(part_name)
    normalized_number = _normalize_term(part_number or "")

    if not normalized_query or not normalized_name:
        return 0.0

    query_tokens = [_singularize(token) for token in normalized_query.split() if token]
    name_tokens = [_singularize(token) for token in normalized_name.split() if token]
    singular_query = " ".join(query_tokens)
    singular_name = " ".join(name_tokens)

    score = 0.0

    if singular_query == singular_name:
        score = max(score, 1.0)
    if singular_name.startswith(singular_query):
        score = max(score, 0.96)
    if singular_query in singular_name:
        score = max(score, 0.9)
    if normalized_number and normalized_query in normalized_number:
        score = max(score, 0.88)

    for token in query_tokens:
        if any(name_token.startswith(token) for name_token in name_tokens):
            score = max(score, 0.8)

    phrase_ratio = SequenceMatcher(None, singular_query, singular_name).ratio()
    score = max(score, phrase_ratio)

    if query_tokens and name_tokens:
        token_ratios = [
            max(SequenceMatcher(None, query_token, name_token).ratio() for name_token in name_tokens)
            for query_token in query_tokens
        ]
        score = max(score, sum(token_ratios) / len(token_ratios))

    return score


async def _fetch_nearby_part_rows(db: AsyncSession, lat: float, lng: float, radius_km: float):
    query = text("""
        SELECT
            sp.id::TEXT                                                 AS part_id,
            sp.part_name,
            sp.part_number,
            sp.quantity,
            CAST(sp.price AS FLOAT)                                     AS price,
            m.id::TEXT                                                  AS mechanic_id,
            u.name                                                      AS mechanic_name,
            m.address                                                   AS mechanic_address,
            CAST(m.rating AS FLOAT)                                     AS mechanic_rating,
            ROUND(
                CAST(ST_Distance(
                    m.location,
                    ST_MakePoint(:lng, :lat)::GEOGRAPHY
                ) / 1000 AS NUMERIC), 2
            )                                                           AS distance_km
        FROM spare_parts sp
        JOIN mechanics m  ON m.id  = sp.mechanic_id
        JOIN users u      ON u.id  = m.user_id
        WHERE
            sp.quantity > 0
            AND m.is_available = TRUE
            AND u.is_active = TRUE
            AND ST_DWithin(
                m.location,
                ST_MakePoint(:lng, :lat)::GEOGRAPHY,
                :radius_m
            )
    """)

    result = await db.execute(
        query,
        {"lat": lat, "lng": lng, "radius_m": radius_km * 1000},
    )
    return [dict(row) for row in result.mappings().all()]


# ------------------------------------------------------------------
# GET /parts/search  — find a part across all nearby mechanics
# Cross-table geospatial + full-text search (shows off both indexes)
# ------------------------------------------------------------------
@router.get("/search", response_model=list[PartSearchResult])
async def search_parts(
    name: str = Query(..., min_length=2, description="Part name to search"),
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(15.0, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    rows = await _fetch_nearby_part_rows(db, lat, lng, radius_km)

    scored_rows = []
    for row in rows:
      score = _score_part_match(name, row["part_name"], row.get("part_number"))
      if score >= 0.45:
          scored_rows.append((score, row))

    scored_rows.sort(key=lambda item: (-item[0], item[1]["distance_km"], item[1]["price"]))
    return [PartSearchResult(**row) for _, row in scored_rows]


@router.get("/suggest", response_model=list[PartSuggestion])
async def suggest_parts(
    q: str = Query(..., min_length=1, description="Search text for part suggestions"),
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(15.0, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    rows = await _fetch_nearby_part_rows(db, lat, lng, radius_km)

    suggestions: dict[tuple[str, str | None], dict] = {}
    for row in rows:
        score = _score_part_match(q, row["part_name"], row.get("part_number"))
        if score < 0.28:
            continue

        key = (row["part_name"], row.get("part_number"))
        entry = suggestions.get(key)
        if not entry:
            suggestions[key] = {
                "part_name": row["part_name"],
                "part_number": row.get("part_number"),
                "closest_distance_km": row["distance_km"],
                "mechanic_count": 1,
                "_score": score,
            }
            continue

        entry["closest_distance_km"] = min(entry["closest_distance_km"], row["distance_km"])
        entry["mechanic_count"] += 1
        entry["_score"] = max(entry["_score"], score)

    ranked = sorted(
        suggestions.values(),
        key=lambda item: (-item["_score"], item["closest_distance_km"], item["part_name"]),
    )[:8]

    return [
        PartSuggestion(
            part_name=item["part_name"],
            part_number=item["part_number"],
            closest_distance_km=item["closest_distance_km"],
            mechanic_count=item["mechanic_count"],
        )
        for item in ranked
    ]


# ------------------------------------------------------------------
# GET /mechanics/:id/parts  — all parts for a specific mechanic
# ------------------------------------------------------------------
@router.get("/mechanic/{mechanic_id}", response_model=list[SparePartOut])
async def get_mechanic_parts(mechanic_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SparePart).where(SparePart.mechanic_id == mechanic_id)
    )
    parts = result.scalars().all()
    return [
        SparePartOut(
            **{c.key: getattr(p, c.key) for c in p.__table__.columns},
            is_low_stock=p.quantity < p.min_threshold,
        )
        for p in parts
    ]


# ------------------------------------------------------------------
# POST /parts  — mechanic adds a new part to inventory
# ------------------------------------------------------------------
@router.post("", response_model=SparePartOut, status_code=201)
async def add_part(
    payload: SparePartCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic profile not found")

    part = SparePart(
        mechanic_id=mechanic.id,
        **payload.model_dump(),
    )
    db.add(part)
    await db.commit()
    await db.refresh(part)

    return SparePartOut(
        **{c.key: getattr(part, c.key) for c in part.__table__.columns},
        is_low_stock=part.quantity < part.min_threshold,
    )


# ------------------------------------------------------------------
# PATCH /parts/:id  — mechanic updates a part (quantity, price, etc.)
# Triggers the DB low-stock alert trigger on quantity update
# ------------------------------------------------------------------
@router.patch("/{part_id}", response_model=SparePartOut)
async def update_part(
    part_id: str,
    payload: SparePartUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()

    result = await db.execute(
        select(SparePart).where(SparePart.id == part_id, SparePart.mechanic_id == mechanic.id)
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found in your inventory")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(part, field, value)

    await db.commit()
    await db.refresh(part)

    return SparePartOut(
        **{c.key: getattr(part, c.key) for c in part.__table__.columns},
        is_low_stock=part.quantity < part.min_threshold,
    )


# ------------------------------------------------------------------
# DELETE /parts/:id  — mechanic removes a part
# ------------------------------------------------------------------
@router.delete("/{part_id}", status_code=204)
async def delete_part(
    part_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mechanic")),
):
    mech_result = await db.execute(
        select(Mechanic).where(Mechanic.user_id == current_user.id)
    )
    mechanic = mech_result.scalar_one_or_none()

    result = await db.execute(
        select(SparePart).where(SparePart.id == part_id, SparePart.mechanic_id == mechanic.id)
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")

    await db.delete(part)
    await db.commit()
