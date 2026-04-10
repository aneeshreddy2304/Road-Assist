# RoadAssist

RoadAssist connects stranded vehicle owners with nearby mechanics, lets users search spare-part inventory, and tracks the full roadside assistance workflow.

## Repository Layout

- `backend/`: FastAPI backend
- `frontend/`: React + Vite frontend
- `database/schema.sql`: primary PostgreSQL/PostGIS schema
- `database/seed.sql`: realistic demo seed data

## Best Deployment Split

- Frontend: Vercel
- Backend: Render or Railway
- Database: PostgreSQL with PostGIS enabled

Do not try to host the full FastAPI + PostGIS stack on Vercel.

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `backend/.env` from `backend/.env.example`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local` from `frontend/.env.example`.

## Database Setup

Run `database/schema.sql` first, then `database/seed.sql`.

This SQL includes:

- PostGIS geospatial search
- low-stock triggers
- mechanic rating trigger updates
- `sp_accept_job` stored procedure
- `mv_mechanic_dashboard` materialized view
- admin analytics view
- RLS policies for core tables

## Production Environment Variables

### Backend

```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=replace-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
```

### Frontend

```env
VITE_API_URL=https://your-backend-domain.onrender.com
```

## Notes

- The backend already expects the richer SQL schema in `database/schema.sql`.
- Mechanic dashboard pages now use a direct `/mechanics/me` lookup instead of a fragile nearby-search workaround.
- There is a duplicate older copy under `backend/roadassist/`; the active app is `backend/app/`.
