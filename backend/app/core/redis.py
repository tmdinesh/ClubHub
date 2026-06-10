from __future__ import annotations

from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

# Single connection pool shared across the app lifetime.
_pool: aioredis.ConnectionPool | None = None


def _get_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=20,
            decode_responses=True,
        )
    return _pool


def get_redis_client() -> Redis:
    return aioredis.Redis(connection_pool=_get_pool())


async def get_redis() -> AsyncGenerator[Redis, None]:
    client = get_redis_client()
    try:
        yield client
    finally:
        # Pool manages connections; individual client doesn't own the pool.
        pass


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
