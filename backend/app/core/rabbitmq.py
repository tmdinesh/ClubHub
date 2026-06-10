from __future__ import annotations

import json
import logging
from typing import Any, Callable, Awaitable

import aio_pika
from aio_pika import Channel, Connection, ExchangeType, Message, RobustConnection
from aio_pika.abc import AbstractIncomingMessage

from app.core.config import settings

logger = logging.getLogger(__name__)

MAIN_EXCHANGE = "ccops.events"
DLX_EXCHANGE = "ccops.events.dlx"
DLQ_NAME = "ccops.dead_letter"


async def get_connection() -> RobustConnection:
    return await aio_pika.connect_robust(settings.RABBITMQ_URL)


class Publisher:
    """Lightweight fire-and-forget publisher.

    Usage:
        async with Publisher() as pub:
            await pub.publish("REGISTRATION_CONFIRMED", {"reg_id": "..."})
    """

    def __init__(self) -> None:
        self._conn: Connection | None = None
        self._channel: Channel | None = None

    async def __aenter__(self) -> "Publisher":
        self._conn = await get_connection()
        self._channel = await self._conn.channel()
        await self._channel.declare_exchange(
            MAIN_EXCHANGE, ExchangeType.TOPIC, durable=True
        )
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._conn:
            await self._conn.close()

    async def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        assert self._channel is not None
        body = json.dumps({"type": event_type, **payload}).encode()
        await self._channel.default_exchange.publish(
            Message(body, content_type="application/json", delivery_mode=2),
            routing_key=event_type,
        )
        logger.debug("Published %s", event_type)


async def publish_event(event_type: str, payload: dict[str, Any]) -> None:
    """Convenience wrapper for one-off publishes."""
    async with Publisher() as pub:
        await pub.publish(event_type, payload)


HandlerFn = Callable[[dict[str, Any]], Awaitable[None]]


class Consumer:
    """Base consumer with dead-letter queue support.

    Subclass and override `QUEUE_NAME` + `ROUTING_KEYS` + `handle`.
    """

    QUEUE_NAME: str = "ccops.default"
    ROUTING_KEYS: list[str] = ["#"]

    async def setup(self, channel: Channel) -> None:
        # Main exchange
        exchange = await channel.declare_exchange(
            MAIN_EXCHANGE, ExchangeType.TOPIC, durable=True
        )
        # Dead-letter exchange
        dlx = await channel.declare_exchange(
            DLX_EXCHANGE, ExchangeType.FANOUT, durable=True
        )
        # Dead-letter queue
        await channel.declare_queue(DLQ_NAME, durable=True)
        # Main queue with DLX pointer
        queue = await channel.declare_queue(
            self.QUEUE_NAME,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DLX_EXCHANGE,
                "x-message-ttl": 86_400_000,  # 24 h TTL before DLQ
            },
        )
        for key in self.ROUTING_KEYS:
            await queue.bind(exchange, routing_key=key)

        await queue.consume(self._dispatch)

    async def _dispatch(self, message: AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            try:
                payload = json.loads(message.body)
                await self.handle(payload)
            except Exception:
                logger.exception("Error processing message %s", message.routing_key)
                raise  # aio_pika will nack → DLX

    async def handle(self, payload: dict[str, Any]) -> None:
        raise NotImplementedError

    async def run(self) -> None:
        conn = await get_connection()
        async with conn:
            channel = await conn.channel()
            await channel.set_qos(prefetch_count=10)
            await self.setup(channel)
            logger.info("Consumer %s listening…", self.QUEUE_NAME)
            await aio_pika.robust_connection.connect_robust  # keep alive
            import asyncio
            await asyncio.Future()  # block forever
