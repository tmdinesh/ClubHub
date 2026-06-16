"""Notification worker — consumes RabbitMQ events and dispatches handlers."""
from __future__ import annotations

import asyncio
import logging

from app.modules.notifications.consumer import NotificationConsumer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")


async def main() -> None:
    consumer = NotificationConsumer()
    await consumer.run()


if __name__ == "__main__":
    asyncio.run(main())
