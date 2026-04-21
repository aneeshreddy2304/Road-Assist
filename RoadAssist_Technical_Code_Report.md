# RoadAssist Technical Code Report

## 1. Purpose of This Report

This document explains the technical part of the RoadAssist project in a codebase-oriented way. It is intended to answer two questions:

1. What each important file in the project is for.
2. What each code file does, where it is used, and how it connects to the rest of the system.

This report focuses on the active application source files and project configuration. It intentionally excludes generated or vendor-managed folders such as:

- `frontend/node_modules/`
- `frontend/dist/`
- `build/node_modules/`
- `tmp/`
- exported presentation artifacts in `outputs/`

It also treats very small marker files like empty `__init__.py` files as structural files rather than logic-heavy files.

---

## 2. High-Level Architecture

RoadAssist is a full-stack roadside-assistance platform with three major layers:

- **Frontend**: React + Vite single-page application in `frontend/`
- **Backend**: FastAPI REST API in `backend/app/`
- **Database**: PostgreSQL + PostGIS schema, functions, triggers, seed data, and update scripts in `database/`

### Main functional flows

- **Owner flow**:
  - register/login
  - search nearby mechanics on a map
  - search spare parts inventory
  - create roadside service requests
  - schedule appointments
  - manage vehicles and owner profile
  - see request history and rate completed jobs

- **Mechanic flow**:
  - register/login
  - maintain mechanic profile and availability
  - see open requests in range
  - accept, start, and complete jobs
  - manage spare parts inventory
  - manage booked appointments
  - view dashboard analytics and map-based dispatch info

- **Admin flow**:
  - see system-wide analytics
  - inspect owners and mechanics
  - deactivate accounts
  - review operational metrics such as revenue, job funnel, appointments, and alerts

### Request/response path

The typical technical path is:

1. A React page calls an API helper from `frontend/src/api/endpoints.js`
2. That helper uses the Axios client from `frontend/src/api/client.js`
3. The request reaches a FastAPI route in `backend/app/routers/`
4. The route validates input using a Pydantic schema in `backend/app/schemas/`
5. The route reads or writes SQLAlchemy models in `backend/app/models/`
6. The database enforces structure, triggers, procedures, and geospatial logic from `database/schema.sql`

---

## 3. Root-Level Files and Folders

### `README.md`

This is the main project introduction. It explains:

- what the application does
- how the repo is organized
- how to run backend and frontend locally
- how the database should be initialized
- recommended production hosting split

This file is mainly for onboarding developers or evaluators.

### `DEPLOYMENT.md`

This deployment guide describes how the app should be deployed in production. It is used as operational documentation for hosting setup, environment variables, and deployment sequence.

### `DEMO_CHECKLIST.md`

This file is a demo/use-case checklist. It is not runtime code. Its purpose is to help someone test or present the application consistently.

### `docker-compose.yml`

This file defines a three-service local stack:

- `db`: PostGIS-enabled PostgreSQL
- `backend`: FastAPI app in Python
- `frontend`: Vite React development server

It is used for local containerized development and gives the quickest way to run the full stack together.

### `RoadAssist_Project_Report.md`

This is the previously generated project report. It is documentation, not executable logic.

### `database/`

This folder contains the database schema, seed data, and later update scripts. It is the authoritative source of the platform’s relational design and many business rules.

### `backend/`

This contains the FastAPI server, SQLAlchemy models, authentication logic, routers, schemas, and deployment config for the backend service.

### `frontend/`

This contains the React application, route components, shared UI components, API integration layer, and Vite/Tailwind configuration.

### `build/`, `outputs/`, `tmp/`

These folders contain presentation generation artifacts, scratch files, or exported assets. They are not part of the active product runtime.

---

## 4. Database Layer

## 4.1 `database/schema.sql`

This is the most important database file in the project. It creates the full production-style schema for RoadAssist.

It is responsible for:

- table creation
- enum creation
- indexes
- PostGIS support
- stored procedures
- triggers
- materialized views
- row-level security and supporting DB-side workflow logic

This is where the deeper platform behavior lives, for example:

- geospatial mechanic search
- part inventory support
- job acceptance stored procedure (`sp_accept_job`)
- low-stock alerts
- review-triggered rating updates
- mechanic dashboard materialized view

The backend depends heavily on this schema being present.

