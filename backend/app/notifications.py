from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.realtime import publish_realtime
from app.models import Notification


def notification_item(item: Notification) -> dict:
    return {
        "id": str(item.id),
        "kind": item.kind,
        "title": item.title,
        "body": item.body,
        "action_type": item.action_type,
        "action_id": str(item.action_id) if item.action_id else None,
        "read_at": item.read_at.isoformat() if item.read_at else None,
        "created_at": item.created_at.isoformat(),
    }


async def create_notification(
    session: AsyncSession,
    *,
    user_id: UUID,
    kind: str,
    title: str,
    body: str,
    action_type: str | None = None,
    action_id: UUID | None = None,
    dedupe_key: str | None = None,
) -> Notification:
    values = {
        "user_id": user_id,
        "kind": kind,
        "title": title[:80],
        "body": body[:240],
        "action_type": action_type,
        "action_id": action_id,
        "dedupe_key": dedupe_key,
    }
    statement = pg_insert(Notification).values(**values)
    if dedupe_key:
        statement = statement.on_conflict_do_update(
            constraint="uq_notifications_user_dedupe",
            set_={
                "kind": kind,
                "title": title[:80],
                "body": body[:240],
                "action_type": action_type,
                "action_id": action_id,
                "read_at": None,
                "created_at": func.now(),
            },
        )
    notification_id = (
        await session.execute(statement.returning(Notification.id))
    ).scalar_one()
    item = await session.get(Notification, notification_id)
    if item is None:
        raise HTTPException(500, "알림을 저장하지 못했어요")
    await publish_realtime(
        session,
        {
            "type": "notification",
            "audience_user_ids": [str(user_id)],
            "item": notification_item(item),
        },
    )
    return item


async def mark_action_notifications_read(
    session: AsyncSession,
    *,
    user_id: UUID,
    action_type: str,
    action_id: UUID,
) -> int:
    result = await session.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.action_type == action_type,
            Notification.action_id == action_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
        .returning(Notification.id)
    )
    return len(result.scalars().all())


async def unread_notification_count(session: AsyncSession, user_id: UUID) -> int:
    count = await session.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
    )
    return int(count or 0)
