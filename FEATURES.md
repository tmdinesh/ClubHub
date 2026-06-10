# CCOps — Feature Reference

Current implemented functionality across backend and frontend.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Events](#2-events)
3. [Registration & Waitlist](#3-registration--waitlist)
4. [Teams](#4-teams)
5. [Attendance](#5-attendance)
6. [Certificates](#6-certificates)
7. [Finance](#7-finance)
8. [Feedback & NPS](#8-feedback--nps)
9. [Announcements](#9-announcements)
10. [Notifications](#10-notifications)
11. [Analytics](#11-analytics)
12. [Role-Based Access Control](#12-role-based-access-control)
13. [Frontend Pages](#13-frontend-pages)

---

## 1. Authentication

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/auth/google/login` | Public | Initiates Google OAuth2 flow |
| `GET` | `/auth/google/callback` | Public | Exchanges OAuth code; redirects to frontend with tokens |
| `POST` | `/auth/refresh` | Authenticated | Rotates access + refresh token pair |
| `POST` | `/auth/logout` | Authenticated | Revokes refresh token in Redis |
| `GET` | `/auth/me` | Authenticated | Returns current user profile |
| `POST` | `/auth/dev-login` | Dev only | Bypass OAuth; create/upsert user by email + role |

### Business Logic

- **Email domain whitelisting** — only `@<ALLOWED_EMAIL_DOMAINS>` addresses can register
- **JWT access tokens** — 30-minute lifetime, signed with `JWT_SECRET`
- **Refresh tokens** — 7-day lifetime, stored as SHA-256 hash in Redis; single-use (rotated on each refresh)
- **Dev login** — only active when `ENVIRONMENT=development`; returns 403 in staging/production

### Frontend Pages

| Route | Description |
|---|---|
| `/login` | Google OAuth button; handles OAuth callback tokens from query params |
| `/auth/callback` | Intermediate page that stores tokens and fetches user profile |
| `/dev-login` | Quick-login buttons for all roles + custom email/role form (dev only) |

---

## 2. Events

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events` | CLUB_ADMIN, SUPER_ADMIN | Create event; auto-generates unique slug |
| `GET` | `/events` | Public | List events; filter by `status`, `club_id`, `category`; paginated |
| `GET` | `/events/assigned` | Organizer roles | List events where current user is an assigned organizer |
| `GET` | `/events/{slug}` | Public | Get event detail by slug |
| `PATCH` | `/events/{event_id}` | CLUB_ADMIN, EVENT_HEAD | Update event metadata (DRAFT status only) |
| `PATCH` | `/events/{event_id}/submit-for-review` | CLUB_ADMIN, EVENT_HEAD | DRAFT → PENDING_APPROVAL; requires `faculty_advisor_id` |
| `POST` | `/events/{event_id}/approve` | FACULTY_ADVISOR, SUPER_ADMIN | PENDING_APPROVAL → PUBLISHED |
| `POST` | `/events/{event_id}/reject` | FACULTY_ADVISOR, SUPER_ADMIN | PENDING_APPROVAL → DRAFT; requires rejection comment |
| `DELETE` | `/events/{event_id}` | SUPER_ADMIN | Soft-delete event |
| `POST` | `/events/{event_id}/organizers` | CLUB_ADMIN | Assign a user as organizer with role + permissions |
| `POST` | `/clubs` | Authenticated | Create a club |
| `GET` | `/clubs` | Public | List all active clubs |

### Event State Machine

```
DRAFT → PENDING_APPROVAL → PUBLISHED → COMPLETED → ARCHIVED
              ↓
          (rejected)
              ↓
           DRAFT
```

- Only **DRAFT** events can be edited
- Submission requires a `faculty_advisor_id` to be set
- Rejection returns the event to DRAFT with a mandatory comment

### Frontend Pages

| Route | Role | Description |
|---|---|---|
| `/` | All | Event discovery — search, filter by category/status, browse published events |
| `/events/:slug` | All | Event detail — description, venue, dates, registration CTA |
| `/club` | CLUB_ADMIN | List all events by status; create event form; submit for review |
| `/organizer` | Organizer roles | List events assigned to current user |
| `/faculty/approvals` | FACULTY_ADVISOR | Pending approval queue; approve/reject with comment modal |
| `/admin` | SUPER_ADMIN | Platform-wide metrics including total events |

---

## 3. Registration & Waitlist

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/register` | PARTICIPANT | Register for event; auto-waitlists when full |
| `GET` | `/events/{event_id}/registrations` | EVENT_COORDINATOR+ | List all registrations for an event |
| `GET` | `/registrations/me` | Authenticated | Current user's registrations across all events |
| `POST` | `/registrations/{reg_id}/cancel` | Owner | Cancel registration; promotes first waitlisted user |
| `GET` | `/registrations/{reg_id}/qr` | Owner | Get QR code image URL (CONFIRMED registrations only) |

### Registration Statuses

| Status | Description |
|---|---|
| `CONFIRMED` | Registered and within capacity |
| `WAITLISTED` | Event full; in queue |
| `CANCELLED` | Cancelled by user |

### Business Logic

- Registration only accepted within `registration_start` / `registration_end` window
- Confirmation is automatic if `count_confirmed < max_participants`; otherwise waitlisted
- On cancellation: first `WAITLISTED` registration (by `registered_at`) is promoted to `CONFIRMED` and issued a new QR token
- QR token is a JWT encoding `{reg_id, event_id}` rendered as a PNG

### Frontend Pages

| Route | Description |
|---|---|
| `/dashboard/events` | User's registrations; QR download for CONFIRMED; cancel button |
| `/manage/:eventId/registrations` | Organizer view — full table, search, filter by status, CSV export |

---

## 4. Teams

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/teams` | PARTICIPANT | Create team; creator becomes team lead |
| `GET` | `/events/{event_id}/teams` | Authenticated | List teams for an event |
| `GET` | `/teams/{team_id}` | Authenticated | Get team details and members |
| `POST` | `/teams/{team_id}/invite` | Team lead | Invite member by email; generates invitation token (7-day expiry) |
| `GET` | `/teams/join/{token}` | Invited user | Accept invitation; email must match token; auto-transitions to READY if min_size met |
| `DELETE` | `/teams/{team_id}/members/{user_id}` | Team lead | Remove a member |
| `POST` | `/teams/{team_id}/submit` | Team lead | Submit team (READY → SUBMITTED) |

### Team Statuses

| Status | Description |
|---|---|
| `FORMING` | Created; below minimum size |
| `READY` | Minimum size reached |
| `SUBMITTED` | Team finalized by lead |
| `DISQUALIFIED` | Removed from consideration |

### Business Logic

- Team automatically transitions `FORMING → READY` when `min_size` is reached
- Invitation tokens expire after 7 days
- Only the team lead can invite, remove members, and submit

### Frontend Pages

| Route | Description |
|---|---|
| `/dashboard/teams` | User's team memberships across events; accept invitation by token input |

---

## 5. Attendance

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/attendance/scan` | ATTENDANCE_TEAM+ | Scan a QR token at a checkpoint; returns result + duplicate flag |
| `POST` | `/events/{event_id}/checkpoints` | EVENT_COORDINATOR+ | Create a checkpoint (name, order) |
| `GET` | `/events/{event_id}/attendance` | EVENT_COORDINATOR+ | Summary stats: registered, present, absent, rate |
| `GET` | `/events/{event_id}/attendance/checkpoint/{cp_id}` | EVENT_COORDINATOR+ | Stats for a specific checkpoint |
| `GET` | `/events/{event_id}/attendance/export` | EVENT_HEAD+ | CSV export of all scan records |

### Business Logic

- QR token decoded and validated (signature + expiry)
- Registration must be `CONFIRMED` to be scanned
- **Duplicate prevention**: Redis `SETNX` lock with 5-second TTL prevents concurrent double-scans at the same checkpoint
- Attendance rate = `(present / registered) × 100`

### Frontend Pages

| Route | Description |
|---|---|
| `/manage/:eventId/attendance` | Live dashboard — registered/present/absent/rate stats; auto-refreshes every 30 seconds; checkpoint breakdown |

---

## 6. Certificates

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/certificate-templates` | EVENT_HEAD+ | Upload a certificate template (type: PARTICIPATION / VOLUNTEER / WINNER / RUNNER_UP) |
| `POST` | `/events/{event_id}/certificates/generate` | EVENT_HEAD+ | Bulk-generate PDFs for a list of recipients |
| `GET` | `/certificates/me` | Authenticated | Current user's certificates |
| `GET` | `/certificates/{cert_id}/download` | Owner | Get PDF download URL |
| `GET` | `/verify/{unique_code}` | Public | Verify certificate by unique code |

### Certificate Types

`PARTICIPATION` · `VOLUNTEER` · `WINNER` · `RUNNER_UP`

### Business Logic

- PDFs generated with **reportlab** on landscape A4
- Each certificate gets a unique code: `CERT-{6-char-abbrev}-{8-hex-chars}`
- Verification endpoint is public — no auth required
- PDF stored at `/media/certificates/{unique_code}.pdf`

### Frontend Pages

| Route | Description |
|---|---|
| `/dashboard/certificates` | Certificate vault — card view per certificate; download + verify links |
| `/verify/:code` | Public verification page — shows recipient, event, type, issued date |
| `/manage/:eventId/certificates` | Generate certificates for attendees; view issued list |

---

## 7. Finance

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/budget` | FINANCE_LEAD+ | Set total budget and allocate per category (one-time) |
| `GET` | `/events/{event_id}/budget` | FINANCE_LEAD+ | Get budget summary with actuals per category |
| `POST` | `/events/{event_id}/expenses` | FINANCE_LEAD+ | Add expense (category, title, amount, bill URL, notes) |
| `GET` | `/events/{event_id}/expenses` | FINANCE_LEAD+ | List all expenses for the event |

### Expense Categories

`FOOD` · `VENUE` · `LOGISTICS` · `MARKETING` · `PRIZES` · `EQUIPMENT` · `MISCELLANEOUS`

### Business Logic

- Budget can only be set once per event
- Finance summary returns: `total_budget`, `total_spent`, `remaining`, `by_category[]` with `allocated`, `spent`, `variance`

### Frontend Pages

| Route | Description |
|---|---|
| `/manage/:eventId/finance` | Budget overview; category breakdown chart; add expense form; amounts in INR |

---

## 8. Feedback & NPS

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/feedback/forms` | EVENT_HEAD+ | Create feedback form with questions |
| `POST` | `/events/{event_id}/feedback/submit` | PARTICIPANT | Submit answers to a form |
| `GET` | `/events/{event_id}/feedback/results` | EVENT_HEAD+ | Aggregated results per question |
| `POST` | `/events/{event_id}/nps` | PARTICIPANT | Submit NPS score (0–10) |
| `GET` | `/events/{event_id}/nps` | EVENT_HEAD+ | NPS stats (promoters, detractors, score) |

### Question Types

`TEXT` · `RATING` · `MULTIPLE_CHOICE` · `YES_NO`

### Business Logic

- Forms have a `closes_at` deadline; submissions rejected after close
- NPS score feeds into event analytics (`nps_score` field)

---

## 9. Announcements

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/events/{event_id}/announcements` | EVENT_COORDINATOR+ | Create announcement with title, body, target audience, channels |
| `GET` | `/events/{event_id}/announcements` | EVENT_COORDINATOR+ | List announcements for event |

### Channels

`IN_APP` · `EMAIL`

### Frontend Pages

| Route | Description |
|---|---|
| `/manage/:eventId/announcements` | Compose form with channel checkboxes; announcement history list |

---

## 10. Notifications

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/notifications` | Authenticated | List user notifications (limit 50) |
| `PATCH` | `/notifications/{id}/read` | Owner | Mark notification as read |

### Notification Types

`EVENT_UPDATE` · `REGISTRATION_CONFIRMED` · `CERTIFICATE_ISSUED` · `ANNOUNCEMENT` · `TEAM_INVITE`

### Frontend Pages

| Route | Description |
|---|---|
| `/dashboard/notifications` | Notification feed; type-colour coded; mark individual as read |

---

## 11. Analytics

### Backend Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/analytics/events/{event_id}` | EVENT_HEAD+ | Per-event stats: registrations, confirmed, attendance rate, teams, budget utilisation, NPS |
| `GET` | `/analytics/clubs/{club_id}` | CLUB_ADMIN+ | Club-level aggregated stats |
| `GET` | `/analytics/platform` | SUPER_ADMIN | Platform totals: events, users, registrations, active/completed counts |

### Frontend Pages

| Route | Description |
|---|---|
| `/manage/:eventId/overview` | 6 stat cards + registration funnel progress bar |
| `/admin` | Platform metrics — 3 big stats + activity trend bar chart |

---

## 12. Role-Based Access Control

### Roles (lowest → highest privilege)

| Role | Primary Capability |
|---|---|
| `PARTICIPANT` | Discover events, register, join teams, earn certificates |
| `ATTENDANCE_TEAM` | Scan QR codes at checkpoints |
| `VOLUNTEER_LEAD` | Manage volunteer positions |
| `FINANCE_LEAD` | Manage event budget and expenses |
| `EVENT_COORDINATOR` | Registrations, attendance, announcements |
| `EVENT_HEAD` | Full event management including certificates and analytics |
| `CLUB_ADMIN` | Create events, assign organizers, club-level analytics |
| `FACULTY_ADVISOR` | Approve or reject events pending review |
| `SUPER_ADMIN` | All permissions; user management; event deletion |

Roles inherit all permissions from roles below them in the hierarchy.

### Permission Summary

| Permission | Minimum Role |
|---|---|
| `event:create` | CLUB_ADMIN |
| `event:update` | EVENT_HEAD |
| `event:submit_review` | CLUB_ADMIN |
| `event:approve` | FACULTY_ADVISOR |
| `event:delete` | SUPER_ADMIN |
| `organizer:assign` | CLUB_ADMIN |
| `registration:read` | EVENT_COORDINATOR |
| `attendance:scan` | ATTENDANCE_TEAM |
| `attendance:manage` | EVENT_HEAD |
| `finance:manage` | FINANCE_LEAD |
| `certificate:manage` | EVENT_HEAD |
| `feedback:submit` | PARTICIPANT |
| `analytics:event_read` | EVENT_HEAD |
| `analytics:platform` | SUPER_ADMIN |

---

## 13. Frontend Pages

### Public

| Route | Description |
|---|---|
| `/` | Event discovery — search, status/category filter |
| `/events/:slug` | Event detail and registration |
| `/verify/:code` | Certificate verification (no login required) |
| `/login` | Google OAuth sign-in |
| `/dev-login` | Dev-only login with role selector |

### Participant Dashboard

| Route | Description |
|---|---|
| `/dashboard` | Overview — registered events, certificates, unread notifications |
| `/dashboard/events` | Registration list with QR download and cancel |
| `/dashboard/teams` | Team memberships; accept team invitation by token |
| `/dashboard/certificates` | Certificate vault with download and verify |
| `/dashboard/notifications` | Notification feed |

### Club Admin

| Route | Description |
|---|---|
| `/club` | Event list by status; create event form; submit for review |

### Organizer (EVENT_HEAD, EVENT_COORDINATOR, FINANCE_LEAD, ATTENDANCE_TEAM, VOLUNTEER_LEAD)

| Route | Description |
|---|---|
| `/organizer` | Events assigned to the current user |
| `/manage/:eventId/overview` | Event analytics — 6 stats + registration funnel |
| `/manage/:eventId/registrations` | Full registration table — search, filter, CSV export |
| `/manage/:eventId/attendance` | Live attendance dashboard; 30s auto-refresh |
| `/manage/:eventId/finance` | Budget summary; add expense |
| `/manage/:eventId/certificates` | Generate and list certificates |
| `/manage/:eventId/announcements` | Compose and send announcements |
| `/manage/:eventId/volunteers` | Volunteer management |

### Faculty / Admin

| Route | Description |
|---|---|
| `/faculty/approvals` | Events pending approval; approve/reject with comment |
| `/admin` | Platform metrics and activity trend chart |
