# RoadAssist Project Report

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Engineering Design Requirements](#2-engineering-design-requirements)
2.1 [Project Goals (Client Needs)](#21-project-goals-client-needs)
2.2 [Design Objectives](#22-design-objectives)
2.3 [Design Specifications and Constraints](#23-design-specifications-and-constraints)
3. [Scope of Work](#3-scope-of-work)
3.1 [Deliverables](#31-deliverables)
4. [Design Methodology](#4-design-methodology)
4.1 [Conceptual, Logical and Physical Design](#41-conceptual-logical-and-physical-design)
4.2 [Final Design Details and Specifications](#42-final-design-details-and-specifications)
5. [Implementation](#5-implementation)
6. [Conclusions and Recommendations](#6-conclusions-and-recommendations)

## 1. Problem Statement
Roadside vehicle breakdowns create a time-critical problem for vehicle owners. In many practical situations, a stranded driver must identify a trustworthy mechanic, verify whether the required part is available, communicate the fault clearly, and track service progress while under stress. Traditional approaches rely on phone calls, manual searching, or informal contacts, which are slow, inconsistent, and difficult to monitor.

RoadAssist addresses this problem by providing a location-aware digital platform that connects stranded vehicle owners with nearby mechanics and supports the full roadside assistance workflow. The project integrates geospatial mechanic discovery, spare-part inventory search, service request lifecycle tracking, appointments, direct chat, and administrative analytics into one system.

The core engineering challenge is not only to build a booking interface, but to design a reliable data-driven platform that can:

- locate available mechanics within a configurable radius,
- associate requests with the correct owner, vehicle, and mechanic,
- support real-time operational workflows,
- maintain consistent job status history,
- automate operational checks such as low-stock alerts and rating updates, and
- provide oversight tools for platform administrators.

The resulting system is implemented as a full-stack web application with a React frontend, a FastAPI backend, and a PostgreSQL/PostGIS database.

## 2. Engineering Design Requirements
The engineering design requirements for RoadAssist were derived from the needs of three primary stakeholders: vehicle owners, mechanics, and administrators. The system needed to be responsive, location-aware, operationally reliable, and structured around a clear workflow from request creation to job completion.

### 2.1 Project Goals (Client Needs)
The project goals can be summarized as the following client needs:

1. Vehicle owners must be able to quickly find mechanics near their current or entered location.
2. Owners must be able to see whether relevant spare parts are available before committing to a request.
3. Owners must be able to submit a service request tied to a selected vehicle and, when desired, to a specific mechanic.
4. Mechanics must be able to view incoming and assigned jobs, accept requests, update statuses, and manage inventory.
5. The platform must preserve a complete service history, including job progress and customer reviews.
6. Administrators must be able to monitor platform activity, mechanic availability, request metrics, and inventory alerts.
7. The system must support a practical deployment split suitable for modern web hosting, with the frontend, backend, and database deployed independently.

### 2.2 Design Objectives
To satisfy the client needs, the following design objectives were established:

- Build a multi-role platform supporting `owner`, `mechanic`, and `admin` users.
- Use geospatial search to rank mechanics by proximity and availability.
- Provide a normalized relational database with strong referential integrity.
- Automate repetitive operational tasks through database triggers and stored procedures.
- Ensure secure access through JWT-based authentication and role-based authorization.
- Provide a user-friendly web interface with role-specific pages and guarded routes.
- Support analytics and oversight through views, materialized views, and reporting endpoints.
- Keep the system modular so that frontend, backend, and database can evolve independently.

### 2.3 Design Specifications and Constraints
The implemented project reflects the following specifications and constraints.

#### Functional specifications
- User registration and login with role awareness.
- Nearby mechanic search using latitude, longitude, and configurable radius.
- Vehicle management for owners.
- Part search and part suggestions across nearby mechanics.
- Service request creation, acceptance, progress updates, completion, and review submission.
- Appointment scheduling and availability lookup.
- Owner-mechanic chat and inbox features.
- Mechanic dashboard, inventory management, and alerts.
- Admin analytics dashboard with request funnel, earnings trends, low-stock alerts, and user oversight.

#### Non-functional specifications
- Web-based access through a modern browser.
- Fast query performance for proximity search and request listing.
- Data consistency for status changes and inventory deductions.
- Separation of concerns between presentation, API, and persistence layers.
- Extensibility for future features such as notifications or payment integration.

#### Technology constraints
- Backend implemented in FastAPI and SQLAlchemy async stack.
- Frontend implemented in React with Vite, React Router, Axios, Leaflet, and Tailwind CSS.
- Database implemented in PostgreSQL with PostGIS enabled.
- Geospatial logic depends on PostGIS geography columns and spatial indexes.
- Some platform features such as stored procedures, triggers, materialized views, and row-level security make a simple serverless-only deployment unsuitable.

#### Project constraints and practical limitations
- The recommended production architecture is split deployment: frontend on Vercel, backend on Render or Railway, and database on PostgreSQL/PostGIS.
- The frontend currently uses OpenStreetMap/Nominatim for location search and browser geolocation when available.
- Known practical risk: map markers in the frontend are noted as approximate in some deployment notes when raw coordinates are not exposed in the exact way the UI expects.
- Real-time behavior is implemented through periodic refresh and status updates rather than persistent WebSocket infrastructure.
- Demo readiness depends on seeded data and environment variables being configured correctly.

## 3. Scope of Work
The scope of work for RoadAssist includes the design and implementation of a complete prototype platform for roadside assistance coordination. The project scope covers user interaction, operational workflows, database logic, and deployment readiness.

Included in scope:

- requirements-driven full-stack application design,
- multi-role authentication and authorization,
- geospatial mechanic discovery,
- roadside request workflow management,
- inventory and parts search,
- appointments and chat,
- analytics and monitoring dashboards,
- seeded demonstration dataset,
- local Docker-based development setup, and
- production deployment guidance.

Excluded or only partially addressed:

- payment gateway integration,
- push notifications or SMS alerts,
- live GPS tracking of mechanics en route,
- external insurance provider integrations,
- native mobile apps,
- advanced fraud detection, and
- horizontally scaled real-time messaging infrastructure.

### 3.1 Deliverables
The RoadAssist repository contains the following deliverables:

1. A FastAPI backend under `backend/app/` with modular routers for authentication, mechanics, parts, requests, vehicles, engagement, and admin analytics.
2. A React frontend under `frontend/src/` with role-specific pages for owner, mechanic, and admin workflows.
3. A PostgreSQL/PostGIS schema under `database/schema.sql` containing tables, indexes, triggers, stored procedures, views, materialized views, and row-level security policies.
4. Seed data under `database/seed.sql` for demonstration accounts, mechanics, owners, vehicles, and inventory.
5. Docker-based local bring-up through `docker-compose.yml`.
6. Deployment guidance through `README.md`, `DEPLOYMENT.md`, and environment templates.
7. Demo support assets including a structured end-to-end checklist in `DEMO_CHECKLIST.md`.

## 4. Design Methodology
RoadAssist was developed using a layered engineering methodology that moved from understanding the roadside assistance problem to defining the entities, workflows, and deployment architecture needed to solve it. The design process can be interpreted in three levels: conceptual design, logical design, and physical design.

### 4.1 Conceptual, Logical and Physical Design
#### Conceptual design
At the conceptual level, the project models RoadAssist as a service coordination platform involving three main actors:

- Owner: requests help, manages vehicles, checks part availability, tracks requests, books appointments, chats with mechanics, and leaves reviews.
- Mechanic: exposes a service profile, publishes inventory, receives requests, updates job status, resolves alerts, and manages appointments.
- Admin: supervises users, tracks system performance, and observes operational metrics.

The core business objects are:

- users,
- mechanics,
- vehicles,
- spare parts,
- service requests,
- job updates,
- reviews,
- alerts,
- appointments, and
- chat messages.

The conceptual workflow is:

1. An owner logs in and provides a location.
2. The system returns nearby available mechanics ranked by distance and rating.
3. The owner optionally searches for a required part across nearby mechanics.
4. The owner submits a request tied to a vehicle and optionally a chosen mechanic.
5. A mechanic accepts the request and updates the status from `requested` to `accepted`, `in_progress`, and `completed`.
6. The system records all status transitions, parts used, and final cost.
7. The owner reviews the mechanic after completion.
8. The administrator monitors activity and health across the platform.

#### Logical design
The logical design maps the conceptual entities into a normalized relational model.

Key relationships include:

- `users` to `mechanics`: one-to-one for users registered as mechanics.
- `users` to `vehicles`: one-to-many for owner vehicle records.
- `mechanics` to `spare_parts`: one-to-many for inventory.
- `owners` and `mechanics` to `service_requests`: each request belongs to one owner and may be assigned to one mechanic.
- `service_requests` to `job_updates`: one-to-many audit trail of lifecycle events.
- `service_requests` to `reviews`: one-to-one review after completion.
- `service_requests` to `service_request_parts`: one-to-many record of parts consumed by a completed job.
- `mechanics` to `alerts`: one-to-many low-stock or system alerts.
- `owners` and `mechanics` to `appointments`: future scheduled service interactions.
- `owners` and `mechanics` to `chat_messages`: many-message thread over time.

The design uses enumerated types to enforce business rules, including:

- `user_role`,
- `vehicle_type`,
- `request_status`,
- `appointment_status`,
- `chat_sender_role`, and
- `alert_type`.

This improves data integrity by preventing invalid states such as unsupported user roles or request statuses.

The logical design also embeds business rules at the database level:

- low-stock alerts are automatically generated when part quantity drops below threshold,
- mechanic ratings are recalculated after review insertion,
- job acceptance is handled through a stored procedure for transactional consistency,
- completed jobs can deduct inventory and calculate total cost through a stored procedure, and
- row-level security policies express visibility boundaries for mechanics and owners.

#### Physical design
The physical design is implemented as a three-tier system.

##### Presentation layer
The frontend is a single-page application built with React and Vite. It uses:

- `react-router-dom` for navigation and route protection,
- `axios` for API communication,
- `react-leaflet` and `leaflet` for maps and markers,
- `lucide-react` for iconography, and
- Tailwind CSS plus custom styles for the user interface.

Role-specific routes include:

- owner pages such as search, mechanic profile, vehicles, and request history,
- mechanic pages such as dashboard, jobs, and inventory,
- admin analytics and management page.

##### Application layer
The backend is implemented with FastAPI and asynchronous SQLAlchemy. Major routers include:

- `/auth` for registration, login, and user profile updates,
- `/mechanics` for geospatial search and mechanic profile access,
- `/parts` for inventory search, suggestions, and mechanic inventory updates,
- `/requests` for service request creation and lifecycle handling,
- `/vehicles` for owner vehicle CRUD,
- engagement routes for appointments and chat,
- `/admin` for analytics and oversight.

JWT authentication and role restrictions are enforced in the security layer through token creation, decoding, current-user resolution, and `require_role(...)` guards.

##### Data layer
The persistence layer is PostgreSQL with PostGIS. The schema uses:

- geography `POINT` columns for mechanic and owner locations,
- GIST indexes for spatial search,
- GIN text search index for part names,
- audit and status history tables,
- triggers for automation,
- procedures for transactional operations,
- a materialized dashboard view for mechanic summaries, and
- analytics views for admin reporting.

##### Deployment layer
The physical deployment model is explicitly separated:

- frontend deployed independently,
- backend deployed as a Python web service,
- database deployed as PostgreSQL with PostGIS support.

Local development is supported by Docker Compose using:

- `postgis/postgis:16-3.4` for the database,
- `python:3.12-slim` for the backend,
- `node:20-alpine` for the frontend.

### 4.2 Final Design Details and Specifications
The final design combines application-level API logic with database-level guarantees.

#### Authentication and access control
- Registration supports multiple roles and auto-creates a basic mechanic profile when a user registers as a mechanic.
- Login returns a JWT containing `sub` and `role`.
- Protected routes in the frontend redirect users according to role.
- Backend role guards restrict access to owner-only, mechanic-only, and admin-only actions.

#### Geospatial mechanic search
- Mechanic locations are stored as `GEOGRAPHY(POINT, 4326)`.
- Nearby search uses `ST_DWithin` for radius filtering and `ST_Distance` for ranking.
- Mechanics are ordered by shortest distance and highest rating.
- Optional vehicle-type filtering narrows results to mechanics compatible with the owner’s vehicle.

#### Parts discovery and inventory
- Nearby part search combines mechanic proximity with part name relevance scoring.
- Search is enhanced through normalization, token matching, and similarity scoring in the backend.
- Inventory includes quantity, threshold, price, and compatible vehicle types.
- Low-stock conditions generate alerts automatically through a database trigger.

#### Service request lifecycle
- Requests include owner, mechanic, vehicle, problem description, location, status, optional completion deadline, and cost fields.
- Each new request creates an initial `job_updates` record.
- Open request browsing supports both untargeted jobs and jobs directed to a specific mechanic.
- Acceptance is modeled as a transactional database procedure.
- Completion can deduct inventory and write total cost through a stored procedure.
- History endpoints present summarized owner-facing service records.

#### Appointments and chat
- The system supports future appointment scheduling with status tracking.
- Availability slots are derived from a mechanic’s working hours and current bookings.
- Chat threads connect owners and mechanics and can optionally reference a service request.

#### Analytics and dashboards
- Mechanics have access to a dashboard view summarizing job counts, earnings, inventory conditions, and alerts.
- Admins can inspect totals, funnel progression, earnings trends, request volumes, leaderboard rankings, low-stock items, appointments, alerts, and user-role distribution.
- A materialized view improves mechanic dashboard access for repeated summary queries.

#### Data integrity and automation
- Triggers maintain `updated_at` fields.
- Review insertion recalculates mechanic rating and review count.
- Audit triggers capture insert, update, and delete snapshots for critical tables.
- Row-level security policies formalize ownership and mechanic visibility rules at the database level.

## 5. Implementation
RoadAssist has been implemented as a working integrated prototype.

### Backend implementation
The backend uses FastAPI 0.111 with asynchronous SQLAlchemy and supporting libraries such as `asyncpg`, `geoalchemy2`, `python-jose`, `passlib`, and `pydantic`. The API is documented through FastAPI’s built-in OpenAPI interface and exposes `/docs` and `/redoc`.

Important implemented backend modules include:

- `main.py` for app creation, CORS configuration, health endpoints, and router registration,
- `core/config.py` for environment-driven settings,
- `core/security.py` for password hashing, JWT handling, and role enforcement,
- router modules for each functional domain,
- model and schema modules for ORM and validation contracts.

The backend reflects a modular design in which each route group corresponds to a business domain, improving maintainability and testing clarity.

### Frontend implementation
The frontend uses React 19, Vite 8, React Router 7, Axios, Tailwind CSS, and Leaflet. The application contains protected routes that redirect users to owner, mechanic, or admin experiences after authentication.

Key implemented pages include:

- `Search.jsx`: owner search workspace with geolocation, pickup suggestions, nearby mechanics, part search, request creation, owner history, messaging, appointments, and vehicle management support.
- `MechanicProfile.jsx`: public-facing owner view of an individual mechanic.
- `Vehicles.jsx` and `MyRequests.jsx`: owner vehicle and history functions.
- `Dashboard.jsx`: mechanic dashboard with summary metrics, alerts, map, active jobs, open requests, and appointment information.
- `Inventory.jsx` and `Jobs.jsx`: mechanic operations interfaces.
- `Admin.jsx`: analytics-heavy admin dashboard for network monitoring and user management.

The frontend structure demonstrates that the project goes beyond a simple CRUD system and instead supports several coordinated operational workflows.

### Database implementation
The database is one of the strongest engineering aspects of the project. The schema includes:

- 10+ core relational tables,
- domain enums,
- spatial and text indexes,
- reusable update triggers,
- low-stock and rating automation,
- stored procedures for request acceptance and completion,
- analytics and search views,
- a materialized view for mechanic summaries,
- row-level security policies.

This design places important business guarantees close to the data, reducing the chance of application-level inconsistency.

### Seed and demo implementation
The project includes demonstration data representing Richmond, Virginia. The seed file provisions:

- multiple admin, mechanic, and owner accounts,
- user addresses,
- vehicles,
- mechanic inventory,
- sample requests and operational records.

The repository also includes a demo checklist describing an end-to-end scenario:

1. owner searches nearby mechanics,
2. owner checks part availability,
3. owner submits a request,
4. mechanic accepts and completes the job,
5. owner tracks history and submits a review,
6. admin displays analytics.

### Deployment implementation
The repository includes both local and production-oriented deployment support.

- `docker-compose.yml` starts the database, backend, and frontend for local development.
- `backend/render.yaml` supports deployment of the FastAPI service.
- `frontend/vercel.json` supports SPA routing in Vercel deployment.
- README and deployment guides recommend hosting the frontend, backend, and database as separate services due to PostGIS and database feature requirements.

Overall, the implementation demonstrates a realistic full-stack architecture rather than a purely academic mock-up.

## 6. Conclusions and Recommendations
RoadAssist successfully addresses the core problem of roadside assistance coordination by delivering a working full-stack platform that connects owners, mechanics, and administrators through a unified workflow. The project’s main strengths are its clear multi-role design, geospatial mechanic search, integrated parts discovery, database-backed workflow tracking, and strong use of PostgreSQL/PostGIS features such as triggers, stored procedures, views, and row-level security.

From an engineering perspective, the project is particularly strong in the database and workflow design. Instead of treating the database as passive storage, the solution uses it as an active part of the system’s reliability model. This makes RoadAssist more robust than many student projects that place all logic in the application layer.

### Recommendations
The following enhancements would strengthen the platform further:

1. Add real-time notifications using WebSockets, push notifications, email, or SMS so owners and mechanics receive immediate status updates.
2. Integrate payment and invoicing to complete the commercial service flow.
3. Add live mechanic tracking and route estimation for active roadside jobs.
4. Expand testing with automated backend API tests, frontend component tests, and integration tests around stored procedures and geospatial queries.
5. Improve observability with structured logging, metrics, and error dashboards for production monitoring.
6. Add file upload support for vehicle photos, damage images, and invoices.
7. Improve inventory intelligence with demand forecasting and restock recommendations.
8. Strengthen chat into a richer support channel with read receipts and notification indicators.
9. Extend admin functions with audit log viewers and moderation workflows.
10. Prepare a mobile-first or native mobile client for field usability.

### Final conclusion
RoadAssist is a well-scoped and technically meaningful project that demonstrates practical software engineering across frontend development, backend API design, geospatial computing, and advanced relational database features. It provides a solid foundation for a production-style roadside assistance platform and is strong enough to present as a complete course or capstone project report.
