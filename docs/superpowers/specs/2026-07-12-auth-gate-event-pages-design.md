# Auth Gate for Event Pages — Design Spec

**Goal:** Require authentication to view the event listing homepage and individual event detail pages.

## Problem

Currently `GET /` (EventDiscovery) and `GET /events/:slug` (EventDetail) are fully public — any visitor can see the event list and event details without logging in. The backend endpoints that power them (`GET /events` and `GET /events/{slug}`) also have no auth requirement.

## Solution

Apply auth gating at both layers:

1. **Frontend** — wrap `/` and `/events/:slug` routes in `ProtectedRoute`, which redirects unauthenticated users to `/login`. Fix `ProtectedRoute`'s redirect from `"/"` to `"/login"` to avoid a circular redirect now that `/` is protected.

2. **Backend** — add `actor: User = Depends(get_current_user)` to `list_events` and `get_event` endpoints so direct API calls without a Bearer token return 401.

## Files Changed

- `frontend/src/App.tsx` — wrap 2 routes in `ProtectedRoute`, fix redirect target in `ProtectedRoute`
- `backend/app/modules/events/routes.py` — add auth dependency to 2 endpoints

## What stays public

- `/login`, `/auth/callback`, `/admin/login`, `/dev-login` — unchanged
- `/verify/:code` (certificate verification) — unchanged
- `/attendance-login`, `/attendance/:eventId`, `/attend` — unchanged

## User flow after change

1. Visitor navigates to `/` → redirected to `/login`
2. Visitor navigates to `/events/some-slug` directly → redirected to `/login`
3. After login, user is returned to intended page (React Router `replace` behaviour)
4. Direct API call to `GET /events` without Bearer token → 401 Unauthorized
5. Direct API call to `GET /events/{slug}` without Bearer token → 401 Unauthorized
