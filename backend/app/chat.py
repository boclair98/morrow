from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.realtime import publish_realtime
from app.models import Match, Message, User
from app.notifications import create_notification, mark_action_notifications_read

RISKY_TERMS = ("계좌", "코인", "투자", "송금", "인증번호")


def clean_chat_body(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise HTTPException(422, "메시지를 입력해주세요")
    if len(cleaned) > 500:
        raise HTTPException(422, "메시지는 500자까지 보낼 수 있어요")
    if any(word in cleaned for word in RISKY_TERMS):
        raise HTTPException(
            422,
            "금전·투자·인증번호 관련 문구는 안전을 위해 전송할 수 없어요",
        )
    return cleaned


def message_item(message: Message, viewer_id: UUID | None = None) -> dict:
    return {
        "id": str(message.id),
        "client_id": str(message.client_id) if message.client_id else None,
        "sender_id": str(message.sender_id),
        "body": message.body,
        "mine": message.sender_id == viewer_id if viewer_id else None,
        "created_at": message.created_at.isoformat(),
        "read_at": message.read_at.isoformat() if message.read_at else None,
    }


async def create_chat_message(
    session: AsyncSession,
    match: Match,
    sender_id: UUID,
    body: str,
    client_id: UUID | None,
) -> tuple[Message, bool]:
    if match.status != "active":
        raise HTTPException(409, "conversation is closed")
    cleaned = clean_chat_body(body)

    if client_id:
        existing = await session.scalar(
            select(Message).where(
                Message.sender_id == sender_id,
                Message.client_id == client_id,
            )
        )
        if existing:
            return existing, False

    sent_since = datetime.now(UTC) - timedelta(minutes=1)
    recent_count = await session.scalar(
        select(func.count(Message.id)).where(
            Message.sender_id == sender_id,
            Message.created_at >= sent_since,
        )
    )
    if (recent_count or 0) >= 20:
        raise HTTPException(
            429, "메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요"
        )

    message_id = (
        await session.execute(
            pg_insert(Message)
            .values(
                match_id=match.id,
                sender_id=sender_id,
                client_id=client_id,
                body=cleaned,
            )
            .on_conflict_do_nothing(constraint="uq_messages_sender_client")
            .returning(Message.id)
        )
    ).scalar_one_or_none()
    if message_id is None:
        existing = await session.scalar(
            select(Message).where(
                Message.sender_id == sender_id,
                Message.client_id == client_id,
            )
        )
        if existing is None:
            raise HTTPException(409, "메시지를 저장하지 못했어요. 다시 시도해주세요")
        return existing, False

    message = await session.get(Message, message_id)
    if message is None:
        raise HTTPException(500, "메시지를 저장하지 못했어요")
    await publish_realtime(
        session,
        {
            "type": "message",
            "match_id": str(match.id),
            "item": message_item(message),
        },
    )
    recipient_id = match.user_b_id if match.user_a_id == sender_id else match.user_a_id
    recipient = await session.get(User, recipient_id)
    sender = await session.get(User, sender_id)
    if recipient and recipient.notify_messages:
        sender_name = sender.display_name if sender else "매치 상대"
        await create_notification(
            session,
            user_id=recipient.id,
            kind="message",
            title=f"{sender_name}님이 메시지를 보냈어요",
            body=cleaned[:120],
            action_type="match",
            action_id=match.id,
            dedupe_key=f"message:{match.id}",
        )
    return message, True


async def mark_match_read(
    session: AsyncSession, match_id: UUID, reader_id: UUID
) -> tuple[int, datetime]:
    read_at = datetime.now(UTC)
    result = await session.execute(
        update(Message)
        .where(
            Message.match_id == match_id,
            Message.sender_id != reader_id,
            Message.read_at.is_(None),
        )
        .values(read_at=read_at)
        .returning(Message.id)
    )
    count = len(result.scalars().all())
    if count:
        await publish_realtime(
            session,
            {
                "type": "read",
                "match_id": str(match_id),
                "reader_id": str(reader_id),
                "read_at": read_at.isoformat(),
                "count": count,
            },
        )
    await mark_action_notifications_read(
        session,
        user_id=reader_id,
        action_type="match",
        action_id=match_id,
    )
    return count, read_at
