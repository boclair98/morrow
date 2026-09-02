from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode, urlparse
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models import AuthIdentity, AuthSession, OAuthFlow, User

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)
OAUTH_STATE_COOKIE = "morrow_oauth_state"
OAUTH_RETURN_TO_COOKIE = "morrow_oauth_return_to"
SUPPORTED_PROVIDERS = ("kakao", "naver", "google")


@dataclass(frozen=True)
class ProviderSettings:
    client_id: str
    client_secret: str
    redirect_uri: str


@dataclass(frozen=True)
class ProviderProfile:
    subject: str
    email: str | None
    display_name: str | None


class OAuthStartIn(BaseModel):
    turnstile_token: str = Field(default="", max_length=2_048)
    return_to: str = Field(default="/", max_length=200)


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _secure_cookie() -> bool:
    return urlparse(settings.public_app_url).scheme == "https"


def _safe_return_to(value: str | None) -> str:
    """Allow only same-origin relative paths after OAuth completes."""
    if not value:
        return "/"
    parsed = urlparse(value)
    if (
        not value.startswith("/")
        or value.startswith("//")
        or parsed.scheme
        or parsed.netloc
        or "\\" in value
    ):
        return "/"
    return value


def _provider_settings(provider: str) -> ProviderSettings | None:
    values = {
        "kakao": (
            settings.kakao_client_id,
            settings.kakao_client_secret,
            settings.kakao_redirect_uri,
        ),
        "naver": (
            settings.naver_client_id,
            settings.naver_client_secret,
            settings.naver_redirect_uri,
        ),
        "google": (
            settings.google_client_id,
            settings.google_client_secret,
            settings.google_redirect_uri,
        ),
    }.get(provider)
    if not values or not all(values):
        return None
    client_id, client_secret, redirect_uri = values
    return ProviderSettings(
        client_id=str(client_id),
        client_secret=str(client_secret),
        redirect_uri=str(redirect_uri),
    )


def _provider_item(provider: str, label: str) -> dict:
    configured = _provider_settings(provider) is not None
    return {
        "id": provider,
        "label": label,
        "configured": configured,
        "status": "active" if configured else "planned",
    }


@router.get("/providers")
async def providers() -> JSONResponse:
    """Return public login readiness and public widget keys only."""
    return JSONResponse(
        content={
            "native": None if settings.auth_mode == "standalone" else "coders.kr",
            "turnstile_required": bool(settings.turnstile_secret_key),
            "turnstile_site_key": settings.turnstile_site_key,
            "kakao_map_js_key": settings.next_public_kakao_map_js_key,
            "providers": [
                _provider_item("kakao", "카카오"),
                _provider_item("naver", "네이버"),
                _provider_item("google", "Google"),
            ],
        },
        headers={
            "Cache-Control": (
                "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"
            )
        },
    )


async def _verify_turnstile(token: str, request: Request) -> None:
    if not settings.turnstile_secret_key:
        return
    if not token:
        raise HTTPException(422, "사람인지 확인한 뒤 다시 시도해주세요")
    remote_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    payload = {"secret": settings.turnstile_secret_key, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            result = (
                await client.post(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    data=payload,
                )
            ).json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "보안 확인 서비스에 잠시 연결할 수 없어요") from exc
    expected_host = urlparse(settings.public_app_url).hostname
    if (
        not result.get("success")
        or not expected_host
        or result.get("hostname") != expected_host
    ):
        raise HTTPException(403, "보안 확인이 만료됐어요. 다시 시도해주세요")


def _authorization_url(
    provider: str,
    config: ProviderSettings,
    state: str,
    verifier: str | None,
    nonce: str | None,
) -> str:
    if provider == "kakao":
        base = "https://kauth.kakao.com/oauth/authorize"
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "state": state,
        }
    elif provider == "naver":
        base = "https://nid.naver.com/oauth2.0/authorize"
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "state": state,
        }
    else:
        base = "https://accounts.google.com/o/oauth2/v2/auth"
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256((verifier or "").encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce or "",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
    return f"{base}?{urlencode(params)}"


@router.post("/{provider}/start")
async def start_oauth(
    provider: str,
    body: OAuthStartIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(404, "지원하지 않는 로그인 방법이에요")
    config = _provider_settings(provider)
    if config is None:
        raise HTTPException(503, "아직 설정되지 않은 로그인 방법이에요")
    await _verify_turnstile(body.turnstile_token, request)

    state = secrets.token_urlsafe(40)
    verifier = secrets.token_urlsafe(64) if provider == "google" else None
    nonce = secrets.token_urlsafe(32) if provider == "google" else None
    session.add(
        OAuthFlow(
            provider=provider,
            state_hash=token_hash(state),
            code_verifier=verifier,
            nonce=nonce,
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )
    )
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path="/api/auth",
    )
    response.set_cookie(
        OAUTH_RETURN_TO_COOKIE,
        _safe_return_to(body.return_to),
        max_age=600,
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path="/api/auth",
    )
    return {
        "authorization_url": _authorization_url(
            provider, config, state, verifier, nonce
        )
    }


async def _exchange_code(
    provider: str,
    config: ProviderSettings,
    code: str,
    flow: OAuthFlow,
    state: str,
) -> str:
    if provider == "kakao":
        token_url = "https://kauth.kakao.com/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "redirect_uri": config.redirect_uri,
            "code": code,
        }
    elif provider == "naver":
        token_url = "https://nid.naver.com/oauth2.0/token"
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "code": code,
            "state": state,
        }
    else:
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "redirect_uri": config.redirect_uri,
            "code": code,
            "code_verifier": flow.code_verifier or "",
        }
    async with httpx.AsyncClient(timeout=10.0) as client:
        result = await client.post(token_url, data=payload)
        result.raise_for_status()
        access_token = result.json().get("access_token")
    if not access_token:
        raise ValueError("provider returned no access token")
    return str(access_token)


