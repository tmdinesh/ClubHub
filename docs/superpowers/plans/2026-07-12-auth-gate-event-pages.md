# Auth Gate for Event Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require authentication to view the event listing homepage and individual event detail pages; gate attendance management endpoints to organizer/staff roles only (no participants).

**Architecture:** Fix `ProtectedRoute` redirect to `/login` (not `/`), wrap two frontend routes, add `get_current_user` to two event endpoints, add a `_require_attendance_access` dep to four unprotected attendance endpoints and replace the bare `get_current_user` on three already-protected attendance endpoints so role enforcement is consistent.

**Tech Stack:** React + React Router (frontend), FastAPI + `get_current_user` dependency (backend), pytest + httpx AsyncClient (backend tests)

---

### Task 1: Fix ProtectedRoute redirect and gate frontend routes

**Files:**
- Modify: `frontend/src/App.tsx:45-48` (ProtectedRoute function) and lines for `/` and `/events/:slug` routes

- [ ] **Step 1: Update ProtectedRoute redirect target**

In `frontend/src/App.tsx`, change the `ProtectedRoute` function from redirecting to `"/"` to redirecting to `"/login"`:

```tsx
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

- [ ] **Step 2: Wrap the homepage route in ProtectedRoute**

Find this line in `App.tsx`:
```tsx
<Route path="/" element={<EventDiscovery />} />
```
Replace with:
```tsx
<Route path="/" element={<ProtectedRoute><EventDiscovery /></ProtectedRoute>} />
```

- [ ] **Step 3: Wrap the event detail route in ProtectedRoute**

Find this line in `App.tsx`:
```tsx
<Route path="/events/:slug" element={<EventDetail />} />
```
Replace with:
```tsx
<Route path="/events/:slug" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
```

- [ ] **Step 4: Verify Login route is still public**

Confirm `App.tsx` still has:
```tsx
<Route path="/login" element={<Login />} />
```
with no `ProtectedRoute` wrapper. If it does, no change needed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: gate event discovery and detail pages behind login"
```

---

### Task 2: Add auth to backend list_events endpoint

**Files:**
- Modify: `backend/app/modules/events/routes.py:75-85`

- [ ] **Step 1: Write a failing integration test for unauthenticated list**

Add this test class to `backend/tests/test_events.py`:

```python
class TestEventRouteAuth:
    @pytest.mark.asyncio
    async def test_list_events_requires_auth(self, client: AsyncClient):
        response = await client.get("/events")
        assert response.status_code == 401
```

Note: `client` fixture is defined in `conftest.py` and provides an `httpx.AsyncClient` pointed at the FastAPI app.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_events.py::TestEventRouteAuth::test_list_events_requires_auth -v
```

Expected: FAIL — currently returns 200 because the endpoint has no auth.

- [ ] **Step 3: Add get_current_user dependency to list_events**

In `backend/app/modules/events/routes.py`, change `list_events` from:

```python
@router.get("", response_model=list[EventOut])
async def list_events(
    status: EventStatus | None = None,
    club_id: UUID | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
    svc: EventService = Depends(_svc),
) -> list[EventOut]:
    events = await svc.list_events(status=status, club_id=club_id, category=category, skip=skip, limit=limit)
    return [_event_out(e) for e in events]
