"""Profile media storage with a database fallback for local development.

Production writes immutable objects to the managed bucket. Reads still pass
through the authenticated `/api/photos/{id}` route so blocks, moderation and
visibility rules cannot be bypassed by the frontend.
"""

from __future__ import annotations

import asyncio
import logging
from functools import cached_property

import boto3
import httpx
from botocore.config import Config

from app.core.config import settings

log = logging.getLogger(__name__)


class MediaStorage:
    @property
    def configured(self) -> bool:
        return all(
            (
                settings.storage_bucket,
                settings.storage_s3_endpoint,
                settings.storage_access_key,
                settings.storage_secret_key,
                settings.storage_public_url,
            )
        )

    @cached_property
    def client(self):
        if not self.configured:
            raise RuntimeError("object storage is not configured")
        return boto3.client(
            "s3",
            endpoint_url=settings.storage_s3_endpoint,
            aws_access_key_id=settings.storage_access_key,
            aws_secret_access_key=settings.storage_secret_key,
            region_name=settings.storage_region or "auto",
            config=Config(
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )

    async def put(self, key: str, content: bytes, content_type: str) -> None:
        if not key.startswith("profile/"):
            raise ValueError("unsupported media key")
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=settings.storage_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="private, max-age=3600",
        )

    async def fetch(self, key: str, max_bytes: int) -> bytes:
        if not self.configured or not key.startswith("profile/"):
            raise FileNotFoundError(key)
        url = f"{settings.storage_public_url.rstrip('/')}/{key}"
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.content
        if len(content) > max_bytes:
            raise ValueError("stored media exceeds expected size")
        return content

    async def delete(self, key: str) -> None:
        if not self.configured or not key.startswith("profile/"):
            return
        try:
            await asyncio.to_thread(
                self.client.delete_object,
                Bucket=settings.storage_bucket,
                Key=key,
            )
        except Exception:
            # The database row remains the source of truth for visibility.
            # A failed cleanup is safe and can be retried by an ops job later.
            log.exception("profile object cleanup failed", extra={"storage_key": key})


media_storage = MediaStorage()
