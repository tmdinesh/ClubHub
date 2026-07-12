# Auth Gate for Event Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require authentication to view the event listing homepage and individual event detail pages.

**Architecture:** Fix `ProtectedRoute` redirect to `/login` (not `/`), wrap two frontend routes, add `get_current_user` dependency to two backend endpoints. No new abstractions.

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
