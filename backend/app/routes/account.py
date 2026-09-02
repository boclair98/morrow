from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import PRIVACY_VERSION, TERMS_VERSION, legal_complete
from app.core.database import get_session
from app.core.identity import require_identity
from app.core.media import media_storage
from app.core.realtime import publish_realtime
from app.models import (
    Block,
    DateFeedback,
    DatePlan,
    Match,
    Message,
    ProfilePhoto,
    Report,
    Swipe,
    VerificationRequest,
)
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api/account", tags=["account"])


def settings_item(user) -> dict:
    return {
        "discoverable": user.discoverable,
        "marketing_opt_in": user.marketing_opt_in,
        "notify_matches": user.notify_matches,
        "notify_messages": user.notify_messages,
        "notify_dates": user.notify_dates,
        "min_preferred_age": user.min_preferred_age,
        "max_preferred_age": user.max_preferred_age,
        "max_distance_km": user.max_distance_km,
        "legal_complete": legal_complete(user),
        "terms_version": user.terms_version,
        "privacy_version": user.privacy_version,
        "current_terms_version": TERMS_VERSION,
        "current_privacy_version": PRIVACY_VERSION,
        "adult_confirmed": bool(user.adult_confirmed_at),
        "status": user.status,
        "suspended_until": user.suspended_until.isoformat()
        if user.suspended_until
        else None,
    }


class ConsentIn(BaseModel):
    terms_agreed: bool
    privacy_agreed: bool
    adult_confirmed: bool
    marketing_opt_in: bool = False


