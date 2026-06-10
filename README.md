# CCOps — College Club Event Operations Platform

A production-grade modular monolith for managing the full lifecycle of college club events: from creation and approval through registration, attendance, certificates, finance, and feedback.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Testing Without Google OAuth (Dev Login)](#testing-without-google-oauth-dev-login)
- [Local Development (Without Docker)](#local-development-without-docker)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Seed Data](#seed-data)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Key Workflows](#key-workflows)
- [Service Ports](#service-ports)
- [Going to Production](#going-to-production)

---

## Architecture Overview

```
                        ┌─────────────────────────────────┐
                        │          nginx :80               │
                        │  /api/* → backend:8000           │
                        │  /*     → frontend:3000          │
                        │  /media → static files           │
                        └──────────┬──────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                                       ▼
    ┌─────────────────────┐              ┌─────────────────────┐
    │  FastAPI backend    │              │  React/Vite SPA     │
    │  Python 3.12        │              │  TypeScript         │
    │  SQLAlchemy async   │              │  nginx:alpine       │
    │  Alembic            │              │  :3000              │
    │  :8000              │              └─────────────────────┘
    └──────┬──────────────┘
           │
  ┌────────┼────────────────┐
  ▼        ▼                ▼
┌──────┐ ┌──────┐ ┌───────────────┐
│  PG  │ │Redis │ │   RabbitMQ    │
│ :5432│ │:6379 │ │ :5672 / 15672 │
└──────┘ └──────┘ └───────────────┘
```

The backend is a **modular monolith**: each domain (auth, events, registration, etc.) lives in its own package under `app/modules/` with its own models, schemas, services, repos, and routes. Modules communicate via in-process service calls and asynchronous domain events published to RabbitMQ.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111 + Uvicorn |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 15 |
| Migrations | Alembic 1.13 |
| Cache / locks | Redis 7 (hiredis) |
| Message broker | RabbitMQ 3.12, aio-pika |
| Auth | Google OAuth2 + JWT (python-jose) |
| Validation | Pydantic v2 + pydantic-settings |
| PDF generation | reportlab |
| QR codes | qrcode + Pillow |
| Password hashing | passlib (bcrypt) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Routing | React Router v6 |
| Server state | TanStack React Query v5 |
| Client state | Zustand v4 (persisted) |
| Styling | TailwindCSS 3 + shadcn/ui (CVA) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| HTTP client | Axios (with refresh-token interceptor) |

### Infrastructure
| Service | Image |
|---|---|
| Reverse proxy | nginx:1.25-alpine |
| Database | postgres:15-alpine |
| Cache | redis:7-alpine |
| Message broker | rabbitmq:3.12-management-alpine |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 and Docker Compose v2 (`docker compose`)
- For local development without Docker: Python 3.12+, Node.js 20+, a running PostgreSQL 15, Redis 7, and RabbitMQ 3.12 instance

---

## Quick Start (Docker)

This is the recommended way to run the full platform.

**1. Clone and enter the project**

```bash
git clone <repo-url> ccops
cd ccops
```

**2. Create your environment file**

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see [Environment Variables](#environment-variables)). At minimum, set:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=a-random-string-at-least-32-characters-long
ALLOWED_EMAIL_DOMAINS=youruniversity.edu
```

**3. Build and start all services**

```bash
docker compose up -d --build
```

This will:
- Build the backend (Python 3.12 multi-stage) and frontend (Node 20 + nginx) images
- Start postgres, redis, and rabbitmq
- Run `alembic upgrade head` to apply all migrations
- Start the FastAPI server on port 8000 (internal)
- Start the nginx SPA server on port 3000 (internal)
- Start nginx on port 80 as the public entry point

**4. Check all services are healthy**

```bash
docker compose ps
```

Expected output — all services `Up` or `Up (healthy)`:

```
project-postgres-1   Up (healthy)
project-redis-1      Up (healthy)
project-rabbitmq-1   Up (healthy)
project-backend-1    Up
project-frontend-1   Up
project-nginx-1      Up
```

**5. (Optional) Seed the database with demo data**

```bash
docker compose exec backend python scripts/seed.py
```

This creates:
- 1 super-admin user: `admin@<your-domain>`
- 1 faculty advisor: `faculty@<your-domain>`
- 2 clubs: Computer Science Club, Arts & Culture Club
- 3 events: 1 DRAFT, 1 PUBLISHED (with 5 registrations), 1 COMPLETED

**6. Open the app**

| URL | Description |
|---|---|
| `http://localhost` | Frontend SPA |
| `http://localhost/api/docs` | Interactive API docs (Swagger UI) |
| `http://localhost/api/redoc` | ReDoc API docs |
| `http://localhost/api/health` | Health check endpoint |
| `http://localhost:15672` | RabbitMQ management UI (user: ccops / ccops_pass) |

---

## Testing Without Google OAuth (Dev Login)

The platform ships with a `POST /api/auth/dev-login` endpoint that is only active when `ENVIRONMENT=development` (the default). It creates or upserts a user by email and returns a real JWT token pair — no Google account or OAuth app required.

### Using Swagger UI

1. Open `http://localhost/api/docs`
2. Find **POST /auth/dev-login** under the `auth (dev)` tag
3. Click **Try it out**, set your desired email, name, and role, then **Execute**
4. Copy the `access_token` from the response
5. Click the **Authorize** button (top right), paste the token, click **Authorize**

All subsequent requests in the docs will now be authenticated.

### Using curl

```bash
curl -s -X POST http://localhost/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@college.edu", "name": "Dev Admin", "role": "SUPER_ADMIN"}'
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Use the token in subsequent requests:
```bash
curl http://localhost/api/auth/me \
  -H "Authorization: Bearer eyJ..."
```

### Available roles for testing

| Role | What you can test |
|---|---|
| `PARTICIPANT` | Event discovery, registration, QR code, certificates, feedback |
| `ATTENDANCE_TEAM` | QR scanning at checkpoints |
| `FINANCE_LEAD` | Budget management, expense uploads |
| `EVENT_COORDINATOR` | Registration list, announcements, attendance |
| `EVENT_HEAD` | Full event management, certificates, analytics |
| `CLUB_ADMIN` | Create events, assign organizers |
| `FACULTY_ADVISOR` | Approve / reject events pending review |
| `SUPER_ADMIN` | Everything, including user role changes and event deletion |

> **Note:** Dev login respects the `ALLOWED_EMAIL_DOMAINS_STR` setting. If your `.env` has `ALLOWED_EMAIL_DOMAINS_STR=college.edu`, the email you use must end in `@college.edu`.

> **Security:** This endpoint returns 403 in any environment other than `development`. It is safe to deploy to staging/production without removing the code.

---

## Local Development (Without Docker)

Use this if you want hot-reload for rapid iteration.

### Backend

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure env (point DATABASE_URL/REDIS_URL/RABBITMQ_URL to local services)
cp ../.env.example .env
# Edit .env: set DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/ccops

# Run migrations
alembic upgrade head

# Start the development server with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API is now at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite dev server with HMR
npm run dev
```

Frontend is now at `http://localhost:5173`.

> When running locally, set the `VITE_API_BASE_URL` in a `frontend/.env.local` file if your backend is not at the default location:
> ```
> VITE_API_BASE_URL=http://localhost:8000
> ```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Async PostgreSQL DSN (`postgresql+asyncpg://...`) |
| `TEST_DATABASE_URL` | No | — | Separate DB for tests |
| `REDIS_URL` | Yes | — | Redis DSN (`redis://...`) |
| `RABBITMQ_URL` | Yes | — | AMQP DSN (`amqp://...`) |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | Yes | `http://localhost/api/auth/google/callback` | OAuth callback URL |
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs (≥32 chars) |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `ALLOWED_EMAIL_DOMAINS` | No | `college.edu` | Comma-separated list of allowed email domains |
| `ENVIRONMENT` | No | `development` | `development` / `staging` / `production` |
| `DEBUG` | No | `true` | Enables debug mode |
| `CORS_ORIGINS` | No | `http://localhost,...` | Comma-separated CORS-allowed origins |
| `FILE_STORAGE_BACKEND` | No | `local` | `local` or `s3` |
| `LOCAL_STORAGE_PATH` | No | `/app/media` | Upload directory for local storage |
| `AWS_ACCESS_KEY_ID` | No | — | S3 credentials (only for `FILE_STORAGE_BACKEND=s3`) |
| `AWS_SECRET_ACCESS_KEY` | No | — | S3 credentials |
| `AWS_REGION` | No | `ap-south-1` | S3 region |
| `S3_BUCKET_NAME` | No | — | S3 bucket name |
| `POSTGRES_USER` | No | `ccops` | Postgres user (docker-compose only) |
| `POSTGRES_PASSWORD` | No | `ccops_pass` | Postgres password (docker-compose only) |
| `POSTGRES_DB` | No | `ccops` | Postgres database name (docker-compose only) |
| `RABBITMQ_DEFAULT_USER` | No | `ccops` | RabbitMQ user (docker-compose only) |
| `RABBITMQ_DEFAULT_PASS` | No | `ccops_pass` | RabbitMQ password (docker-compose only) |

### Setting up Google OAuth2

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add to **Authorized redirect URIs**: `http://localhost/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** into `.env`

---

## Database Migrations

Migrations are managed with Alembic. The migration history lives in `backend/alembic/versions/`.

```bash
# Apply all pending migrations (runs automatically on docker compose up)
alembic upgrade head

# Create a new migration after changing models
alembic revision --autogenerate -m "add column X to table Y"

# Roll back one migration
alembic downgrade -1

# Show current migration state
alembic current

# Show full migration history
alembic history --verbose
```

---

## Seed Data

The seed script (`backend/scripts/seed.py`) populates the database with a minimal working dataset for development and demos.

```bash
# Via Docker (recommended)
docker compose exec backend python scripts/seed.py

# Locally (from backend/ directory with .venv active)
python scripts/seed.py
```

What gets created:

| Type | Details |
|---|---|
| Super admin | `admin@<first-allowed-domain>` |
| Faculty advisor | `faculty@<first-allowed-domain>` |
| Clubs | Computer Science Club, Arts & Culture Club |
| Events | 1× DRAFT, 1× PUBLISHED (5 sample registrations), 1× COMPLETED |

---

## Running Tests

### Backend (pytest)

```bash
cd backend
source .venv/bin/activate   # or without venv if using system Python

# Run all tests
pytest

# Run with coverage report
pytest --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth.py -v

# Run a specific test
pytest tests/test_events.py::test_valid_transitions -v
```

All backend tests use `AsyncMock` / `MagicMock` — no real database or Redis required.

Test files:

| File | Coverage |
|---|---|
| `tests/test_auth.py` | Domain validation, token generation, Redis storage, token revocation, inactive users (11 tests) |
| `tests/test_events.py` | State machine transitions, role-based create/edit/delete, faculty approval (8 tests) |
| `tests/test_registration.py` | Closed event guard, duplicate registration, waitlist, waitlist promotion on cancel (4 tests) |
| `tests/test_attendance.py` | Invalid QR, unconfirmed registration, duplicate scan via Redis lock, successful scan (4 tests) |
| `tests/test_certificates.py` | Code verification, bulk generation, unique code format (5 tests) |

### Frontend (Vitest)

```bash
cd frontend

# Run all tests once
npm test

# Run in watch mode
npm run test:watch

# TypeScript type checking
npm run typecheck
```

Test files:

| File | Coverage |
|---|---|
| `src/store/auth.store.test.ts` | Zustand store: login, logout, token persistence (5 tests) |
| `src/components/EventCard.test.tsx` | Card rendering, status badge, date formatting, truncation (9 tests) |
| `src/pages/dashboard/CertificateVault.test.tsx` | Certificate list, empty state, download link (4 tests) |
| `src/pages/manage/AttendanceDashboard.test.tsx` | Present/registered counts, attendance rate display (3 tests) |

---

## Project Structure

```
project/
├── .env                        # Local environment variables (gitignored)
├── .env.example                # Template for environment variables
├── docker-compose.yml          # All 6 services with health checks
├── nginx/
│   └── nginx.conf              # Reverse proxy: /api/* → backend, /* → frontend
│
├── backend/
│   ├── Dockerfile              # Multi-stage: builder (gcc/pip) + runtime (non-root ccops user)
│   ├── requirements.txt        # Pinned Python dependencies
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py              # Async-compatible Alembic env
│   │   └── versions/           # Migration files
│   ├── scripts/
│   │   └── seed.py             # Database seed script
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_events.py
│   │   ├── test_registration.py
│   │   ├── test_attendance.py
│   │   └── test_certificates.py
│   └── app/
│       ├── main.py             # FastAPI app, lifespan, router registration
│       ├── core/
│       │   ├── config.py       # Pydantic BaseSettings with @lru_cache singleton
│       │   ├── database.py     # Async engine, session factory, get_db dependency
│       │   ├── redis.py        # Connection pool, get_redis dependency
│       │   └── rabbitmq.py     # Publisher, Consumer base class, DLQ wiring
│       ├── shared/
│       │   ├── base_model.py   # DeclarativeBase with UUID PK, timestamps
│       │   ├── enums.py        # All StrEnum types (15 enums)
│       │   ├── exceptions.py   # AppException hierarchy → HTTP responses
│       │   └── rbac.py         # Permission matrix, require_permission(), require_role()
│       └── modules/
│           ├── auth/           # Google OAuth2, JWT, refresh tokens, audit log
│           ├── events/         # CRUD, state machine, faculty approval, organizers
│           ├── registration/   # Register, waitlist, QR token, cancel + promote
│           ├── teams/          # Team creation, invitations, member management
│           ├── attendance/     # QR scan, Redis idempotency lock, checkpoints
│           ├── certificates/   # Template management, PDF generation, verification
│           ├── finance/        # Budget, categories, expense tracking
│           ├── feedback/       # Forms, questions, NPS scoring
│           ├── analytics/      # Cross-module event analytics aggregation
│           ├── announcements/  # Targeted announcements with channel routing
│           ├── notifications/  # Per-user notifications, RabbitMQ consumer
│           ├── sponsorship/    # Sponsor tracking per event
│           └── volunteers/     # Volunteer positions and applications
│
└── frontend/
    ├── Dockerfile              # Multi-stage: node builder + nginx:alpine runtime
    ├── nginx-spa.conf          # SPA routing on :3000, 1-year cache for assets
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # Routes, ProtectedRoute wrapper
        ├── main.tsx
        ├── test-setup.ts       # jsdom stubs: localStorage, ResizeObserver
        ├── lib/
        │   └── api.ts          # Axios instance, 401 refresh-and-retry interceptor
        ├── store/
        │   └── auth.store.ts   # Zustand + persist (localStorage key: ccops-auth)
        ├── components/
        │   ├── Layout.tsx
        │   ├── EventCard.tsx
        │   └── ui/             # shadcn/ui primitives (badge, button, card, …)
        └── pages/
            ├── Login.tsx
            ├── EventDiscovery.tsx
            ├── EventDetail.tsx
            ├── CertificateVerify.tsx   # Public — no auth required
            ├── dashboard/
            │   ├── Dashboard.tsx
            │   ├── MyEvents.tsx
            │   ├── MyTeams.tsx
            │   ├── CertificateVault.tsx
            │   └── Notifications.tsx
            ├── manage/                 # Organizer views (/manage/:eventId/*)
            │   ├── EventOverview.tsx
            │   ├── RegistrationList.tsx
            │   ├── AttendanceDashboard.tsx
            │   ├── CertificatesManage.tsx
            │   ├── FinancePage.tsx
            │   ├── AnnouncementsPage.tsx
            │   └── VolunteersPage.tsx
            ├── faculty/
            │   └── FacultyApprovals.tsx
            └── admin/
                └── AdminDashboard.tsx
```

---

## API Reference

The full interactive API docs are available at **`http://localhost/api/docs`** when the platform is running.

### Base URL

All API requests go through nginx at `/api/`. The backend strips the prefix.

```
http://localhost/api/<endpoint>
```

### Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

Access tokens expire after 30 minutes. Use the refresh endpoint to obtain a new pair.

### Core Endpoints

#### Auth (`/auth`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Initiate Google OAuth2 flow |
| `GET` | `/auth/google/callback` | OAuth2 callback, returns token pair |
| `POST` | `/auth/refresh` | Exchange refresh token for new token pair |
| `POST` | `/auth/logout` | Revoke refresh token |
| `GET` | `/auth/me` | Get current user profile |

#### Events (`/events`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/events` | List published events (paginated, filterable) |
| `POST` | `/events` | Create event (requires `event:create`) |
| `GET` | `/events/{id}` | Get event detail |
| `PATCH` | `/events/{id}` | Update event (DRAFT only) |
| `DELETE` | `/events/{id}` | Soft-delete event (SUPER_ADMIN only) |
| `POST` | `/events/{id}/submit` | Submit for faculty approval |
| `POST` | `/events/{id}/approve` | Approve event (FACULTY_ADVISOR) |
| `POST` | `/events/{id}/reject` | Reject with comment (FACULTY_ADVISOR) |
| `POST` | `/events/{id}/publish` | Publish approved event |
| `POST` | `/events/{id}/complete` | Mark event complete |
| `POST` | `/events/{id}/organizers` | Assign organizer role |

#### Registration (`/events/{id}/registrations`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/events/{id}/registrations` | Register for event (auto-waitlists when full) |
| `GET` | `/events/{id}/registrations` | List registrations (organizer) |
| `GET` | `/events/{id}/registrations/mine` | Get own registration |
| `POST` | `/events/{id}/registrations/{reg_id}/cancel` | Cancel (promotes next waitlisted) |
| `GET` | `/events/{id}/registrations/{reg_id}/qr` | Get QR code image |

#### Attendance (`/events/{id}/attendance`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/events/{id}/attendance/checkpoints` | List checkpoints |
| `POST` | `/events/{id}/attendance/checkpoints` | Create checkpoint |
| `POST` | `/events/{id}/attendance/scan` | Scan QR token (Redis lock prevents duplicates) |
| `GET` | `/events/{id}/attendance/summary` | Present / absent / rate stats |

#### Certificates (`/events/{id}/certificates`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/certificates/verify/{code}` | Verify certificate by code (public) |
| `POST` | `/events/{id}/certificates/generate` | Bulk-generate PDFs for attendees |
| `GET` | `/events/{id}/certificates` | List certificates |
| `GET` | `/certificates/mine` | Own certificates |

#### Finance (`/events/{id}/finance`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/events/{id}/finance/budget` | Budget with actuals by category |
| `POST` | `/events/{id}/finance/budget` | Set budget |
| `POST` | `/events/{id}/finance/expenses` | Upload expense with bill |
| `GET` | `/events/{id}/finance/expenses` | List expenses |

#### Feedback (`/events/{id}/feedback`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/events/{id}/feedback/forms` | Create feedback form |
| `POST` | `/events/{id}/feedback/forms/{form_id}/respond` | Submit response |
| `GET` | `/events/{id}/feedback/forms/{form_id}/results` | Get results with NPS |

#### Analytics (`/events/{id}/analytics`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/events/{id}/analytics` | Full event analytics (registrations, attendance, NPS, finance) |

#### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List user notifications |
| `PATCH` | `/notifications/{id}/read` | Mark notification read |
| `POST` | `/events/{id}/announcements` | Send announcement |
| `GET` | `/clubs` | List clubs |
| `POST` | `/events/{id}/teams` | Create team |
| `GET` | `/health` | Health check |

---

## Roles & Permissions

The platform uses a 9-level role hierarchy with fine-grained permissions.

| Role | Description |
|---|---|
| `PARTICIPANT` | Default role. Can discover events, register, join teams, view own certificates. |
| `ATTENDANCE_TEAM` | Scan QR codes at checkpoints. |
| `VOLUNTEER_LEAD` | Manage volunteer positions and applications. |
| `FINANCE_LEAD` | Manage budgets and expenses for assigned events. |
| `EVENT_COORDINATOR` | Manage registrations, attendance, and announcements for assigned events. |
| `EVENT_HEAD` | Full event management including teams, certificates, and analytics. |
| `CLUB_ADMIN` | Create events, manage organizers, and access club-level data. |
| `FACULTY_ADVISOR` | Approve or reject events submitted for review. |
| `SUPER_ADMIN` | Full platform access including user management and event deletion. |

Roles are assigned per-user in the database. The `require_permission("resource:action")` FastAPI dependency enforces access at the route level, and `require_role(UserRole.X, ...)` guards role-restricted endpoints.

---

## Key Workflows

### Event Lifecycle

```
DRAFT → PENDING_APPROVAL → PUBLISHED → COMPLETED → ARCHIVED
              ↓
           (rejected)
              ↓
           DRAFT
```

- Events must be in **DRAFT** to be edited.
- Submitting for review requires at least one organizer and a `max_participants` value.
- Faculty advisors must approve before an event can be published.
- Rejection requires a comment and returns the event to DRAFT.

### Registration & Waitlist

1. User registers → `CONFIRMED` if `count_confirmed < max_participants`, else `WAITLISTED`.
2. On cancellation of a CONFIRMED registration → the first WAITLISTED registration (by `registered_at`) is promoted to CONFIRMED and issued a new QR token.

### Attendance Scanning

1. Organizer creates one or more **checkpoints** (e.g., Entry, Lunch, Session 2).
2. Attendance team scans QR codes at each checkpoint.
3. The backend validates the JWT-encoded QR token, confirms the registration is CONFIRMED, then uses a 5-second Redis `SETNX` lock to prevent duplicate scans in concurrent conditions.

### Certificate Generation

1. Organizer uploads a PDF template and defines placeholder positions.
2. After event completion, bulk generation creates a PDF per attendee, fills in their name and a unique code (`CERT-{EVENT_SHORT}-{8-hex-chars}`).
3. Certificates are publicly verifiable at `/verify/{code}`.

### Authentication Flow

1. User visits `/auth/google` → redirected to Google consent screen.
2. Google redirects to `/auth/google/callback?code=...`.
3. Backend exchanges code for Google profile, validates email domain against `ALLOWED_EMAIL_DOMAINS_STR`.
4. Issues a JWT access token (30 min) and a refresh token (7 days, stored as SHA-256 hash in Redis).
5. Frontend stores both tokens in localStorage via Zustand persist.
6. Axios interceptor transparently refreshes the access token on 401, batching concurrent requests to avoid a refresh storm.

---

## Service Ports

| Service | Port | Notes |
|---|---|---|
| nginx (public entry) | `80` | All traffic enters here |
| PostgreSQL | `5432` | Exposed for local tools (e.g. pgAdmin, DBeaver) |
| Redis | `6379` | Exposed for local inspection (`redis-cli`) |
| RabbitMQ AMQP | `5672` | Exposed for local consumers |
| RabbitMQ Management UI | `15672` | Web UI — default credentials: `ccops` / `ccops_pass` |
| Backend (internal) | `8000` | Not exposed externally; accessed via nginx `/api/` |
| Frontend (internal) | `3000` | Not exposed externally; accessed via nginx `/` |

---

## Useful Commands

```bash
# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service after a code change
docker compose restart backend

# Rebuild and restart (after Dockerfile or dependency changes)
docker compose up -d --build backend

# Open a shell in the backend container
docker compose exec backend bash

# Connect to the database
docker compose exec postgres psql -U ccops -d ccops

# Flush Redis
docker compose exec redis redis-cli FLUSHALL

# Stop all services (preserves volumes)
docker compose down

# Stop all services and delete all data volumes
docker compose down -v
```

---

## Going to Production

This checklist covers everything needed to harden the platform from a development setup to a production deployment. Work through each section in order.

### 1. Secrets and environment

Replace every placeholder value in `.env` with real, randomly generated secrets. Never reuse development values.

```bash
# Generate a strong JWT secret
python3 -c "import secrets; print(secrets.token_hex(32))"

# Generate strong database and RabbitMQ passwords
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

Set these in your production `.env` (or your secret manager — see step 8):

```env
ENVIRONMENT=production
DEBUG=false

JWT_SECRET=<64-char random hex>

POSTGRES_USER=ccops
POSTGRES_PASSWORD=<strong password>
POSTGRES_DB=ccops

RABBITMQ_DEFAULT_USER=ccops
RABBITMQ_DEFAULT_PASS=<strong password>

GOOGLE_CLIENT_ID=<real client id>
GOOGLE_CLIENT_SECRET=<real client secret>
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

ALLOWED_EMAIL_DOMAINS=youruniversity.edu
CORS_ORIGINS=https://yourdomain.com
```

### 2. Google OAuth2 for production

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. Edit your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add: `https://yourdomain.com/api/auth/google/callback`
4. Remove the `http://localhost` redirect URI
5. Under **Authorized JavaScript origins**, add: `https://yourdomain.com`
6. Go to **OAuth consent screen** and set the app to **Production** (not Testing) — otherwise only test users can log in

### 3. TLS / HTTPS

All production traffic must be served over HTTPS. The current nginx config listens on port 80. Add TLS termination in front of it.

**Option A — Caddy (simplest, auto-renews certificates):**

Replace the nginx service in `docker-compose.yml` with Caddy:

```yaml
caddy:
  image: caddy:2-alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
    - media_data:/app/media:ro
  depends_on:
    - backend
    - frontend
```

`Caddyfile`:
```
yourdomain.com {
    reverse_proxy /api/* backend:8000
    reverse_proxy /* frontend:3000
    file_server /media/* {
        root /app
    }
}
```

**Option B — nginx with Let's Encrypt (Certbot):**

```bash
# Install certbot on the host
certbot certonly --standalone -d yourdomain.com

# Mount certs into the nginx container and update nginx.conf to listen on 443
```

**Option C — Cloud load balancer:**

Terminate TLS at an AWS ALB, GCP Load Balancer, or Cloudflare proxy. Keep the internal nginx config as-is.

### 4. Disable dev-only endpoints

Set `ENVIRONMENT=production` in `.env`. The `/api/auth/dev-login` endpoint automatically returns 403 — no code changes needed.

Verify it is blocked:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://yourdomain.com/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@yourdomain.com", "name": "test", "role": "PARTICIPANT"}'
# Expected: 403
```

Also disable the Swagger UI in production by adding to `app/main.py`:

```python
app = FastAPI(
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)
```

### 5. Database hardening

**Use a managed database (recommended):** AWS RDS, Google Cloud SQL, or Supabase. Remove the `postgres` service from `docker-compose.yml` and point `DATABASE_URL` at the managed instance.

If running your own PostgreSQL:

```sql
-- Create a dedicated user with minimal privileges
CREATE USER ccops_app WITH PASSWORD 'strong-password';
GRANT CONNECT ON DATABASE ccops TO ccops_app;
GRANT USAGE ON SCHEMA public TO ccops_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ccops_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ccops_app;
```

Remove the postgres port mapping from `docker-compose.yml` so it is not exposed on the host:
```yaml
# postgres:
#   ports:
#     - "5432:5432"   ← remove this in production
```

Enable automated backups (daily minimum, 30-day retention):
```bash
# Example: pg_dump to S3 via a cron job
pg_dump -Fc ccops | aws s3 cp - s3://your-bucket/backups/ccops-$(date +%Y%m%d).dump
```

### 6. Redis hardening

Set a strong password and disable dangerous commands:

```bash
# In your Redis config or docker-compose command:
redis-server \
  --requirepass "strong-redis-password" \
  --rename-command FLUSHALL "" \
  --rename-command FLUSHDB "" \
  --rename-command DEBUG "" \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru
```

Update `REDIS_URL` to include the password:
```env
REDIS_URL=redis://:strong-redis-password@redis:6379/0
```

Remove the Redis port mapping from `docker-compose.yml`:
```yaml
# redis:
#   ports:
#     - "6379:6379"   ← remove this in production
```

### 7. RabbitMQ hardening

Remove the management UI port and default guest account:

```yaml
rabbitmq:
  # ports:              ← remove both port mappings in production
  #   - "5672:5672"
  #   - "15672:15672"
```

The `ccops` user created via env vars has admin privileges. For tighter control, configure a custom `rabbitmq.conf` that limits the user to only the vhosts and queues it needs.

### 8. Secret management

Do not store production secrets in `.env` files on disk. Use a secrets manager:

| Platform | Tool |
|---|---|
| AWS | Secrets Manager or Parameter Store; inject via ECS task definitions |
| GCP | Secret Manager; inject via Cloud Run or GKE secrets |
| Kubernetes | `kubectl create secret`; mount as env vars |
| Self-hosted | HashiCorp Vault or Doppler |

For Docker Compose on a single server, use [Docker secrets](https://docs.docker.com/engine/swarm/secrets/) or restrict `.env` file permissions:
```bash
chmod 600 .env
chown root:root .env
```

### 9. File storage

The default `FILE_STORAGE_BACKEND=local` stores uploads in `/app/media` inside the container. This is unsuitable for production because:
- Files are lost if the container is recreated (unless a named volume is used)
- Files are not replicated across multiple backend instances

Switch to S3-compatible object storage:

```env
FILE_STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ap-south-1
S3_BUCKET_NAME=ccops-media-prod
```

Configure the bucket:
- Block all public access except for certificate PDFs (which should be public-read)
- Enable versioning and lifecycle rules to expire temp files
- Use a CDN (CloudFront or Cloudflare) in front of the bucket for certificate downloads

### 10. Logging and monitoring

**Structured logging:** Add `structlog` or configure uvicorn's `--log-config` to emit JSON logs so they are parseable by log aggregators.

**Log aggregation:** Ship container logs to Datadog, Grafana Loki, or AWS CloudWatch:
```yaml
# docker-compose.yml — add to backend and frontend services
logging:
  driver: "awslogs"
  options:
    awslogs-group: "/ccops/production"
    awslogs-region: "ap-south-1"
    awslogs-stream-prefix: "backend"
```

**Health check monitoring:** Set up an uptime monitor (Better Uptime, UptimeRobot, or Pingdom) on `https://yourdomain.com/api/health`.

**Application metrics:** The `/api/health` endpoint returns basic status. For full metrics, add `prometheus-fastapi-instrumentator` to `requirements.txt`:
```python
# in app/main.py
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
```

Then scrape `/metrics` with Prometheus and visualise in Grafana.

**Error tracking:** Add Sentry for exception capture:
```bash
pip install sentry-sdk[fastapi]
```
```python
import sentry_sdk
sentry_sdk.init(dsn="https://...", environment=settings.ENVIRONMENT)
```

### 11. Horizontal scaling

The backend is stateless (session state is in Redis, files in S3). To run multiple backend instances:

1. Remove the `expose` directive and add a `deploy.replicas` block (Docker Swarm) or use Kubernetes Deployments
2. Ensure all instances share the same `REDIS_URL` and `DATABASE_URL`
3. Put a load balancer in front (the nginx config already uses upstream keepalive)

For the RabbitMQ consumer (notifications), ensure only one instance is consuming per queue, or use competing consumers with message acknowledgements — the `Consumer` base class already uses `auto_ack=False`.

### 12. Final pre-launch checklist

```
[ ] ENVIRONMENT=production and DEBUG=false in .env
[ ] All secrets replaced with strong random values
[ ] Google OAuth redirect URI points to production domain
[ ] TLS certificate installed and HTTP redirects to HTTPS
[ ] /api/auth/dev-login returns 403
[ ] Swagger UI (/api/docs) disabled or protected
[ ] Database: no postgres port exposed, backups scheduled
[ ] Redis: password set, FLUSHALL disabled, port not exposed
[ ] RabbitMQ: management UI port not exposed
[ ] File storage switched to S3 (or named volume at minimum)
[ ] Log aggregation configured
[ ] Uptime monitor on /api/health
[ ] Sentry or equivalent error tracking initialised
[ ] CORS_ORIGINS_STR contains only your production domain
[ ] Run full test suite: pytest (backend) + npm test (frontend)
[ ] docker compose up -d --build and verify all services healthy
[ ] smoke test: register, login, create event, check /api/health
```
