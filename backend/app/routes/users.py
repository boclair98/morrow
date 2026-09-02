"""First-sight user upsert + /api/me.

The platform doesn't pre-create a row in the tenant DB. We do it lazily
on first sight, keyed on `coders_id` (the platform identity).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import PRIVACY_VERSION, TERMS_VERSION, is_admin, legal_complete
from app.core.database import get_session
from app.core.identity import optional_display_name, require_identity
from app.models import ProfilePhoto, User

router = APIRouter(prefix="/api", tags=["users"])


async def upsert_local_user(
    session: AsyncSession, coders_id: UUID, platform_name: str | None = None
) -> User:
    """Insert-on-first-sight; otherwise bump last_seen_at. When the visitor set a
    display name on coders.kr (`platform_name`), use it and keep it in sync;
    otherwise fall back to a generated `user-<id8>` handle."""
    name = platform_name or f"user-{str(coders_id)[:8]}"
    stmt = pg_insert(User).values(
        coders_id=coders_id,
        display_name=name,
        referral_code=coders_id.hex[:12].upper(),
    )
    if platform_name:
        stmt = stmt.on_conflict_do_update(
            index_elements=["coders_id"], set_={"display_name": platform_name}
        )
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=["coders_id"])
    await session.execute(stmt)
    res = await session.execute(select(User).where(User.coders_id == coders_id))
    user = res.scalar_one()
    user.last_seen_at = datetime.now(UTC)
    return user


@router.get("/me")
async def me(
    coders_id: UUID = Depends(require_identity),
    platform_name: str | None = Depends(optional_display_name),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return the signed-in visitor's app-local user row.

    Anonymous → 401 (`require_identity`). Anyone who got here has a
    valid coders.kr session.
    """
    user = await upsert_local_user(session, coders_id, platform_name)
    photos = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(ProfilePhoto.owner_id == user.id)
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
    )
    return {
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
        "profile_complete": user.profile_complete,
        "account_verified": user.account_verified,
        "verification_status": user.verification_status,
        "verified_at": user.verified_at.isoformat() if user.verified_at else None,
        "status": user.status,
        "discoverable": user.discoverable,
        "legal_complete": legal_complete(user),
        "current_terms_version": TERMS_VERSION,
        "current_privacy_version": PRIVACY_VERSION,
        "notify_matches": user.notify_matches,
        "notify_messages": user.notify_messages,
        "notify_dates": user.notify_dates,
        "marketing_opt_in": user.marketing_opt_in,
        "suspended_until": user.suspended_until.isoformat()
        if user.suspended_until
        else None,
        "is_admin": is_admin(coders_id),
        "photos": [
            {
                "id": str(photo.id),
                "url": f"/api/photos/{photo.id}",
                "content_type": photo.content_type,
                "byte_size": photo.byte_size,
                "position": photo.position,
                "is_public": photo.is_public,
                "moderation_status": photo.moderation_status,
                "moderation_reason": photo.moderation_reason,
            }
            for photo in photos
        ],
        "first_seen_at": user.first_seen_at.isoformat(),
    }
