"""
Comprehensive seed for CCOps development.

Clears all application data and creates a full walkthrough dataset:
  - 1 super admin
  - 1 faculty advisor (mapped to CS Club)
  - 1 club admin (mapped to CS Club)
  - 5 participants
  - 2 clubs (CS Club, Arts & Culture Club)
  - 3 events:
      * Regular published event (registration open, 5 confirmed participants)
      * Team hackathon event (published, team formation seeded)
      * Completed cultural event (with attendance + participation certs)

Run from project root:
    docker compose exec backend python scripts/seed.py
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import re
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.shared.enums import (
    EventStatus, EventType, RegistrationStatus, TeamStatus, UserRole,
)

# Import all models so metadata is fully populated
import app.modules.auth.models as auth_m
import app.modules.events.models as ev_m
import app.modules.registration.models as reg_m
import app.modules.teams.models as team_m
import app.modules.attendance.models as att_m
import app.modules.certificates.models as cert_m
import app.modules.finance.models
import app.modules.feedback.models
import app.modules.announcements.models
import app.modules.notifications.models as notif_m
from app.modules.attendance.cred_models import EventAttendanceCred

engine = create_async_engine(settings.DATABASE_URL, echo=False)
Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

DOMAIN = settings.ALLOWED_EMAIL_DOMAINS[0]


# ── Password hashing (PBKDF2-SHA256 — same as cred_routes.py) ────────────────

def _hash_password(plain: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 260_000)
    return salt.hex() + ":" + dk.hex()


def _slugify(title: str, suffix: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{base}-{suffix}"


# ── Truncate all app tables ───────────────────────────────────────────────────

TRUNCATE_TABLES = [
    "audit_logs", "notifications", "feedback_responses", "feedback_forms",
    "announcements", "finance_transactions", "finance_budgets",
    "certificates", "certificate_templates",
    "attendance_records", "attendance_checkpoints", "event_attendance_creds",
    "team_invitations", "team_members", "teams",
    "registrations", "event_organizers", "event_approval_requests",
    "events", "clubs", "users",
]


async def clear_db(_db: AsyncSession) -> None:
    print("  Clearing existing data…")
    async with engine.begin() as conn:
        # Only truncate tables that actually exist
        result = await conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ))
        existing = {row[0] for row in result}
        to_truncate = [t for t in TRUNCATE_TABLES if t in existing]
        if to_truncate:
            tables_csv = ", ".join(f'"{t}"' for t in to_truncate)
            await conn.execute(text(
                f"TRUNCATE TABLE {tables_csv} RESTART IDENTITY CASCADE"
            ))


# ── Seed ──────────────────────────────────────────────────────────────────────

async def seed() -> None:
    async with Session() as db:
        await clear_db(db)

        now = datetime.now(timezone.utc)

        # ── Users ─────────────────────────────────────────────────────────────
        admin = auth_m.User(
            id=uuid4(), google_id="seed_super_admin",
            name="Platform Admin", email=f"admin@{DOMAIN}",
            role=UserRole.SUPER_ADMIN, is_active=True,
        )
        faculty = auth_m.User(
            id=uuid4(), google_id="seed_faculty",
            name="Dr. Priya Sharma", email=f"faculty@{DOMAIN}",
            role=UserRole.FACULTY_ADVISOR, is_active=True,
        )
        club_admin = auth_m.User(
            id=uuid4(), google_id="seed_club_admin",
            name="Arjun Mehta (Club Admin)", email=f"clubadmin@{DOMAIN}",
            role=UserRole.CLUB_ADMIN, is_active=True,
        )
        participants = [
            auth_m.User(
                id=uuid4(), google_id=f"seed_participant_{i}",
                name=n, email=f"{e}@{DOMAIN}",
                role=UserRole.PARTICIPANT, is_active=True,
            )
            for i, (n, e) in enumerate([
                ("Rohit Kumar",     "rohit"),
                ("Sneha Patel",     "sneha"),
                ("Vikram Singh",    "vikram"),
                ("Ananya Reddy",    "ananya"),
                ("Kiran Nair",      "kiran"),
            ])
        ]
        db.add_all([admin, faculty, club_admin] + participants)
        await db.flush()

        # ── Clubs ─────────────────────────────────────────────────────────────
        cs_club = ev_m.Club(
            id=uuid4(), name="Computer Science Club",
            description="Premier tech club — coding, hackathons, workshops.",
            department="Computer Science", is_active=True,
            faculty_advisor_id=faculty.id,
        )
        arts_club = ev_m.Club(
            id=uuid4(), name="Arts & Culture Club",
            description="Celebrating creativity, art, and expression.",
            department="Arts", is_active=True,
            faculty_advisor_id=faculty.id,
        )
        db.add_all([cs_club, arts_club])
        await db.flush()

        # Map club admin to CS Club
        club_admin.club_id = cs_club.id
        await db.flush()

        # ── Event 1: Regular published talk ───────────────────────────────────
        talk_event = ev_m.Event(
            id=uuid4(),
            title="Tech Talk: AI in Education",
            slug=_slugify("Tech Talk AI in Education", uuid4().hex[:6]),
            description="Expert panel on AI applications in higher education. Open to all students.",
            venue="Main Auditorium, Block B",
            start_datetime=now + timedelta(days=10),
            end_datetime=now + timedelta(days=10, hours=3),
            registration_start=now - timedelta(days=2),
            registration_end=now + timedelta(days=8),
            category="Talk",
            event_type=EventType.INTERNAL,
            organizer_club_id=cs_club.id,
            faculty_advisor_id=faculty.id,
            status=EventStatus.PUBLISHED,
            max_participants=200,
            is_team_event=False,
        )

        # ── Event 2: Team hackathon (published) ───────────────────────────────
        hack_event = ev_m.Event(
            id=uuid4(),
            title="Annual Hackathon 2025",
            slug=_slugify("Annual Hackathon 2025", uuid4().hex[:6]),
            description="24-hour hackathon — build something amazing. Teams of 2–4.",
            venue="Computer Lab, Block A",
            start_datetime=now + timedelta(days=20),
            end_datetime=now + timedelta(days=21),
            registration_start=now - timedelta(days=1),
            registration_end=now + timedelta(days=18),
            category="Hackathon",
            event_type=EventType.INTERNAL,
            organizer_club_id=cs_club.id,
            faculty_advisor_id=faculty.id,
            status=EventStatus.PUBLISHED,
            max_participants=120,
            is_team_event=True,
            team_min_size=2,
            team_max_size=4,
        )

        # ── Event 3: Completed cultural event ─────────────────────────────────
        completed_event = ev_m.Event(
            id=uuid4(),
            title="Cultural Fest 2024",
            slug=_slugify("Cultural Fest 2024", uuid4().hex[:6]),
            description="Annual cultural showcase with performances and exhibitions.",
            venue="Open Air Theatre",
            start_datetime=now - timedelta(days=30),
            end_datetime=now - timedelta(days=29),
            registration_start=now - timedelta(days=45),
            registration_end=now - timedelta(days=32),
            category="Cultural",
            event_type=EventType.INTERNAL,
            organizer_club_id=arts_club.id,
            faculty_advisor_id=faculty.id,
            status=EventStatus.COMPLETED,
            max_participants=500,
            is_team_event=False,
        )

        db.add_all([talk_event, hack_event, completed_event])
        await db.flush()

        # ── Registrations for talk event ──────────────────────────────────────
        talk_regs: list[reg_m.Registration] = []
        for p in participants:
            from jose import jwt as jose_jwt
            reg = reg_m.Registration(
                id=uuid4(),
                event_id=talk_event.id, user_id=p.id,
                status=RegistrationStatus.CONFIRMED,
                registered_at=now - timedelta(hours=2),
                confirmed_at=now - timedelta(hours=2),
            )
            # Generate QR token
            qr_token = jose_jwt.encode(
                {"reg_id": str(reg.id), "event_id": str(talk_event.id),
                 "iat": int(now.timestamp())},
                settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
            )
            reg.qr_token = qr_token
            db.add(reg)
            talk_regs.append(reg)
        await db.flush()

        # ── Registrations for hackathon ───────────────────────────────────────
        hack_regs: list[reg_m.Registration] = []
        for p in participants:
            from jose import jwt as jose_jwt
            reg = reg_m.Registration(
                id=uuid4(),
                event_id=hack_event.id, user_id=p.id,
                status=RegistrationStatus.CONFIRMED,
                registered_at=now - timedelta(hours=1),
                confirmed_at=now - timedelta(hours=1),
            )
            qr_token = jose_jwt.encode(
                {"reg_id": str(reg.id), "event_id": str(hack_event.id),
                 "iat": int(now.timestamp())},
                settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
            )
            reg.qr_token = qr_token
            db.add(reg)
            hack_regs.append(reg)
        await db.flush()

        # ── Teams for hackathon ───────────────────────────────────────────────
        # Team 1: Rohit (lead) + Sneha — public, READY
        team1 = team_m.Team(
            id=uuid4(), event_id=hack_event.id, name="NeuralNinjas",
            lead_id=participants[0].id,
            min_size=2, max_size=4,
            is_public=True, join_key=None,
            status=TeamStatus.READY,
        )
        db.add(team1)
        await db.flush()
        db.add(team_m.TeamMember(team_id=team1.id, user_id=participants[0].id, role="LEAD",
                                  joined_at=now - timedelta(hours=1)))
        db.add(team_m.TeamMember(team_id=team1.id, user_id=participants[1].id, role="MEMBER",
                                  joined_at=now - timedelta(minutes=50)))
        await db.flush()

        # Team 2: Vikram (lead) — private, FORMING (needs 1 more)
        join_key = secrets.token_urlsafe(6).upper()[:8]
        team2 = team_m.Team(
            id=uuid4(), event_id=hack_event.id, name="ByteBrigade",
            lead_id=participants[2].id,
            min_size=2, max_size=4,
            is_public=False, join_key=join_key,
            status=TeamStatus.FORMING,
        )
        db.add(team2)
        await db.flush()
        db.add(team_m.TeamMember(team_id=team2.id, user_id=participants[2].id, role="LEAD",
                                  joined_at=now - timedelta(minutes=45)))
        await db.flush()

        # ── Attendance checkpoint for completed event ──────────────────────────
        checkpoint = att_m.Checkpoint(
            id=uuid4(), event_id=completed_event.id,
            name="Main Entry", order=1,
        )
        db.add(checkpoint)
        await db.flush()

        # ── Registrations + attendance for completed event ────────────────────
        for p in participants:
            from jose import jwt as jose_jwt
            reg = reg_m.Registration(
                id=uuid4(),
                event_id=completed_event.id, user_id=p.id,
                status=RegistrationStatus.CONFIRMED,
                registered_at=now - timedelta(days=35),
                confirmed_at=now - timedelta(days=35),
            )
            qr_token = jose_jwt.encode(
                {"reg_id": str(reg.id), "event_id": str(completed_event.id),
                 "iat": int((now - timedelta(days=35)).timestamp())},
                settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
            )
            reg.qr_token = qr_token
            db.add(reg)
            await db.flush()

            # Mark present (all 5) — scanned_by = club_admin as proxy
            db.add(att_m.AttendanceRecord(
                id=uuid4(),
                registration_id=reg.id, checkpoint_id=checkpoint.id,
                scanned_at=now - timedelta(days=30),
                scanned_by=club_admin.id,
            ))
        await db.flush()

        # ── Participation certificates for completed event ────────────────────
        import uuid as uuid_mod
        for p in participants:
            unique_code = f"CERT-CULT-{uuid_mod.uuid4().hex[:8].upper()}"
            db.add(cert_m.Certificate(
                id=uuid4(),
                event_id=completed_event.id,
                recipient_id=p.id,
                certificate_type="PARTICIPATION",
                unique_code=unique_code,
                issued_at=now - timedelta(days=25),
                pdf_url=f"/media/certificates/{unique_code}.pdf",
                metadata_={"name": p.name, "event_name": completed_event.title,
                           "certificate_type": "Participation"},
            ))
        await db.flush()

        # ── Notifications ─────────────────────────────────────────────────────
        for p in participants:
            db.add(notif_m.Notification(
                id=uuid4(), user_id=p.id,
                type="REGISTRATION_CONFIRMED",
                title=f"Registration confirmed: {talk_event.title}",
                body="Your spot is secured. Use your QR code to check in at the event.",
                is_read=False,
                metadata_={"event_id": str(talk_event.id)},
            ))
            db.add(notif_m.Notification(
                id=uuid4(), user_id=p.id,
                type="CERTIFICATE_ISSUED",
                title=f"Certificate issued: {completed_event.title}",
                body="Your participation certificate for Cultural Fest 2024 is ready to view.",
                is_read=False,
                metadata_={"event_id": str(completed_event.id)},
            ))
        await db.flush()

        # ── Attendance credentials for talk event (10 credentials) ────────────
        event_hex = str(talk_event.id).replace("-", "")[:16]
        for slot in range(1, 11):
            plain = secrets.token_urlsafe(8)[:10]
            username = f"att-{event_hex}-{slot:02d}"
            db.add(EventAttendanceCred(
                event_id=talk_event.id,
                username=username,
                password_hash=_hash_password(plain),
                label=f"Attendance Taker {slot}",
            ))
        await db.flush()

        await db.commit()

    # ── Print summary ─────────────────────────────────────────────────────────
    print("\n✓ Seed complete\n")
    print("── Accounts ──────────────────────────────────────────────")
    print(f"  Super Admin      : admin@{DOMAIN}")
    print(f"  Faculty Advisor  : faculty@{DOMAIN}")
    print(f"  Club Admin       : clubadmin@{DOMAIN}  (mapped → Computer Science Club)")
    print(f"  Participants     : rohit@{DOMAIN} … kiran@{DOMAIN}")
    print()
    print("── Clubs ─────────────────────────────────────────────────")
    print("  Computer Science Club  (faculty advisor: Dr. Priya Sharma)")
    print("  Arts & Culture Club    (faculty advisor: Dr. Priya Sharma)")
    print()
    print("── Events ────────────────────────────────────────────────")
    print("  PUBLISHED  'Tech Talk: AI in Education'  (5 confirmed registrations, 10 att. creds)")
    print("  PUBLISHED  'Annual Hackathon 2025'        (team event, 5 regs, 2 teams seeded)")
    print(f"             Team 1: NeuralNinjas (public, READY, Rohit+Sneha)")
    print(f"             Team 2: ByteBrigade  (private, join key: {join_key}, Vikram only — FORMING)")
    print("  COMPLETED  'Cultural Fest 2024'           (5 attendance + 5 participation certs)")
    print()
    print("── Notifications ─────────────────────────────────────────")
    print("  Each participant has 2 unread notifications (registration + certificate)")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
