from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.access import require_admin
from app.core.database import get_session
from app.core.realtime import publish_realtime
from app.models import (
    AuthIdentity,
    Match,
    ModerationAction,
    ProfilePhoto,
    Report,
    User,
    VerificationRequest,
)
from app.notifications import create_notification

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def close_user_matches(session: AsyncSession, user_id: UUID, reason: str) -> None:
    result = await session.execute(
        update(Match)
        .where(
            Match.status == "active",
            or_(Match.user_a_id == user_id, Match.user_b_id == user_id),
        )
        .values(
            status="closed",
            closed_by_id=user_id,
            closed_reason=reason,
            closed_at=datetime.now(UTC),
        )
        .returning(Match.id)
    )
    for match_id in result.scalars().all():
        await publish_realtime(
            session,
            {
                "type": "match_closed",
                "match_id": str(match_id),
                "closed_by_id": str(user_id),
                "reason": reason,
            },
        )


@router.get("/overview")
async def moderation_overview(
    _admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    (
        user_count,
        pending_reports,
        pending_photos,
        pending_verifications,
        suspended_count,
    ) = (
        await session.execute(
            select(
                select(func.count(User.id)).scalar_subquery(),
                select(func.count(Report.id))
                .where(Report.status == "pending")
                .scalar_subquery(),
                select(func.count(ProfilePhoto.id))
                .where(ProfilePhoto.moderation_status == "pending")
                .scalar_subquery(),
                select(func.count(VerificationRequest.id))
                .where(VerificationRequest.status == "pending")
                .scalar_subquery(),
                select(func.count(User.id))
                .where(User.status.in_(["suspended", "banned"]))
                .scalar_subquery(),
            )
        )
    ).one()
    return {
        "users": int(user_count or 0),
        "pending_reports": int(pending_reports or 0),
        "pending_photos": int(pending_photos or 0),
        "pending_verifications": int(pending_verifications or 0),
        "restricted_users": int(suspended_count or 0),
    }


@router.get("/reports")
async def moderation_reports(
    status: str = Query(default="pending", pattern="^(pending|resolved|dismissed)$"),
    limit: int = Query(default=40, ge=1, le=100),
    _admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    reporter = aliased(User)
    reported = aliased(User)
    rows = (
        await session.execute(
            select(
                Report, reporter.display_name, reported.display_name, reported.status
            )
            .join(reporter, reporter.id == Report.reporter_id)
            .join(reported, reported.id == Report.reported_id)
            .where(Report.status == status)
            .order_by(Report.priority.desc(), Report.created_at)
            .limit(limit)
        )
    ).all()
    return {
        "items": [
            {
                "id": str(item.id),
                "reporter_name": reporter_name,
                "reported_user_id": str(item.reported_id),
                "reported_name": reported_name,
                "reported_status": reported_status,
                "category": item.category,
                "detail": item.detail,
                "priority": item.priority,
                "status": item.status,
                "created_at": item.created_at.isoformat(),
            }
            for item, reporter_name, reported_name, reported_status in rows
        ]
    }


class ResolveReportIn(BaseModel):
    resolution: Literal["dismiss", "warn", "suspend_7d", "ban"]
    note: str = Field(default="", max_length=500)


@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: UUID,
    body: ResolveReportIn,
    admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    report = await session.get(Report, report_id)
    if report is None:
        raise HTTPException(404, "신고를 찾지 못했어요")
    if report.status != "pending":
        raise HTTPException(409, "이미 처리된 신고입니다")
    reported = await session.get(User, report.reported_id)
    if reported is None:
        raise HTTPException(404, "사용자를 찾지 못했어요")

    now = datetime.now(UTC)
    report.status = "dismissed" if body.resolution == "dismiss" else "resolved"
    report.resolution = body.resolution
    report.admin_note = " ".join(body.note.split()) or None
    report.resolved_at = now

    if body.resolution == "warn":
        reported.safety_strikes += 1
    elif body.resolution == "suspend_7d":
        reported.status = "suspended"
        reported.suspended_until = now + timedelta(days=7)
        reported.discoverable = False
        await close_user_matches(session, reported.id, "suspended")
    elif body.resolution == "ban":
        reported.status = "banned"
        reported.suspended_until = None
        reported.discoverable = False
        await close_user_matches(session, reported.id, "banned")

    session.add(
        ModerationAction(
            admin_coders_id=admin_id,
            subject_user_id=reported.id,
            report_id=report.id,
            action=body.resolution,
            note=report.admin_note,
        )
    )
    reporter = await session.get(User, report.reporter_id)
    if reporter:
        await create_notification(
            session,
            user_id=reporter.id,
            kind="safety",
            title="신고 검토가 완료됐어요",
            body="접수한 신고를 안전 운영 기준에 따라 확인했습니다.",
            action_type="safety",
            action_id=report.id,
            dedupe_key=f"report:{report.id}",
        )
    return {"status": report.status, "resolution": body.resolution}


@router.get("/photos")
async def moderation_photos(
    status: str = Query(default="pending", pattern="^(pending|approved|rejected)$"),
    limit: int = Query(default=40, ge=1, le=100),
    _admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    rows = (
        await session.execute(
            select(ProfilePhoto, User.display_name)
            .join(User, User.id == ProfilePhoto.owner_id)
            .where(ProfilePhoto.moderation_status == status)
            .order_by(ProfilePhoto.created_at)
            .limit(limit)
        )
    ).all()
    return {
        "items": [
            {
                "id": str(photo.id),
                "owner_id": str(photo.owner_id),
                "owner_name": owner_name,
                "url": f"/api/photos/{photo.id}",
                "byte_size": photo.byte_size,
                "status": photo.moderation_status,
                "created_at": photo.created_at.isoformat(),
            }
            for photo, owner_name in rows
        ]
    }


class ModeratePhotoIn(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str = Field(default="", max_length=240)


@router.post("/photos/{photo_id}/moderate")
async def moderate_photo(
    photo_id: UUID,
    body: ModeratePhotoIn,
    admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    photo = await session.get(ProfilePhoto, photo_id)
    if photo is None:
        raise HTTPException(404, "사진을 찾지 못했어요")
    photo.moderation_status = body.decision
    photo.moderation_reason = " ".join(body.reason.split()) or None
    photo.moderated_at = datetime.now(UTC)
    if body.decision == "rejected":
        photo.is_public = False
    session.add(
        ModerationAction(
            admin_coders_id=admin_id,
            subject_user_id=photo.owner_id,
            photo_id=photo.id,
            action=f"photo_{body.decision}",
            note=photo.moderation_reason,
        )
    )
    if body.decision == "rejected":
        await create_notification(
            session,
            user_id=photo.owner_id,
            kind="safety",
            title="프로필 사진을 확인해주세요",
            body="커뮤니티 가이드에 맞지 않아 사진 공개가 중단됐어요.",
            action_type="profile",
            action_id=photo.id,
            dedupe_key=f"photo:{photo.id}",
        )
    return {"status": photo.moderation_status}


@router.get("/verifications")
async def verification_queue(
    status: str = Query(default="pending", pattern="^(pending|approved|rejected)$"),
    limit: int = Query(default=40, ge=1, le=100),
    _admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    rows = (
        await session.execute(
            select(VerificationRequest, User)
            .join(User, User.id == VerificationRequest.user_id)
            .where(VerificationRequest.status == status)
            .order_by(VerificationRequest.requested_at)
            .limit(limit)
        )
    ).all()
    items = []
    for request, user in rows:
        photo = await session.scalar(
            select(ProfilePhoto)
            .where(
                ProfilePhoto.owner_id == user.id,
                ProfilePhoto.is_public.is_(True),
                ProfilePhoto.moderation_status == "approved",
            )
            .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            .limit(1)
        )
        providers = (
            (
                await session.execute(
                    select(AuthIdentity.provider).where(AuthIdentity.user_id == user.id)
                )
            )
            .scalars()
            .all()
        )
        items.append(
            {
                "id": str(request.id),
                "user_id": str(user.id),
                "display_name": user.display_name,
                "age": user.age,
                "area": user.area,
                "method": request.method,
                "status": request.status,
                "note": request.note,
                "photo_url": f"/api/photos/{photo.id}" if photo else None,
                "social_providers": sorted(set(providers)),
                "requested_at": request.requested_at.isoformat(),
            }
        )
    return {"items": items}


class ReviewVerificationIn(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=500)


@router.post("/verifications/{request_id}/review")
async def review_verification(
    request_id: UUID,
    body: ReviewVerificationIn,
    admin_id: UUID = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    request = await session.get(VerificationRequest, request_id)
    if request is None:
        raise HTTPException(404, "본인확인 요청을 찾지 못했어요")
    if request.status != "pending":
        raise HTTPException(409, "이미 처리된 요청입니다")
    user = await session.get(User, request.user_id)
    if user is None:
        raise HTTPException(404, "사용자를 찾지 못했어요")
    if body.decision == "approved":
        approved_photo = await session.scalar(
            select(ProfilePhoto.id).where(
                ProfilePhoto.owner_id == user.id,
                ProfilePhoto.is_public.is_(True),
                ProfilePhoto.moderation_status == "approved",
            )
        )
        if approved_photo is None:
            raise HTTPException(409, "승인된 프로필 사진이 없어 확인할 수 없어요")
    now = datetime.now(UTC)
    request.status = body.decision
    request.reviewer_coders_id = admin_id
    request.reviewed_at = now
    request.note = " ".join(body.note.split()) or None
    user.account_verified = body.decision == "approved"
    user.verification_status = "verified" if body.decision == "approved" else "rejected"
    user.verified_at = now if body.decision == "approved" else None
    session.add(
        ModerationAction(
            admin_coders_id=admin_id,
            subject_user_id=user.id,
            action=f"verification_{body.decision}",
            note=request.note,
        )
    )
    await create_notification(
        session,
        user_id=user.id,
        kind="safety",
        title="본인확인 검토가 완료됐어요",
        body=(
            "본인확인이 완료되어 프로필에 확인 배지가 표시돼요."
            if body.decision == "approved"
            else "확인할 내용이 있어 본인확인이 보류됐어요. 내 프로필에서 확인해주세요."
        ),
        action_type="profile",
        action_id=user.id,
        dedupe_key=f"verification:{request.id}",
    )
    return {"status": request.status, "verified": user.account_verified}
