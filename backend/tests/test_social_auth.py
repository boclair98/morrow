"""Database-free checks for the standalone social-auth boundary."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from app.core.config import settings
from app.core.identity import identity_from_values
from app.models import AuthSession, OAuthFlow, User
from app.routes.auth import (
    OAUTH_RETURN_TO_COOKIE,
    OAuthStartIn,
    _callback_error,
    _safe_return_to,
    providers,
    start_oauth,
    token_hash,
)
from fastapi import Response
from starlette.requests import Request


@pytest.fixture(autouse=True)
def _truncate() -> Iterator[None]:
    """Override the integration-suite database fixture in this unit module."""
    yield


class AddedObjects:
    def __init__(self) -> None:
        self.items: list[object] = []

    def add(self, item: object) -> None:
        self.items.append(item)


@pytest.mark.asyncio
async def test_standalone_start_uses_state_cookie_and_no_secret_leak(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "auth_mode", "standalone")
    monkeypatch.setattr(settings, "public_app_url", "https://morrow.coders.kr")
    monkeypatch.setattr(settings, "naver_client_id", "public-client")
    monkeypatch.setattr(settings, "naver_client_secret", "server-secret")
    monkeypatch.setattr(
        settings,
        "naver_redirect_uri",
        "https://morrow.coders.kr/api/auth/naver/callback",
    )
    monkeypatch.setattr(settings, "turnstile_secret_key", None)

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/auth/naver/start",
            "headers": [],
            "client": ("127.0.0.1", 1234),
        }
    )
    response = Response()
    session = AddedObjects()

    payload = await start_oauth(
        "naver",
        OAuthStartIn(return_to="/matches"),
        request,
        response,
        session,  # type: ignore[arg-type]
    )
    query = parse_qs(urlparse(payload["authorization_url"]).query)
    cookie = "; ".join(
        value.decode("latin-1")
        for name, value in response.raw_headers
        if name.lower() == b"set-cookie"
    ).lower()

    assert query["client_id"] == ["public-client"]
    assert query["redirect_uri"] == ["https://morrow.coders.kr/api/auth/naver/callback"]
    assert "server-secret" not in payload["authorization_url"]
    assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie
    assert OAUTH_RETURN_TO_COOKIE in cookie and "/matches" in cookie
    assert len(session.items) == 1
    assert isinstance(session.items[0], OAuthFlow)
    assert session.items[0].state_hash == token_hash(query["state"][0])


@pytest.mark.asyncio
async def test_public_provider_configuration_never_returns_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "kakao_client_id", "kakao-public")
    monkeypatch.setattr(settings, "kakao_client_secret", "kakao-server-secret")
    monkeypatch.setattr(
        settings,
        "kakao_redirect_uri",
        "https://morrow.coders.kr/api/auth/kakao/callback",
    )

    response = await providers()
    payload = json.loads(response.body)

    assert payload["providers"][0]["status"] == "active"
    assert "kakao-server-secret" not in str(payload)
    assert "s-maxage=86400" in response.headers["cache-control"]


@pytest.mark.asyncio
async def test_standalone_ignores_spoofed_platform_identity_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "auth_mode", "standalone")
    monkeypatch.setattr(settings, "dev_fake_user", None)

    identity = await identity_from_values(
        SimpleNamespace(),  # type: ignore[arg-type]
        x_coders_user=str(uuid4()),
        session_token=None,
    )

    assert identity is None


@pytest.mark.asyncio
async def test_hashed_session_cookie_resolves_local_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "auth_mode", "standalone")
    monkeypatch.setattr(settings, "dev_fake_user", None)
    now = datetime.now(UTC)
    user_id = uuid4()
    coders_id = uuid4()
    raw_token = "browser-only-session-token"
    user = User(id=user_id, coders_id=coders_id, display_name="")
    auth_session = AuthSession(
        user_id=user_id,
        token_hash=token_hash(raw_token),
        expires_at=now + timedelta(days=1),
        last_used_at=now,
    )

    class Session:
        async def scalar(self, _query: object) -> AuthSession:
            return auth_session

        async def get(self, _model: object, key: object) -> User | None:
            return user if key == user_id else None

    identity = await identity_from_values(
        Session(),  # type: ignore[arg-type]
        x_coders_user=str(uuid4()),
        session_token=raw_token,
    )

    assert identity == coders_id


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "authorization_host"),
    [
        ("kakao", "kauth.kakao.com"),
        ("naver", "nid.naver.com"),
        ("google", "accounts.google.com"),
    ],
)
async def test_every_social_provider_builds_a_safe_authorization_url(
    monkeypatch: pytest.MonkeyPatch,
    provider: str,
    authorization_host: str,
) -> None:
    monkeypatch.setattr(settings, "public_app_url", "https://morrow.coders.kr")
    monkeypatch.setattr(settings, "turnstile_secret_key", None)
    monkeypatch.setattr(settings, f"{provider}_client_id", f"{provider}-public")
    monkeypatch.setattr(settings, f"{provider}_client_secret", "server-only-secret")
    monkeypatch.setattr(
        settings,
        f"{provider}_redirect_uri",
        f"https://morrow.coders.kr/api/auth/{provider}/callback",
    )
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": f"/api/auth/{provider}/start",
            "headers": [],
            "client": ("127.0.0.1", 1234),
        }
    )
    response = Response()
    session = AddedObjects()

    payload = await start_oauth(
        provider,
        OAuthStartIn(),
        request,
        response,
        session,  # type: ignore[arg-type]
    )
    parsed = urlparse(payload["authorization_url"])
    query = parse_qs(parsed.query)

    assert parsed.hostname == authorization_host
    assert query["client_id"] == [f"{provider}-public"]
    assert query["redirect_uri"] == [
        f"https://morrow.coders.kr/api/auth/{provider}/callback"
    ]
    assert "server-only-secret" not in payload["authorization_url"]
    if provider == "google":
        assert query["code_challenge_method"] == ["S256"]
        assert query["code_challenge"]


def test_oauth_errors_return_to_visible_login_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "public_app_url", "https://morrow.coders.kr")

    response = _callback_error("provider")

    assert response.headers["location"] == (
        "https://morrow.coders.kr/login?auth_error=provider"
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("/matches", "/matches"),
        ("/matches?tab=sync", "/matches?tab=sync"),
        ("https://evil.example", "/"),
        ("//evil.example", "/"),
        (r"/\\evil.example", "/"),
    ],
)
def test_return_to_only_allows_same_origin_relative_paths(
    value: str, expected: str
) -> None:
    assert _safe_return_to(value) == expected
