from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import ensure_active
from app.core.database import get_session
from app.core.identity import require_identity
from app.models import Notification
from app.notifications import notification_item, unread_notification_count
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=50),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    items = (
        (
            await session.execute(
                select(Notification)
                .where(Notification.user_id == user.id)
                .order_by(desc(Notification.created_at))
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [notification_item(item) for item in items],
        "unread_count": await unread_notification_count(session, user.id),
    }


@router.post("/{notification_id}/read")
async def read_notification(
    notification_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    item = await session.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    if item is None:
        raise HTTPException(404, "알림을 찾지 못했어요")
    if item.read_at is None:
        item.read_at = datetime.now(UTC)
    return {"status": "ok"}


@router.post("/read-all")
async def read_all_notifications(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    result = await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
        .returning(Notification.id)
    )
    return {"status": "ok", "count": len(result.scalars().all())}