@router.post("/consents")
async def save_consents(
    body: ConsentIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not (body.terms_agreed and body.privacy_agreed and body.adult_confirmed):
        raise HTTPException(422, "필수 동의와 만 20세 이상 확인이 필요해요")
    user = await upsert_local_user(session, coders_id)
    now = datetime.now(UTC)
    user.terms_version = TERMS_VERSION
    user.privacy_version = PRIVACY_VERSION
    user.terms_agreed_at = now
    user.privacy_agreed_at = now
    user.adult_confirmed_at = now
    if user.marketing_opt_in != body.marketing_opt_in:
        user.marketing_opt_in_at = now if body.marketing_opt_in else None
    user.marketing_opt_in = body.marketing_opt_in
    return {"status": "ok", "settings": settings_item(user)}


class AccountSettingsIn(BaseModel):
    discoverable: bool | None = None
    marketing_opt_in: bool | None = None
    notify_matches: bool | None = None
    notify_messages: bool | None = None
    notify_dates: bool | None = None
    min_preferred_age: int | None = Field(default=None, ge=20, le=49)
    max_preferred_age: int | None = Field(default=None, ge=20, le=49)
    max_distance_km: int | None = Field(default=None, ge=5, le=300)


@router.get("/settings")
async def account_settings(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    return settings_item(user)


@router.patch("/settings")
async def update_account_settings(
    body: AccountSettingsIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(422, "변경할 설정이 없어요")
    next_min_age = changes.get("min_preferred_age", user.min_preferred_age)
    next_max_age = changes.get("max_preferred_age", user.max_preferred_age)
    if next_min_age > next_max_age:
        raise HTTPException(422, "선호 최소 나이는 최대 나이보다 높을 수 없어요")
    for key, value in changes.items():
        if key == "marketing_opt_in" and user.marketing_opt_in != value:
            user.marketing_opt_in_at = datetime.now(UTC) if value else None
        setattr(user, key, value)
    return {"status": "ok", "settings": settings_item(user)}


@router.get("/reports")
async def my_reports(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    reports = (
        (
            await session.execute(
                select(Report)
                .where(Report.reporter_id == user.id)
                .order_by(Report.created_at.desc())
                .limit(50)
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": [
            {
                "id": str(item.id),
                "category": item.category,
                "status": item.status,
                "resolution": item.resolution,
                "created_at": item.created_at.isoformat(),
                "resolved_at": item.resolved_at.isoformat()
                if item.resolved_at
                else None,
            }
            for item in reports
        ]
    }


@router.get("/export")
async def export_account_data(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> Response:
    user = await upsert_local_user(session, coders_id)
    photos = (
        (
            await session.execute(
                select(ProfilePhoto).where(ProfilePhoto.owner_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    swipes = (
        (await session.execute(select(Swipe).where(Swipe.swiper_id == user.id)))
        .scalars()
        .all()
    )
    matches = (
        (
            await session.execute(
                select(Match).where(
                    or_(Match.user_a_id == user.id, Match.user_b_id == user.id)
                )
            )
        )
        .scalars()
        .all()
    )
    match_ids = [item.id for item in matches]
    messages = (
        (
            await session.execute(
                select(Message)
                .where(Message.match_id.in_(match_ids))
                .order_by(Message.created_at)
                .limit(10_000)
            )
        )
        .scalars()
        .all()
        if match_ids
        else []
    )
    plans = (
        (await session.execute(select(DatePlan).where(DatePlan.proposer_id == user.id)))
        .scalars()
        .all()
    )
    blocks = (
        (await session.execute(select(Block).where(Block.blocker_id == user.id)))
        .scalars()
        .all()
    )
    reports = (
        (await session.execute(select(Report).where(Report.reporter_id == user.id)))
        .scalars()
        .all()
    )
    verification_requests = (
        (
            await session.execute(
                select(VerificationRequest).where(
                    VerificationRequest.user_id == user.id
                )
            )
        )
        .scalars()
        .all()
    )
    date_feedback = (
        (
            await session.execute(
                select(DateFeedback).where(DateFeedback.reviewer_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    payload = {
        "exported_at": datetime.now(UTC).isoformat(),
        "message_export_limit": 10_000,
        "profile": {
            "id": str(user.id),
            "coders_id": str(user.coders_id),
            "display_name": user.display_name,
            "age": user.age,
            "gender": user.gender,
            "seeking": user.seeking,
            "area": user.area,
            "job": user.job,
            "bio": user.bio,
            "date_style": user.date_style,
            "interests": user.interests,
            "availability": user.availability,
            "min_preferred_age": user.min_preferred_age,
            "max_preferred_age": user.max_preferred_age,
            "max_distance_km": user.max_distance_km,
            "verification_status": user.verification_status,
            "verified_at": user.verified_at.isoformat() if user.verified_at else None,
            "referral_code": user.referral_code,
            "status": user.status,
            "discoverable": user.discoverable,
            "first_seen_at": user.first_seen_at.isoformat(),
        },
        "consents": settings_item(user),
        "photos": [
            {
                "id": str(item.id),
                "content_type": item.content_type,
                "byte_size": item.byte_size,
                "position": item.position,
                "moderation_status": item.moderation_status,
                "created_at": item.created_at.isoformat(),
            }
            for item in photos
        ],
        "swipes": [
            {
                "target_id": str(item.target_id),
                "decision": item.decision,
                "created_at": item.created_at.isoformat(),
            }
            for item in swipes
        ],
        "matches": [
            {
                "id": str(item.id),
                "other_user_id": str(
                    item.user_b_id if item.user_a_id == user.id else item.user_a_id
                ),
                "status": item.status,
                "matched_at": item.matched_at.isoformat(),
                "closed_at": item.closed_at.isoformat() if item.closed_at else None,
                "closed_reason": item.closed_reason,
            }
            for item in matches
        ],
        "messages": [
            {
                "id": str(item.id),
                "match_id": str(item.match_id),
                "sender_id": str(item.sender_id),
                "mine": item.sender_id == user.id,
                "body": item.body,
                "created_at": item.created_at.isoformat(),
                "read_at": item.read_at.isoformat() if item.read_at else None,
            }
            for item in messages
        ],
        "date_plans": [
            {
                "id": str(item.id),
                "match_id": str(item.match_id),
                "title": item.title,
                "area": item.area,
                "scheduled_for": item.scheduled_for.isoformat(),
                "status": item.status,
            }
            for item in plans
        ],
        "blocked_user_ids": [str(item.blocked_id) for item in blocks],
        "verification_requests": [
            {
                "id": str(item.id),
                "method": item.method,
                "status": item.status,
                "note": item.note,
                "requested_at": item.requested_at.isoformat(),
                "reviewed_at": item.reviewed_at.isoformat()
                if item.reviewed_at
                else None,
            }
            for item in verification_requests
        ],
        "date_feedback": [
            {
                "plan_id": str(item.plan_id),
                "attended": item.attended,
                "felt_safe": item.felt_safe,
                "would_meet_again": item.would_meet_again,
                "note": item.note,
                "created_at": item.created_at.isoformat(),
            }
            for item in date_feedback
        ],
        "reports": [
            {
                "id": str(item.id),
                "category": item.category,
                "status": item.status,
                "resolution": item.resolution,
                "created_at": item.created_at.isoformat(),
            }
            for item in reports
        ],
    }
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="morrow-account-data.json"',
            "Cache-Control": "no-store",
        },
    )


class DeleteAccountIn(BaseModel):
    confirmation: Literal["MORROW 탈퇴"]


@router.delete("")
async def delete_account(
    body: DeleteAccountIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    match_ids = (
        (
            await session.execute(
                select(Match.id).where(
                    Match.status == "active",
                    or_(Match.user_a_id == user.id, Match.user_b_id == user.id),
                )
            )
        )
        .scalars()
        .all()
    )
    for match_id in match_ids:
        await publish_realtime(
            session,
            {
                "type": "match_closed",
                "match_id": str(match_id),
                "closed_by_id": str(user.id),
                "reason": "account_deleted",
            },
        )
    storage_keys = (
        (
            await session.execute(
                select(ProfilePhoto.storage_key).where(
                    ProfilePhoto.owner_id == user.id,
                    ProfilePhoto.storage_key.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    for storage_key in storage_keys:
        await media_storage.delete(storage_key)
    await session.delete(user)
    return {"status": "deleted"}
