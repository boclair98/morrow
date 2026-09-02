"""Unit checks for cross-instance infrastructure fallbacks."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.core.rate_limit import RequestLimiter


@pytest.fixture(autouse=True)
def _truncate() -> Iterator[None]:
    """This module does not require the integration database."""
    yield


@pytest.mark.asyncio
async def test_request_limiter_blocks_after_bucket_limit() -> None:
    limiter = RequestLimiter()

    assert await limiter.allow("member", "write", 2) is True
    assert await limiter.allow("member", "write", 2) is True
    assert await limiter.allow("member", "write", 2) is False
    assert await limiter.allow("other-member", "write", 2) is True