```

To:

```python
@router.get("", response_model=list[EventOut])
async def list_events(
    status: EventStatus | None = None,
    club_id: UUID | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> list[EventOut]:
    events = await svc.list_events(status=status, club_id=club_id, category=category, skip=skip, limit=limit)
    return [_event_out(e) for e in events]
```

(`get_current_user`, `User` are already imported at the top of the file.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_events.py::TestEventRouteAuth::test_list_events_requires_auth -v
```

Expected: PASS — returns 401 for unauthenticated request.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/events/routes.py backend/tests/test_events.py
git commit -m "feat: require auth on GET /events"
```

---

### Task 3: Add auth to backend get_event (by slug) endpoint

**Files:**
- Modify: `backend/app/modules/events/routes.py:178-181`

- [ ] **Step 1: Write a failing integration test for unauthenticated event detail**

Add to the `TestEventRouteAuth` class in `backend/tests/test_events.py`:

```python
    @pytest.mark.asyncio
    async def test_get_event_by_slug_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/some-slug")
        assert response.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_events.py::TestEventRouteAuth::test_get_event_by_slug_requires_auth -v
```

Expected: FAIL — currently returns 404 (slug not found) not 401, meaning auth runs after lookup. After the fix it should 401 before any DB call.

- [ ] **Step 3: Add get_current_user dependency to get_event**

In `backend/app/modules/events/routes.py`, change `get_event` from:

```python
@router.get("/{slug}", response_model=EventOut)
async def get_event(slug: str, svc: EventService = Depends(_svc)) -> EventOut:
    event = await svc.get_event_by_slug(slug)
    return _event_out(event)
```

To:

```python
@router.get("/{slug}", response_model=EventOut)
async def get_event(
    slug: str,
    svc: EventService = Depends(_svc),
    actor: User = Depends(get_current_user),
) -> EventOut:
    event = await svc.get_event_by_slug(slug)
    return _event_out(event)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/test_events.py::TestEventRouteAuth::test_get_event_by_slug_requires_auth -v
```

Expected: PASS — returns 401 for unauthenticated request.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests pass. If any test calls `GET /events` or `GET /events/{slug}` and starts failing with 401, those tests will need a `get_current_user` override in conftest or inline:

```python
from app.modules.auth.deps import get_current_user

app.dependency_overrides[get_current_user] = lambda: _make_user()
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/events/routes.py backend/tests/test_events.py
git commit -m "feat: require auth on GET /events/{slug}"
```

---

### Task 4: Add attendance access guard to attendance management endpoints

Allowed roles: `ATTENDANCE_TEAM`, `CLUB_ADMIN`, `EVENT_HEAD`, `EVENT_COORDINATOR`, `SUPER_ADMIN`, `FACULTY_ADVISOR`, `VOLUNTEER_LEAD`, `FINANCE_LEAD`. `PARTICIPANT` is denied.

**Files:**
- Modify: `backend/app/modules/attendance/routes.py`

- [ ] **Step 1: Write failing tests for unauthenticated and participant access**

Add this test class to `backend/tests/test_attendance.py` (add `from httpx import AsyncClient` to imports if not already present):

```python
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.shared.enums import UserRole
from app.main import app

def _make_user(role: UserRole = UserRole.PARTICIPANT) -> User:
    from uuid import uuid4
    u = User()
    u.id = uuid4()
    u.role = role
    u.email = "test@test.com"
    u.name = "Test"
    u.is_active = True
    u.club_id = None
    return u

class TestAttendanceRouteAuth:
    @pytest.mark.asyncio
    async def test_dashboard_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_dashboard_rejects_participant(self, client: AsyncClient):
        app.dependency_overrides[get_current_user] = lambda: _make_user(UserRole.PARTICIPANT)
        try:
            response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance")
            assert response.status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_checkpoint_stats_requires_auth(self, client: AsyncClient):
        response = await client.get(
            "/events/00000000-0000-0000-0000-000000000001/attendance/checkpoint/00000000-0000-0000-0000-000000000002"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_export_csv_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/attendance/export")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_checkpoints_requires_auth(self, client: AsyncClient):
        response = await client.get("/events/00000000-0000-0000-0000-000000000001/checkpoints")
        assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_attendance.py::TestAttendanceRouteAuth -v
```

Expected: all FAIL — endpoints currently return 200 or 404 with no auth.

- [ ] **Step 3: Add `_require_attendance_access` dep and apply it**

In `backend/app/modules/attendance/routes.py`, add the following after the existing imports (add `ForbiddenError` to the imports from `app.shared.exceptions`):

```python
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError

_ATTENDANCE_ALLOWED = {
    UserRole.ATTENDANCE_TEAM,
    UserRole.CLUB_ADMIN,
    UserRole.EVENT_HEAD,
    UserRole.EVENT_COORDINATOR,
    UserRole.SUPER_ADMIN,
    UserRole.FACULTY_ADVISOR,
    UserRole.VOLUNTEER_LEAD,
    UserRole.FINANCE_LEAD,
}

def _require_attendance_access(actor: User = Depends(get_current_user)) -> User:
    if actor.role not in _ATTENDANCE_ALLOWED:
        raise ForbiddenError("Access denied")
    return actor
```

Then update the four currently-unprotected endpoints on `events_router` to use `_require_attendance_access`:

```python
@events_router.get("/events/{event_id}/attendance", response_model=AttendanceDashboard)
async def dashboard(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> AttendanceDashboard:
    data = await svc.get_dashboard(event_id)
    return AttendanceDashboard(**data)


@events_router.get("/events/{event_id}/attendance/checkpoint/{cp_id}")
async def checkpoint_stats(
    event_id: UUID,
    cp_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> dict:
    return await svc.get_checkpoint_stats(event_id, cp_id)


@events_router.get("/events/{event_id}/attendance/export")
async def export_csv(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> PlainTextResponse:
    csv_data = await svc.export_csv(event_id)
    return PlainTextResponse(csv_data, media_type="text/csv",
                              headers={"Content-Disposition": f"attachment; filename=attendance_{event_id}.csv"})


@events_router.get("/events/{event_id}/checkpoints", response_model=list[CheckpointOut])
async def list_checkpoints(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> list[CheckpointOut]:
    cps = await svc.list_checkpoints(event_id)
    return [CheckpointOut.model_validate(cp) for cp in cps]
```

Also replace the bare `get_current_user` on the three already-protected endpoints so they enforce the same role set:

```python
@events_router.get("/events/{event_id}/attendance/present")
async def present_users(
    event_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> list[dict]:
    return await svc.list_present_users(event_id)


@events_router.post("/events/{event_id}/checkpoints", response_model=CheckpointOut, status_code=201)
async def create_checkpoint(
    event_id: UUID,
    body: CheckpointCreate,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> CheckpointOut:
    cp = await svc.create_checkpoint(event_id, body.name, body.description, body.order)
    return CheckpointOut.model_validate(cp)


@events_router.get("/events/{event_id}/attendance/mass-qr", response_model=MassQRResponse)
async def get_mass_qr(
    event_id: UUID,
    checkpoint_id: UUID,
    svc: AttendanceService = Depends(_svc),
    actor: User = Depends(_require_attendance_access),
) -> MassQRResponse:
    from sqlalchemy import select
    from app.modules.events.models import Event
    result = await svc.repo.db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        from app.shared.exceptions import NotFoundError
        raise NotFoundError("Event", event_id)
    interval = event.mass_qr_interval or 30
    data = svc.generate_mass_qr(event_id, checkpoint_id, interval)
    return MassQRResponse(**data)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_attendance.py::TestAttendanceRouteAuth -v
```

Expected: all PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests pass. If any existing attendance test now gets 401/403, add a `get_current_user` override using `_make_user(UserRole.CLUB_ADMIN)` for that test.

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/attendance/routes.py backend/tests/test_attendance.py
git commit -m "feat: gate attendance management endpoints to staff roles"
```
