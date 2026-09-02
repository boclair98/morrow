"""Cross-instance realtime delivery backed by PostgreSQL LISTEN/NOTIFY.

Chat messages remain durable in the messages table. NOTIFY is only the fast
delivery path; clients always refetch history after reconnecting, so a rolling
deploy or dropped socket cannot lose a conversation.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID, uuid4

import asyncpg
from fastapi import WebSocket
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

log = logging.getLogger(__name__)
CHANNEL = "morrow_realtime"


def _asyncpg_dsn() -> str:
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


class RealtimeHub:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._socket_users: dict[WebSocket, tuple[frozenset[str], str]] = {}
        self._lock = asyncio.Lock()
        self._stop: asyncio.Event | None = None
        self._listener_task: asyncio.Task[None] | None = None
        self._listener_connection: asyncpg.Connection | None = None

    async def start(self) -> None:
        if self._listener_task and not self._listener_task.done():
            return
        self._stop = asyncio.Event()
        self._listener_task = asyncio.create_task(self._listen_forever())

    async def stop(self) -> None:
        if self._stop:
            self._stop.set()
        if self._listener_connection and not self._listener_connection.is_closed():
            await self._listener_connection.close()
        if self._listener_task:
            try:
                await asyncio.wait_for(self._listener_task, timeout=3)
            except (TimeoutError, asyncio.CancelledError):
                self._listener_task.cancel()

    async def connect(
        self, match_id: UUID, user_id: UUID, websocket: WebSocket
    ) -> bool:
        return await self._connect(frozenset({f"match:{match_id}"}), user_id, websocket)

    async def connect_user(self, user_id: UUID, websocket: WebSocket) -> bool:
        return await self._connect(frozenset({f"user:{user_id}"}), user_id, websocket)

    async def _connect(
        self, topics: frozenset[str], user_id: UUID, websocket: WebSocket
    ) -> bool:
        user_key = str(user_id)
        async with self._lock:
            connection_count = sum(
                1
                for _, socket_user in self._socket_users.values()
                if socket_user == user_key
            )
            if connection_count >= 4:
                return False
            for topic in topics:
                self._sockets[topic].add(websocket)
            self._socket_users[websocket] = (topics, user_key)
        await websocket.accept()
        return True

    async def disconnect(
        self, websocket: WebSocket, match_id: UUID | None = None
    ) -> int:
        async with self._lock:
            details = self._socket_users.pop(websocket, None)
            if details is None:
                return 0
            topics, user_key = details
            for topic in topics:
                sockets = self._sockets.get(topic)
                if sockets:
                    sockets.discard(websocket)
                    if not sockets:
                        self._sockets.pop(topic, None)
            if match_id is None:
                return 0
            match_key = f"match:{match_id}"
            return sum(
                1
                for socket_topics, socket_user in self._socket_users.values()
                if match_key in socket_topics and socket_user == user_key
            )

    async def broadcast(self, event: dict) -> None:
        topics: set[str] = set()
        match_id = event.get("match_id")
        if match_id:
            topics.add(f"match:{match_id}")
        for user_id in event.get("audience_user_ids", []):
            topics.add(f"user:{user_id}")
        async with self._lock:
            targets = tuple(
                {
                    websocket
                    for topic in topics
                    for websocket in self._sockets.get(topic, ())
                }
            )
        outgoing = {
            key: value for key, value in event.items() if key != "audience_user_ids"
        }
        stale: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_json(outgoing)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            await self.disconnect(websocket)

    def _on_notification(
        self,
        _connection: asyncpg.Connection,
        _pid: int,
        _channel: str,
        payload: str,
    ) -> None:
        try:
            event = json.loads(payload)
        except (TypeError, json.JSONDecodeError):
            log.warning("ignored malformed realtime payload")
            return
        asyncio.create_task(self.broadcast(event))

    async def _listen_forever(self) -> None:
        retry_seconds = 1
        while self._stop and not self._stop.is_set():
            try:
                connection = await asyncpg.connect(_asyncpg_dsn(), timeout=5)
                self._listener_connection = connection
                await connection.add_listener(CHANNEL, self._on_notification)
                retry_seconds = 1
                await self._stop.wait()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("realtime listener disconnected; retrying")
                if self._stop:
                    try:
                        await asyncio.wait_for(self._stop.wait(), timeout=retry_seconds)
                    except TimeoutError:
                        pass
                retry_seconds = min(retry_seconds * 2, 20)
            finally:
                connection = self._listener_connection
                self._listener_connection = None
                if connection and not connection.is_closed():
                    await connection.close()


realtime_hub = RealtimeHub()


async def publish_realtime(session: AsyncSession, event: dict) -> dict:
    payload = {
        **event,
        "event_id": str(uuid4()),
        "issued_at": datetime.now(UTC).isoformat(),
    }
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > 7_000:
        raise ValueError("realtime payload too large")
    await session.execute(
        text("SELECT pg_notify(:channel, :payload)"),
        {"channel": CHANNEL, "payload": encoded},
    )
    return payload
