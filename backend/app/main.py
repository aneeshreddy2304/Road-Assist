import asyncio
from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.bootstrap import ensure_owner_marketplace_schema, ensure_schema_updates, ensure_vehicle_care_schema, ensure_workspace_schema
from app.core.config import get_settings
from app.routers import auth, mechanics, parts, requests, admin, vehicles, engagement, warehouses, owner_marketplace
from app.routers import vehicle_care, workspace

settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="""
## RoadAssist API

Connects stranded vehicle owners with nearby roadside mechanics in real time.

### Key features
- **Geospatial search** — find mechanics within X km using PostGIS
- **Parts inventory** — search for a specific part across all nearby mechanics
- **Job tracking** — full status trail from request → accepted → in_progress → completed
- **Triggers** — low-stock alerts and rating updates fire automatically in the DB
- **Stored procedures** — job acceptance is an atomic DB-side transaction
""",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.openapi_version = "3.0.3"

# CORS — allow the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    # Vercel creates immutable preview hostnames as well as the production
    # road-assist hostname. Limit browser access to this project's HTTPS
    # deployments instead of opening the API to arbitrary origins.
    allow_origin_regex=r"https://road-assist(?:-[a-z0-9]+)*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(mechanics.router)
app.include_router(parts.router)
app.include_router(requests.router)
app.include_router(engagement.router)
app.include_router(vehicles.router)
app.include_router(admin.router)
app.include_router(warehouses.router)
app.include_router(vehicle_care.router)
app.include_router(owner_marketplace.router)
app.include_router(workspace.router)


async def vehicle_care_reminder_loop() -> None:
    """Keep in-app reminders current even if an owner does not open the app."""
    while True:
        try:
            await vehicle_care.refresh_all_owner_reminders()
        except Exception:
            # A later pass retries a transient database failure without taking
            # the API offline. This loop deliberately has no email side effect.
            import logging
            logging.getLogger(__name__).exception("Vehicle Care reminder refresh failed")
        await asyncio.sleep(15 * 60)


@app.on_event("startup")
async def bootstrap_schema():
    if settings.AUTO_BOOTSTRAP_SCHEMA:
        await ensure_schema_updates()
    # Vehicle Care ships with an idempotent schema installer so fresh and existing
    # deployments receive the feature without a manual migration step.
    await ensure_vehicle_care_schema()
    await ensure_owner_marketplace_schema()
    await ensure_workspace_schema()
    await vehicle_care.refresh_all_owner_reminders()
    app.state.vehicle_care_reminder_task = asyncio.create_task(vehicle_care_reminder_loop())


@app.on_event("shutdown")
async def stop_vehicle_care_reminder_loop():
    task = getattr(app.state, "vehicle_care_reminder_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "RoadAssist API",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
