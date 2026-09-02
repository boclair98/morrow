import hashlib
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.rate_limit import request_limiter
from app.core.realtime import realtime_hub
from app.routes.account import router as account_router
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.dating import router as dating_router
from app.routes.growth import router as growth_router
from app.routes.notifications import router as notifications_router
from app.routes.photos import router as photos_router
from app.routes.places import router as places_router
from app.routes.realtime import router as realtime_router
from app.routes.sync import router as sync_router
from app.routes.trust import router as trust_router
from app.routes.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await request_limiter.start()
    await realtime_hub.start()
    try:
        yield
    finally:
        await realtime_hub.stop()
        await request_limiter.stop()


app = FastAPI(
    title="MORROW API",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.include_router(users_router)
app.include_router(dating_router)
app.include_router(growth_router)
app.include_router(auth_router)
app.include_router(photos_router)
app.include_router(places_router)
app.include_router(realtime_router)
app.include_router(sync_router)
app.include_router(trust_router)
app.include_router(account_router)
app.include_router(notifications_router)
app.include_router(admin_router)


def same_origin(value: str, expected: str) -> bool:
    """Compare browser origins without trusting proxy-rewritten Host headers."""
    try:
        actual_url = urlparse(value)
        expected_url = urlparse(expected)
        actual_port = actual_url.port or (443 if actual_url.scheme == "https" else 80)
        expected_port = expected_url.port or (
            443 if expected_url.scheme == "https" else 80
        )
    except ValueError:
        return False
    return (
        actual_url.scheme == expected_url.scheme
        and actual_url.hostname == expected_url.hostname
        and actual_port == expected_port
    )


class SafetyMiddleware(BaseHTTPMiddleware):
    """Small, dependency-free abuse guard in addition to the coders.kr gate."""

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid4())
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            try:
                length = int(request.headers.get("content-length", "0") or 0)
            except ValueError:
                return JSONResponse(
                    {"detail": "invalid content length"}, status_code=400
                )
            # Photo payloads are client-resized base64 data URLs. Keep the
            # ordinary JSON API small while allowing one bounded image upload.
            max_length = (
                4_000_000
                if request.url.path.startswith("/api/profile/photos")
                else 32_768
            )
            if length > max_length:
                return JSONResponse({"detail": "request too large"}, status_code=413)

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = request.headers.get("origin")
            origin_allowed = bool(
                origin and same_origin(origin, settings.public_app_url)
            )
            if origin and not origin_allowed and not settings.dev_fake_user:
                return JSONResponse(
                    {"detail": "origin not allowed"},
                    status_code=403,
                    headers={"X-Request-ID": request_id},
                )

        identity = (
            request.headers.get("x-coders-user")
            if settings.auth_mode != "standalone"
            else None
        )
        session_cookie = request.cookies.get(settings.session_cookie_name)
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        client = request.client.host if request.client else "unknown"
        session_bucket = (
            hashlib.sha256(session_cookie.encode()).hexdigest()
            if session_cookie
            else None
        )
        bucket_key = identity or session_bucket or forwarded or client
        limit = 45 if request.method not in {"GET", "HEAD", "OPTIONS"} else 180
        kind = "write" if limit == 45 else "read"
        if not await request_limiter.allow(bucket_key, kind, limit):
            return JSONResponse(
                {"detail": "too many requests"},
                status_code=429,
                headers={"Retry-After": "60"},
            )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        response.headers["X-Request-ID"] = request_id
        if (
            request.url.path.startswith("/api/")
            and not request.url.path.startswith("/api/photos/")
            and request.url.path != "/api/auth/providers"
        ):
            response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SafetyMiddleware)


@app.get("/api/health")
async def health() -> JSONResponse:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503, content={"status": "error", "detail": "database"}
        )
    return JSONResponse(content={"status": "ok"})


@app.get("/api/health/live")
async def liveness() -> JSONResponse:
    """Liveness probe — answers the instant this process can serve a request,
    touching NOTHING (no DB, no I/O). The frontend's warming banner
    (frontend/lib/warming.ts) hits this to tell a real cold start apart from a
    merely slow request: when the api KSvc is scaled to zero, Knative's
    activator buffers this until a pod is up, so the probe is slow ⇔ the server
    is genuinely waking. When warm it returns in ~1ms even while a heavy
    endpoint is still in flight — so the banner stays off for ordinary slowness.
    Keep it dependency-free; adding a DB hit here would reintroduce false
    'warming' whenever the DB (not the pod) is the slow part."""
    return JSONResponse(content={"status": "ok"})
