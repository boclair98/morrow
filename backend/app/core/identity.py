"""Identity dependencies for native and app-owned standalone sessions."""

from __future__ import annotations

import hashlib
import urllib.parse
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models import AuthSession, User


def _parse_uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def identity_from_values(
    session: AsyncSession,
    *,
    x_coders_user: str | None,
    session_token: str | None,
) -> UUID | None:
    """Resolve a trusted identity without accepting spoofable standalone headers."""
    if settings.auth_mode != "standalone":
        native_id = _parse_uuid(x_coders_user)
        if native_id is not None:
            return native_id

    if session_token:
        now = datetime.now(UTC)
        auth_session = await session.scalar(
            select(AuthSession).where(
                AuthSession.token_hash == _token_hash(session_token),
                AuthSession.expires_at > now,
            )
        )
        if auth_session:
            user = await session.get(User, auth_session.user_id)
            if user:
                last_used = auth_session.last_used_at
                if last_used.tzinfo is None:
                    last_used = last_used.replace(tzinfo=UTC)
                if now - last_used >= timedelta(hours=6):
                    auth_session.last_used_at = now
                return user.coders_id

    return _parse_uuid(settings.dev_fake_user)


async def optional_identity(
    request: Request,
    x_coders_user: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> UUID | None:
    return await identity_from_values(
        session,
        x_coders_user=x_coders_user,
        session_token=request.cookies.get(settings.session_cookie_name),
    )


async def optional_display_name(
    x_coders_user_name: str | None = Header(default=None),
) -> str | None:
    if settings.auth_mode == "standalone" or not x_coders_user_name:
        return None
    name = urllib.parse.unquote(x_coders_user_name).strip()
    return name or None


async def require_identity(
    identity: UUID | None = Depends(optional_identity),
) -> UUID:
    if identity is None:
        raise HTTPException(status_code=401, detail="sign in required")
    return identity
