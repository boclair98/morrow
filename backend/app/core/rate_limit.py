"""Cross-instance fixed-window request limiting with an in-memory fallback."""

from __future__ import annotations

import hashlib
import logging
from collections import defaultdict, deque
from time import monotonic, time

from redis.asyncio import Redis

from app.core.config import settings

log = logging.getLogger(__name__)


class RequestLimiter:
    def __init__(self) -> None:
        self._redis: Redis | None = None
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_cleanup = monotonic()

    async def start(self) -> None:
        if not settings.redis_url:
            return
        client = Redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=False,
            socket_connect_timeout=2,
            socket_timeout=2,
            health_check_interval=30,
        )
        try:
            await client.ping()
        except Exception:
            await client.aclose()
            log.exception("redis rate limiter unavailable; using local fallback")
            return
        self._redis = client

    async def stop(self) -> None:
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    async def allow(self, bucket: str, kind: str, limit: int) -> bool:
        digest = hashlib.sha256(f"{bucket}:{kind}".encode()).hexdigest()
        if self._redis:
            window = int(time()) // 60
            key = f"morrow:rate:{window}:{digest}"
            try:
                async with self._redis.pipeline(transaction=True) as pipeline:
                    pipeline.incr(key)
                    pipeline.expire(key, 65)
                    count, _ = await pipeline.execute()
                return int(count) <= limit
            except Exception:
                log.exception("redis rate limit check failed; using local fallback")
        return self._allow_local(digest, limit)

    def _allow_local(self, key: str, limit: int) -> bool:
        now = monotonic()
        if now - self._last_cleanup >= 300:
            stale = [
                item
                for item, bucket in self._hits.items()
                if not bucket or now - bucket[-1] > 60
            ]
            for item in stale:
                self._hits.pop(item, None)
            self._last_cleanup = now
        bucket = self._hits[key]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


request_limiter = RequestLimiter()