## 4.2 `database/seed.sql`

This inserts demo data into the schema. It is used for:

- local development
- demos
- testing the UI with realistic data
- showing geospatial search, appointments, jobs, alerts, and ratings

Without this file, the UI would still work structurally, but many dashboards and lists would look empty.

## 4.3 `database/live_update_2026_04_owner_profile_vehicle.sql`

This appears to be a live migration/update script related to owner profile and vehicle support. It exists to patch a running database without rebuilding from scratch.

## 4.4 `database/live_update_2026_04_mechanic_deadlines.sql`

This update script adds or adjusts mechanic-side deadline support. It is related to requested completion windows and deadline-based workflow tracking.

## 4.5 `database/live_update_2026_04_request_costs.sql`

This update script patches request pricing/cost fields. It supports the estimate/final-cost workflow used by mechanics.

## 4.6 `database/live_update_2026_04_engagement.sql`

This script introduces or updates engagement-related features such as appointments and chat support.

## 4.7 `database/live_update_2026_04_chat_request_refs.sql`

This script adds request-reference support to chat records, allowing messages to be tied back to a specific service request.

---

## 5. Backend Service

## 5.1 Backend Deployment and Runtime Files

### `backend/requirements.txt`

This file defines Python dependencies. Important packages include:

- `fastapi`: API framework
- `uvicorn`: ASGI server
- `sqlalchemy`: ORM/database layer
- `asyncpg`: async PostgreSQL driver
- `geoalchemy2`: PostGIS/geospatial SQL support
- `python-jose`: JWT token handling
- `passlib` and `bcrypt`: password hashing
- `pydantic` and `pydantic-settings`: validation and settings

This file is used during backend installation and deployment.

### `backend/runtime.txt`

This file specifies the Python runtime version for some platforms such as Render/Railway-style deployment.

### `backend/Procfile`

This defines the process startup command in Procfile-based environments. It tells the platform how to run the FastAPI application.

### `backend/render.yaml`

This file is infrastructure/deployment config for Render-style hosting. It usually describes service creation, environment settings, or build/deploy instructions.

---

## 5.2 Backend Entry and Core Infrastructure

### `backend/app/main.py`

This is the FastAPI entry point.

What it does:

- creates the FastAPI app
- loads settings
- adds CORS middleware
- registers all routers
- exposes health endpoints

Where it is used:

- `uvicorn app.main:app`
- deployment startup
- OpenAPI/docs generation

Why it matters:

- this is the backend composition root
- every route becomes active here

### `backend/app/db/session.py`

This file defines:

- database URL normalization
- SQLAlchemy async engine
- async session factory
- declarative base class
- `get_db()` dependency

What it is used for:

- every router that needs DB access depends on `get_db`
- all models inherit from `Base`

Important detail:

- it normalizes SSL-related connection parameters and handles Supabase-specific connection settings

### `backend/app/core/config.py`

This file defines the application settings object using `BaseSettings`.

It handles:

- `DATABASE_URL`
- JWT config
- environment mode
- app title/version
- allowed CORS origins

Where it is used:

- backend startup
- security module
- DB session initialization

### `backend/app/core/security.py`

This file implements authentication and authorization helpers.

Main responsibilities:

- hash passwords
- verify passwords
- create JWT access tokens
- decode JWT tokens
- load current user from token
- enforce role-based access with `require_role`

Where it is used:

- `auth.py` for login/register
- all protected routers
- role-restricted features like admin, mechanic-only, and owner-only routes

This file is the main security boundary of the backend.

---

## 5.3 Backend Models

These files define the data model used by SQLAlchemy. They map Python classes to database tables.

### `backend/app/models/user.py`

Defines the `User` table.

Main fields:

- identity: `id`, `name`, `email`
- credentials: `password_hash`
- contact/profile: `phone`, `gender`, address fields
- authorization: `role`
- lifecycle: `is_active`, timestamps

Relationships:

- one optional mechanic profile
- many vehicles
- many service requests as owner
- many reviews as author

Used by:

- authentication
- ownership checks
- profile editing
- relationship joins across almost all business flows

### `backend/app/models/mechanic.py`

Defines the `Mechanic` table.

Main fields:

- `user_id` linking mechanic to base user account
- PostGIS `location`
- `address`, `specialization`, `work_hours`
- supported vehicle types
- availability status
- aggregate review data

