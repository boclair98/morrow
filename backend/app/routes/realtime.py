from __future__ import annotations

import json
from collections import deque
from time import monotonic
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.chat import create_chat_message, mark_match_read, message_item
from app.core.access import ensure_active
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.identity import identity_from_values
from app.core.realtime import publish_realtime, realtime_hub
from app.routes.dating import owned_match
from app.routes.users import upsert_local_user

router = APIRouter(tags=["realtime"])


def _origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    forwarded_host = websocket.headers.get("x-forwarded-host")
    visible_host = (forwarded_host or websocket.headers.get("host") or "").split(":")[0]
    if not origin:
        return bool(settings.dev_fake_user)
    origin_host = urlparse(origin).hostname or ""
    if origin_host == visible_host:
        return True
    return bool(settings.dev_fake_user) and origin_host in {"localhost", "127.0.0.1"}


async def _publish_ephemeral(event: dict) -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await publish_realtime(session, event)


@router.websocket("/api/ws/matches/{match_id}")
async def match_socket(websocket: WebSocket, match_id: UUID) -> None:
    if not _origin_allowed(websocket):
        await websocket.close(code=4403)
        return

    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                coders_id = await identity_from_values(
                    session,
                    x_coders_user=websocket.headers.get("x-coders-user"),
                    session_token=websocket.cookies.get(settings.session_cookie_name),
                )
                if coders_id is None:
                    await websocket.close(code=4401)
                    return
                user = await upsert_local_user(session, coders_id)
                ensure_active(user)
                match = await owned_match(session, match_id, user.id)
                if match.status != "active":
                    raise HTTPException(409, "conversation is closed")
                user_id = user.id
    except HTTPException:
        await websocket.close(code=4404)
        return

    if not await realtime_hub.connect(match_id, user_id, websocket):
        await websocket.close(code=4429)
        return

    message_times: deque[float] = deque()
    last_typing_at = 0.0
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                await mark_match_read(session, match_id, user_id)
                await publish_realtime(
                    session,
                    {
                        "type": "presence",
                        "match_id": str(match_id),
                        "user_id": str(user_id),
                        "online": True,
                    },
                )
        await websocket.send_json(
            {
                "type": "ready",
                "match_id": str(match_id),
                "user_id": str(user_id),
                "heartbeat_seconds": 25,
            }
        )

        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > 2_048:
                await websocket.send_json(
                    {"type": "error", "detail": "요청이 너무 큽니다"}
                )
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "detail": "잘못된 요청입니다"}
                )
                continue

            event_type = payload.get("type")
            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type == "typing":
                now = monotonic()
                if now - last_typing_at >= 0.8:
                    last_typing_at = now
                    await _publish_ephemeral(
                        {
                            "type": "typing",
                            "match_id": str(match_id),
                            "user_id": str(user_id),
                            "active": bool(payload.get("active", True)),
                        }
                    )
                continue

            if event_type == "read":
                async with AsyncSessionLocal() as session:
                    async with session.begin():
                        await owned_match(session, match_id, user_id)
                        await mark_match_read(session, match_id, user_id)
                continue

            if event_type != "message":
                await websocket.send_json(
                    {"type": "error", "detail": "지원하지 않는 요청입니다"}
                )
                continue

            now = monotonic()
            raw_client_id = payload.get("client_id")
            while message_times and now - message_times[0] > 10:
                message_times.popleft()
            if len(message_times) >= 8:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "메시지를 너무 빠르게 보내고 있어요",
                        "client_id": raw_client_id,
                    }
                )
                continue
            message_times.append(now)

            try:
                client_id = UUID(str(raw_client_id))
            except (TypeError, ValueError):
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "메시지 식별자가 필요합니다",
                        "client_id": raw_client_id,
                    }
                )
                continue

            try:
                async with AsyncSessionLocal() as session:
                    async with session.begin():
                        current_match = await owned_match(session, match_id, user_id)
                        message, created = await create_chat_message(
                            session,
                            current_match,
                            user_id,
                            str(payload.get("body", "")),
                            client_id,
                        )
                if not created:
                    await websocket.send_json(
                        {
                            "type": "message",
                            "match_id": str(match_id),
                            "item": message_item(message),
                        }
                    )
            except HTTPException as exc:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": exc.detail,
                        "client_id": str(client_id),
                    }
                )
    except WebSocketDisconnect:
        pass
    finally:
        remaining = await realtime_hub.disconnect(websocket, match_id)
        if remaining == 0:
            try:
                await _publish_ephemeral(
                    {
                        "type": "presence",
                        "match_id": str(match_id),
                        "user_id": str(user_id),
                        "online": False,
                    }
                )
            except Exception:
                pass


@router.websocket("/api/ws/inbox")
async def inbox_socket(websocket: WebSocket) -> None:
    if not _origin_allowed(websocket):
        await websocket.close(code=4403)
        return
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                coders_id = await identity_from_values(
                    session,
                    x_coders_user=websocket.headers.get("x-coders-user"),
                    session_token=websocket.cookies.get(settings.session_cookie_name),
                )
                if coders_id is None:
                    await websocket.close(code=4401)
                    return
                user = await upsert_local_user(session, coders_id)
                ensure_active(user)
                user_id = user.id
    except HTTPException:
        await websocket.close(code=4403)
        return
    if not await realtime_hub.connect_user(user_id, websocket):
        await websocket.close(code=4429)
        return
    try:
        await websocket.send_json(
            {"type": "inbox_ready", "user_id": str(user_id), "heartbeat_seconds": 25}
        )
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > 512:
                await websocket.close(code=4400)
                return
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if payload.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await realtime_hub.disconnect(websocket)
