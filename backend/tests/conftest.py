"""Shared pytest fixtures."""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.shared.base_model import Base

# Import all models so metadata is populated
import app.modules.auth.models  # noqa: F401
import app.modules.events.models  # noqa: F401
import app.modules.registration.models  # noqa: F401
import app.modules.teams.models  # noqa: F401
import app.modules.attendance.models  # noqa: F401
import app.modules.attendance.cred_models  # noqa: F401
import app.modules.volunteers.models  # noqa: F401
import app.modules.certificates.models  # noqa: F401
import app.modules.finance.models  # noqa: F401
import app.modules.sponsorship.models  # noqa: F401
import app.modules.feedback.models  # noqa: F401
import app.modules.announcements.models  # noqa: F401
import app.modules.notifications.models  # noqa: F401

TEST_DB_URL = settings.TEST_DATABASE_URL
engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