Relationships:

- one user
- many spare parts
- many service requests
- many alerts
- many reviews

Used by:

- nearby mechanic search
- dashboards
- appointments
- inventory ownership

### `backend/app/models/vehicle.py`

Defines vehicles owned by owners.

Fields include:

- owner reference
- make/model/year
- license plate
- vehicle/fuel type
- color and notes

Used by:

- service request creation
- appointment scheduling
- owner garage/profile features

### `backend/app/models/service_request.py`

Defines two tables:

- `ServiceRequest`
- `JobUpdate`

`ServiceRequest` represents the main roadside job record.

Important fields:

- owner, mechanic, vehicle foreign keys
- problem description
- request status
- owner location
- requested completion hours
- deadline
- estimate/final cost
- timestamps

`JobUpdate` stores the status history of a request.

Why this file is critical:

- it models the core business workflow from request creation to completion
- the mechanic dispatch and owner history screens depend heavily on it

### `backend/app/models/spare_part.py`

Defines the `SparePart` table.

Main fields:

- mechanic owner
- part name/number
- quantity
- threshold
- price
- compatible vehicle types

Used by:

- mechanic inventory page
- owner part search
- low-stock alert generation

### `backend/app/models/review.py`

Defines:

- `Review`
- `Alert`

`Review` stores owner ratings after completed jobs.

Important constraint:

- `request_id` is unique, so one request can only receive one review

`Alert` stores mechanic-facing alerts such as low stock or system/request events.

Used by:

- owner rating flow
- mechanic dashboard alerts
- admin unresolved alert views

### `backend/app/models/engagement.py`

Defines:

- `Appointment`
- `ChatMessage`

`Appointment` handles future booking-based service requests.

`ChatMessage` supports owner-mechanic messaging, optionally linked to a request.

Although some chat UI has been removed from frontend screens, the data model and routes still exist in the backend.

### `backend/app/models/__init__.py`

This aggregates imports for model discovery and makes the models package easier to use.

---

## 5.4 Backend Schemas

These files define Pydantic request/response models used for validation and API serialization.

### `backend/app/schemas/auth.py`

Contains:

- `RegisterRequest`
- `LoginRequest`
- `TokenResponse`
- `UserOut`
- `ProfileUpdateRequest`

Purpose:

- validates auth inputs
- structures auth outputs
- enforces basic password rules

Used by:

- `auth.py`

### `backend/app/schemas/mechanic.py`

Contains response/update models for mechanic-facing data:

- mechanic self profile
- public mechanic profile
- nearby mechanic search row
- update payload
- dashboard payload

Used by:

- `mechanics.py`
- mechanic dashboard and search pages in frontend

### `backend/app/schemas/parts.py`

Contains:

- create/update payloads for spare parts
- part inventory response model
- search and suggestion models

Used by:

- `parts.py`
- owner part search
- mechanic inventory management

### `backend/app/schemas/requests.py`

Contains the service request and review schemas:

- request creation payload
- status update payload
- request summary/detail output
- job update output
- review create/output

Used by:

- `requests.py`
- owner history
- mechanic dispatch/job update flow
- review submission

### `backend/app/schemas/engagement.py`

Contains appointment and chat schemas:

- availability slot model
- appointment create/update/output
- chat create/output

Used by:

- `engagement.py`
- appointment screens
- any remaining chat flows

### `backend/app/schemas/__init__.py`

This is empty and exists to mark the folder as a package.

---

## 5.5 Backend Routers

These files define the actual API endpoints.

### `backend/app/routers/auth.py`

Handles authentication and user self-profile routes.

Endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`

Important logic:

- auto-creates a placeholder mechanic profile if a user registers as a mechanic
- generates JWTs on login/register

Used by:

- login/register frontend pages
- navbar/profile editing
- auth context bootstrap

### `backend/app/routers/mechanics.py`

Handles mechanic discovery and mechanic self-management.

Main features:

- geospatial search for nearby mechanics
- mechanic self-profile retrieval
- public mechanic detail retrieval
- mechanic dashboard analytics
- mechanic self-profile update

Important implementation detail:

- uses PostGIS `ST_DWithin` and `ST_Distance` for nearby search
- dashboard supports a time-range parameter and aggregates jobs/inventory

Used by:

- owner search page
- mechanic profile page
- mechanic dashboard
- navbar mechanic profile panel

### `backend/app/routers/parts.py`

Handles parts inventory and owner-facing part search.

Main features:

- fuzzy-ish part matching and suggestion
- nearby inventory search across mechanics
- mechanic inventory CRUD

Interesting technical detail:

- search uses custom scoring based on normalization, singularization, prefix checks, substring checks, and `SequenceMatcher`

Used by:

- owner part search in `Search.jsx`
- mechanic inventory screen

### `backend/app/routers/vehicles.py`

Handles owner vehicle CRUD.

Main features:

- list my vehicles
- add vehicle
- update vehicle
- delete vehicle

Used by:

- owner garage
- navbar vehicle panel
- request/appointment vehicle selection

### `backend/app/routers/requests.py`

This is one of the most important files in the backend.

It handles:

- service request creation
- listing service requests
- open-request browsing for mechanics
- owner request history summary
- detailed request fetch
- mechanic status transitions
- job update timeline
- review submission
- mechanic alert listing/resolution

Important technical behaviors:

- uses SQL text queries for rich joined outputs
- uses stored procedure `sp_accept_job` for atomic request acceptance
- enforces valid status transitions
- auto-calculates final cost if needed
- refreshes the mechanic dashboard materialized view after completion
- exposes owner review capability once a job is complete

Used by:

- owner search/request flow
- mechanic jobs and dashboard flows
- owner history/review flow

### `backend/app/routers/engagement.py`

Handles appointment scheduling and chat-style engagement.

Main features:

- mechanic appointment slot calculation from work hours
- appointment creation
- appointment listing
- appointment updates
- message thread retrieval
- message sending
- inbox summaries

Interesting logic:

- parses mechanic work-hour strings into actual daily time windows
- supports both request-scoped and non-request-scoped chat records

Used by:

- owner scheduling flow
- mechanic appointment management
- any remaining message features

### `backend/app/routers/admin.py`

This is the admin analytics/control plane.

Main features:

- time-windowed analytics summary
- revenue and request volume trends
- leaderboard and low-stock reporting
- appointment summaries
- unresolved alerts
- latest requests
- all mechanics/all owners listing
- account deactivation

Technical strength:

- performs many analytics queries directly in SQL using CTEs, filtered counts, trend bucketing, and aggregate calculations

Used by:

- admin page

### `backend/app/routers/__init__.py`

This is an empty package marker.

---

## 6. Frontend Application

## 6.1 Frontend Build and Config Files

### `frontend/package.json`

Defines frontend dependencies and scripts.

Main runtime stack:

- React
- React Router
- Axios
- Leaflet/React-Leaflet
- Lucide icons

Main scripts:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

### `frontend/package-lock.json`

Dependency lockfile. Ensures reproducible installs.

### `frontend/vite.config.js`

Vite configuration file. Used during development and production build.

### `frontend/tailwind.config.js`

Tailwind configuration controlling theme scanning and Tailwind behavior.

### `frontend/postcss.config.js`

Connects Tailwind and Autoprefixer into the CSS build pipeline.

### `frontend/eslint.config.js`

JavaScript/React linting configuration used to keep frontend code style and quality consistent.

### `frontend/vercel.json`

Vercel deployment config for the frontend.

### `frontend/index.html`

HTML shell into which the React app mounts.

### `frontend/README.md`

Frontend-specific usage or setup notes.

### `frontend/public/favicon.svg`

Browser favicon asset.

### `frontend/public/icons.svg`

Shared icon asset file used by the frontend.

### `frontend/src/assets/hero.png`

Static visual asset used in the frontend for branding or landing-page presentation.

### `frontend/src/assets/react.svg`, `frontend/src/assets/vite.svg`

Default/tooling assets from the Vite scaffold. They are not central to app logic.

### `frontend/src/App.css`

Global app-specific styles including decorative visual treatments and page-level styles used by the React UI.

### `frontend/src/index.css`

The main CSS entry file, usually containing Tailwind directives and project-wide base styling.

---

## 6.2 Frontend Bootstrapping and Shared Layers

### `frontend/src/main.jsx`

This is the frontend entry point.

What it does:

- creates the React root
- wraps the app with `AuthProvider`
- loads global CSS

### `frontend/src/App.jsx`

This is the route composition root of the frontend.

What it does:

- registers all routes
- enforces role-based route protection
- redirects users to the correct landing screen depending on role
- keeps `Navbar` mounted across the app

This file is the frontend equivalent of backend `main.py`.

### `frontend/src/context/AuthContext.jsx`

This file manages authentication state in the browser.

Responsibilities:

- store token and user in `localStorage`
- login/register via API
- refresh user profile from backend
- logout and clear local auth state

Used by:

- route protection
- navbar
- login/register pages
- any component that needs current user data

### `frontend/src/api/client.js`

This is the Axios base client.

What it does:

- sets API base URL from `VITE_API_URL`
- automatically attaches bearer token
- handles `401` responses by clearing auth and redirecting to login

Every frontend API call passes through this file.

### `frontend/src/api/endpoints.js`

This is a thin API function layer on top of Axios.

Purpose:

- gives named functions for every backend endpoint
- centralizes route strings
- keeps page components cleaner

Used by:

- almost every page and some shared components

### `frontend/src/lib/formatters.js`

Contains small display helper functions:

- USD currency formatting
- km-to-miles formatting

Used throughout dashboards, search cards, jobs, inventory, and admin views.

### `frontend/src/components/UI.jsx`

Contains small reusable visual primitives:

- `StatusBadge`
- `Card`
- `Spinner`
- `EmptyState`

Used widely across the frontend for consistency.

### `frontend/src/components/Navbar.jsx`

This is a large shared shell component.

It does much more than navigation:

- displays role-aware navigation links
- hosts owner profile panel
- hosts owner vehicles/history quick panels
- hosts mechanic profile panel
- supports inline editing of profile and vehicles

This file is effectively a hybrid of:

- top navigation
- profile manager
- lightweight workspace drawer

It is used on almost every page because `App.jsx` renders it outside the route switch.

---

## 6.3 Frontend Pages

### `frontend/src/pages/Login.jsx`

Owner/mechanic/admin sign-in screen.

What it does:

- collects email/password
- calls `AuthContext.login`
- redirects based on returned role
- shows a polished branded login experience

Where used:

- `/login`

### `frontend/src/pages/Register.jsx`

Registration screen.

What it does:

- collects account info
- lets user choose role
- calls `AuthContext.register`
- redirects after successful signup

Where used:

- `/register`

### `frontend/src/pages/Search.jsx`

This is the largest and most important owner-facing screen.

It combines multiple subsystems:

- nearby mechanic search
- pickup location selection
- map visualization
- part search
- selected mechanic details
- request creation modal
- appointment scheduling modal
- owner garage
- owner service history
- owner appointment management
- owner review submission for completed requests

Why it is so large:

- it acts as the primary owner workspace rather than just a search page

Major technical responsibilities:

- geolocation and address suggestion
- Leaflet map management
- radius filtering
- dynamic mechanic list rendering
- request and appointment modal orchestration
- owner vehicle CRUD integration
- owner history filtering and review submission

Where used:

- `/search`

### `frontend/src/pages/MechanicProfile.jsx`

Dedicated owner-facing mechanic detail page.

What it does:

- loads public mechanic profile
- loads mechanic inventory
- shows route line from owner to mechanic if location exists
- supports copy/share style interactions

Where used:

- `/mechanics/:mechanicId`

### `frontend/src/pages/MyRequests.jsx`

Legacy or simplified owner request history page.

What it does:

- lists service requests
- expands into job-update timeline
- lets owner submit reviews on completed requests

Where used:

- `/my-requests`

Note:

- much of the owner-history experience has also been moved into `Search.jsx`

### `frontend/src/pages/Vehicles.jsx`

Simplified owner vehicle management page.

What it does:

- list vehicles
- add vehicle
- delete vehicle

Where used:

- `/vehicles`

Note:

- a richer vehicle management flow also exists inside `Navbar.jsx` and `Search.jsx`

### `frontend/src/pages/Dashboard.jsx`

Main mechanic dashboard.

What it does:

- loads mechanic summary, alerts, open requests, assigned jobs, parts, and appointments
- shows a dispatch board
- shows a service-zone map
- supports availability toggle
- shows filtered top metrics
- supports accept/start/complete job flows
- shows inventory health and alerts

This page acts as a real-time mechanic control center.

Where used:

- `/dashboard`

### `frontend/src/pages/Inventory.jsx`

Mechanic inventory management screen.

What it does:

- loads mechanic’s parts
- computes low stock / out of stock / total inventory value
- supports add, edit, delete part actions

Where used:

- `/inventory`

### `frontend/src/pages/Jobs.jsx`

Mechanic job management workspace.

What it does:

- shows open dispatchable requests
- shows accepted jobs
- shows in-progress jobs
- shows completed jobs
- shows appointment queue and appointment register
- supports estimate/final-cost dialogs and request status transitions

Important note:

- message-related options were progressively removed from this page, so it now focuses on jobs and appointments only

Where used:

- `/jobs`

### `frontend/src/pages/Admin.jsx`

Admin dashboard and management workspace.

What it does:

- fetches system analytics
- displays request funnel and revenue trends
- shows request volume, leaderboard, low-stock issues, alerts, appointments
- lists owners and mechanics
- allows account deactivation

This is the operational oversight screen for the platform.

Where used:

- `/admin`

---

## 7. How the Main Code Pieces Work Together

## 7.1 Authentication chain

- `Login.jsx` or `Register.jsx` calls `AuthContext`
- `AuthContext` calls `frontend/src/api/endpoints.js`
- that uses Axios client in `client.js`
- backend route `auth.py` validates user
- `security.py` hashes/verifies password and creates JWT
- token returns to browser and is stored in `localStorage`

## 7.2 Nearby mechanic search

- owner page `Search.jsx` sends lat/lng/radius to `getNearbyMechanics`
- backend `mechanics.py` runs a PostGIS search query
- data returns with distance, rating, address, availability
- frontend renders list cards and map markers

## 7.3 Service request lifecycle

- owner creates request from `Search.jsx` via `createRequest`
- backend `requests.py` inserts `ServiceRequest` and initial `JobUpdate`
- mechanic sees it in `Dashboard.jsx` or `Jobs.jsx`
- mechanic accepts, starts, and completes it through `updateRequestStatus`
- backend enforces valid transitions and writes `JobUpdate` history
- owner later sees the request in history and can submit a review

## 7.4 Appointment lifecycle

- owner schedules appointment in `Search.jsx`
- backend `engagement.py` validates and inserts `Appointment`
- mechanic manages appointment in `Jobs.jsx`
- owner manages booked services in `Search.jsx`

## 7.5 Inventory and alerts

- mechanic edits parts in `Inventory.jsx`
- backend `parts.py` writes `SparePart` rows
- DB triggers in schema create low-stock alerts
- alerts surface in `Dashboard.jsx` and `Admin.jsx`

## 7.6 Admin analytics

- admin page calls `getAnalytics`
- backend `admin.py` runs summary and trend SQL
- frontend renders operational dashboards, cards, and tables

---

## 8. Most Critical Files in the Project

If someone needs to understand the project quickly, the most important files are:

- `database/schema.sql`
- `backend/app/main.py`
- `backend/app/core/security.py`
- `backend/app/db/session.py`
- `backend/app/routers/requests.py`
- `backend/app/routers/mechanics.py`
- `backend/app/routers/engagement.py`
- `frontend/src/App.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/api/endpoints.js`
- `frontend/src/pages/Search.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Jobs.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/components/Navbar.jsx`

These files collectively explain the app’s:

- routing
- auth model
- main business logic
- database integration
- owner workspace
- mechanic workspace
- admin workspace

---

## 9. Summary

RoadAssist is not a toy CRUD app. Its codebase combines:

- role-based authentication
- geospatial querying
- inventory and part search
- job lifecycle tracking
- appointment scheduling
- review/rating workflows
- alerting
- analytics dashboards

The backend is organized in a clean FastAPI style:

- `models` for data structure
- `schemas` for validation
- `routers` for API logic
- `core` for security/config
- `db` for database setup

The frontend is organized around role-specific pages and a shared API/context layer:

- owner workspace around `Search.jsx`
- mechanic workspace around `Dashboard.jsx`, `Inventory.jsx`, `Jobs.jsx`
- admin workspace around `Admin.jsx`

The database layer is especially important because several business rules are enforced there through:

- stored procedures
- triggers
- materialized views
- PostGIS functions

That makes the project technically rich and suitable for a strong academic or professional technical discussion.
