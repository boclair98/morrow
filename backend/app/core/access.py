from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException

from app.core.config import settings
from app.core.identity import require_identity
from app.models import User

TERMS_VERSION = "2026-08-22"
PRIVACY_VERSION = "2026-08-22"


def legal_complete(user: User) -> bool:
    return bool(
        user.terms_version == TERMS_VERSION
        and user.privacy_version == PRIVACY_VERSION
        and user.terms_agreed_at
        and user.privacy_agreed_at
        and user.adult_confirmed_at
    )


def ensure_active(user: User, *, require_legal: bool = True) -> None:
    if user.status == "suspended" and user.suspended_until:
        suspended_until = user.suspended_until
        if suspended_until.tzinfo is None:
            suspended_until = suspended_until.replace(tzinfo=UTC)
        if suspended_until <= datetime.now(UTC):
            user.status = "active"
            user.suspended_until = None
    if user.status == "suspended":
        raise HTTPException(403, "안전 정책에 따라 계정 이용이 일시 제한됐어요")
    if user.status == "banned":
        raise HTTPException(403, "안전 정책에 따라 계정 이용이 제한됐어요")
    if require_legal and not legal_complete(user):
        raise HTTPException(428, "최신 이용약관과 개인정보 처리방침 동의가 필요해요")


def admin_ids() -> set[UUID]:
    ids: set[UUID] = set()
    for value in settings.admin_coders_ids.split(","):
        try:
            ids.add(UUID(value.strip()))
        except (ValueError, AttributeError):
            continue
    return ids


def is_admin(coders_id: UUID) -> bool:
    return coders_id in admin_ids()


async def require_admin(coders_id: UUID = Depends(require_identity)) -> UUID:
    if not is_admin(coders_id):
        raise HTTPException(404, "not found")
    return coders_id
