from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import desc, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.identity import require_identity
from app.models import AuthIdentity, ProfilePhoto, User, VerificationRequest
from app.routes.dating import current_user

router = APIRouter(prefix="/api/verification", tags=["verification"])


def verification_item(user: User, request: VerificationRequest | None) -> dict:
    return {
        "verified": user.account_verified,
        "status": user.verification_status,
        "verified_at": user.verified_at.isoformat() if user.verified_at else None,
        "request": (
            {
                "id": str(request.id),
                "method": request.method,
                "status": request.status,
                "note": request.note if request.status == "rejected" else None,
                "requested_at": request.requested_at.isoformat(),
                "reviewed_at": request.reviewed_at.isoformat()
                if request.reviewed_at
                else None,
            }
            if request
            else None
        ),
    }


async def latest_request(
    session: AsyncSession, user_id: UUID
) -> VerificationRequest | None:
    return await session.scalar(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == user_id)
        .order_by(desc(VerificationRequest.requested_at))
        .limit(1)
    )


@router.get("")
async def verification_status(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    return verification_item(user, await latest_request(session, user.id))


class VerificationRequestIn(BaseModel):
    note: str = Field(default="", max_length=240)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        return " ".join(value.split())


@router.post("/request", status_code=201)
async def request_verification(
    body: VerificationRequestIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if user.account_verified:
        return verification_item(user, await latest_request(session, user.id))
    if not user.profile_complete:
        raise HTTPException(409, "프로필을 먼저 완성해주세요")
    has_social_identity = await session.scalar(
        select(exists().where(AuthIdentity.user_id == user.id))
    )
    if not has_social_identity:
        raise HTTPException(409, "소셜 로그인 계정 확인이 필요해요")
    has_approved_photo = await session.scalar(
        select(
            exists().where(
                ProfilePhoto.owner_id == user.id,
                ProfilePhoto.is_public.is_(True),
                ProfilePhoto.moderation_status == "approved",
            )
        )
    )
    if not has_approved_photo:
        raise HTTPException(409, "운영팀이 승인한 얼굴 프로필 사진이 1장 이상 필요해요")
    pending = await session.scalar(
        select(VerificationRequest).where(
            VerificationRequest.user_id == user.id,
            VerificationRequest.status == "pending",
        )
    )
    if pending:
        return verification_item(user, pending)
    request = VerificationRequest(
        user_id=user.id,
        method="manual",
        note=body.note or None,
    )
    session.add(request)
    user.verification_status = "pending"
    await session.flush()
    return verification_item(user, request)
