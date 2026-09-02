"""Account, consent, and privacy lifecycle tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_anonymous_cannot_read_account(client: AsyncClient) -> None:
    response = await client.get("/api/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_first_sight_account_is_unverified_and_requires_consent(
    client: AsyncClient, signed_in_headers: dict[str, str]
) -> None:
    response = await client.get("/api/me", headers=signed_in_headers)
    assert response.status_code == 200
    account = response.json()
    assert account["coders_id"] == signed_in_headers["X-Coders-User"]
    assert account["account_verified"] is False
    assert account["legal_complete"] is False
    assert account["profile_complete"] is False


@pytest.mark.asyncio
async def test_required_consents_unlock_account_settings(
    client: AsyncClient, signed_in_headers: dict[str, str]
) -> None:
    browser_headers = {
        **signed_in_headers,
        "Origin": "https://morrow.coders.kr",
    }
    consent = await client.post(
        "/api/account/consents",
        headers=browser_headers,
        json={
            "terms_agreed": True,
            "privacy_agreed": True,
            "adult_confirmed": True,
            "marketing_opt_in": False,
        },
    )
    assert consent.status_code == 200, consent.text
    assert consent.json()["settings"]["legal_complete"] is True

    updated = await client.patch(
        "/api/account/settings",
        headers=browser_headers,
        json={"discoverable": False, "notify_messages": False},
    )
    assert updated.status_code == 200, updated.text
    settings = updated.json()["settings"]
    assert settings["discoverable"] is False
    assert settings["notify_messages"] is False


@pytest.mark.asyncio
async def test_cross_site_account_mutation_is_rejected(
    client: AsyncClient, signed_in_headers: dict[str, str]
) -> None:
    response = await client.post(
        "/api/account/consents",
        headers={**signed_in_headers, "Origin": "https://attacker.example"},
        json={
            "terms_agreed": True,
            "privacy_agreed": True,
            "adult_confirmed": True,
            "marketing_opt_in": False,
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "origin not allowed"


@pytest.mark.asyncio
async def test_account_export_contains_no_secret_identity_headers(
    client: AsyncClient, signed_in_headers: dict[str, str]
) -> None:
    response = await client.get("/api/account/export", headers=signed_in_headers)
    assert response.status_code == 200, response.text
    exported = response.json()
    assert "profile" in exported
    assert "messages" in exported
    assert "X-Coders-User" not in response.text