async def _provider_profile(provider: str, access_token: str) -> ProviderProfile:
    urls = {
        "kakao": "https://kapi.kakao.com/v2/user/me",
        "naver": "https://openapi.naver.com/v1/nid/me",
        "google": "https://openidconnect.googleapis.com/v1/userinfo",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            urls[provider], headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        payload = response.json()

    if provider == "kakao":
        account = payload.get("kakao_account") or {}
        properties = payload.get("properties") or {}
        email = account.get("email") if account.get("is_email_verified") else None
        subject = payload.get("id")
        display_name = properties.get("nickname")
    elif provider == "naver":
        profile = payload.get("response") or {}
        subject = profile.get("id")
        email = profile.get("email")
        display_name = profile.get("nickname") or profile.get("name")
    else:
        subject = payload.get("sub")
        email = payload.get("email") if payload.get("email_verified") else None
        display_name = payload.get("name")
    subject_text = str(subject).strip() if subject is not None else ""
    if not subject_text or len(subject_text) > 191:
        raise ValueError("provider returned an invalid subject")
    return ProviderProfile(
        subject=subject_text,
        email=email,
        display_name=display_name,
    )


async def _resolve_user(
    session: AsyncSession, provider: str, profile: ProviderProfile
) -> User:
    identity = await session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_subject == profile.subject,
        )
    )
    if identity:
        identity.last_login_at = datetime.now(UTC)
        user = await session.get(User, identity.user_id)
        if user is None:
            raise HTTPException(409, "로그인 계정을 복구할 수 없어요")
        return user

    email = profile.email.strip().lower() if profile.email else None
    if email and len(email) > 320:
        raise HTTPException(502, "로그인 제공사의 이메일 형식이 올바르지 않아요")
    if email and await session.scalar(
        select(AuthIdentity.id).where(AuthIdentity.email == email)
    ):
        raise HTTPException(
            409,
            "같은 이메일로 가입된 계정이 있어요. 기존 로그인 방법을 이용해주세요",
        )
    display_name = " ".join((profile.display_name or "").split())[:64]
    try:
        async with session.begin_nested():
            coders_id = uuid4()
            user = User(
                coders_id=coders_id,
                display_name=display_name,
                referral_code=coders_id.hex[:12].upper(),
            )
            session.add(user)
            await session.flush()
            session.add(
                AuthIdentity(
                    user_id=user.id,
                    provider=provider,
                    provider_subject=profile.subject,
                    email=email,
                )
            )
            await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            409,
            "같은 계정으로 가입된 사용자가 있어요. 다시 로그인해주세요",
        ) from exc
    return user


def _callback_error(code: str) -> RedirectResponse:
    response = RedirectResponse(
        f"{settings.public_app_url}/login?auth_error={code}", status_code=303
    )
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/api/auth")
    response.delete_cookie(OAUTH_RETURN_TO_COOKIE, path="/api/auth")
    return response


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    if provider not in SUPPORTED_PROVIDERS:
        return _callback_error("unsupported")
    if request.query_params.get("error"):
        return _callback_error("cancelled")
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if (
        not code
        or not state
        or not cookie_state
        or not secrets.compare_digest(state, cookie_state)
    ):
        return _callback_error("expired")
    flow = await session.scalar(
        select(OAuthFlow).where(OAuthFlow.state_hash == token_hash(state))
    )
    now = datetime.now(UTC)
    if (
        flow is None
        or flow.provider != provider
        or flow.used_at is not None
        or flow.expires_at <= now
    ):
        return _callback_error("expired")
    config = _provider_settings(provider)
    if config is None:
        return _callback_error("configuration")
    flow.used_at = now
    try:
        access_token = await _exchange_code(provider, config, code, flow, state)
        profile = await _provider_profile(provider, access_token)
        user = await _resolve_user(session, provider, profile)
    except HTTPException as exc:
        logger.warning(
            "oauth callback rejected provider=%s status=%s",
            provider,
            exc.status_code,
        )
        if exc.status_code == 409:
            return _callback_error("account_conflict")
        return _callback_error("provider")
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("oauth callback failed provider=%s", provider)
        return _callback_error("provider")

    raw_session = secrets.token_urlsafe(48)
    session.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash(raw_session),
            expires_at=now + timedelta(days=settings.session_days),
        )
    )
    return_to = _safe_return_to(request.cookies.get(OAUTH_RETURN_TO_COOKIE))
    separator = "&" if "?" in return_to else "?"
    response = RedirectResponse(
        f"{settings.public_app_url.rstrip('/')}{return_to}{separator}auth=success",
        status_code=303,
    )
    response.set_cookie(
        settings.session_cookie_name,
        raw_session,
        max_age=settings.session_days * 24 * 60 * 60,
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path="/",
    )
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/api/auth")
    response.delete_cookie(OAUTH_RETURN_TO_COOKIE, path="/api/auth")
    return response


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> None:
    raw_session = request.cookies.get(settings.session_cookie_name)
    if raw_session:
        auth_session = await session.scalar(
            select(AuthSession).where(AuthSession.token_hash == token_hash(raw_session))
        )
        if auth_session:
            await session.delete(auth_session)
    response.delete_cookie(settings.session_cookie_name, path="/")
