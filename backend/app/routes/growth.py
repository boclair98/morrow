from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.identity import require_identity
from app.models import User
from app.notifications import create_notification
from app.routes.dating import current_user

router = APIRouter(prefix="/api/growth", tags=["growth"])


async def referral_summary(session: AsyncSession, user: User) -> dict:
    invited = await session.scalar(
        select(func.count(User.id)).where(User.referred_by_user_id == user.id)
    )
    return {
        "code": user.referral_code,
        "invite_url": f"{settings.public_app_url.rstrip('/')}/login?ref={user.referral_code}",
        "invited_count": int(invited or 0),
        "redeemed": user.referred_by_user_id is not None,
    }


@router.get("/referral")
async def referral(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    return await referral_summary(session, user)


class RedeemReferralIn(BaseModel):
    code: str = Field(min_length=8, max_length=12)

    @field_validator("code")
    @classmethod
    def clean_code(cls, value: str) -> str:
        return value.strip().upper()


@router.post("/referral/redeem")
async def redeem_referral(
    body: RedeemReferralIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if user.referred_by_user_id:
        raise HTTPException(409, "이미 초대 코드를 등록했어요")
    first_seen = user.first_seen_at
    if first_seen.tzinfo is None:
        first_seen = first_seen.replace(tzinfo=UTC)
    if first_seen < datetime.now(UTC) - timedelta(days=14):
        raise HTTPException(409, "초대 코드는 가입 후 14일 안에 등록할 수 있어요")
    inviter = await session.scalar(select(User).where(User.referral_code == body.code))
    if inviter is None:
        raise HTTPException(404, "초대 코드를 확인해주세요")
    if inviter.id == user.id:
        raise HTTPException(400, "내 초대 코드는 등록할 수 없어요")
    user.referred_by_user_id = inviter.id
    await create_notification(
        session,
        user_id=inviter.id,
        kind="growth",
        title="친구가 MORROW에 합류했어요",
        body="초대 링크를 통해 새로운 회원이 가입했어요.",
        action_type="profile",
        action_id=user.id,
        dedupe_key=f"referral:{user.id}",
    )
    return await referral_summary(session, user)
