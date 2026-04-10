# Deployment Recommendations

## Recommended Production Split

1. Frontend on Vercel
2. Backend on Render or Railway
3. PostgreSQL with PostGIS enabled

This project depends on:

- PostGIS geography columns
- stored procedures
- materialized views
- triggers and RLS

That makes a separate backend + database deployment the right shape.

## Local Bring-Up

Use Docker Compose from the repo root:

```bash
docker compose up
```

The PostGIS container auto-runs:

- `database/schema.sql`
- `database/seed.sql`

Then open:

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## Backend on Render

Use [backend/render.yaml](/Users/AneeshPC/Downloads/RoadAssist/backend/render.yaml).

Set these environment variables:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALLOWED_ORIGINS`

Use a PostgreSQL database with PostGIS available. If Render Postgres does not give you the extension support you need on your plan, Railway is usually the easier path for this project.

## Frontend on Vercel

Deploy `frontend/` as the project root.

Set:

- `VITE_API_URL=https://your-backend-url`

The existing [frontend/vercel.json](/Users/AneeshPC/Downloads/RoadAssist/frontend/vercel.json) already handles SPA routing.

## Known Practical Risks

- Mechanic map markers are still approximate in the current frontend because the nearby API does not return raw coordinates yet.
- The active backend is `backend/app/`. There is an older duplicate under `backend/roadassist/` that should not be deployed.
- Free-tier backend cold starts can make demos feel flaky. Railway is usually smoother than Render free tier for course demos.
