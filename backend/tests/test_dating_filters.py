"""Regression checks for PostgreSQL JSON-array discovery filters."""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from uuid import uuid4

import pytest
from app.models import User
from app.routes.dating import distance_km, json_list_has, user_card
from sqlalchemy import select
from sqlalchemy.dialects import postgresql


@pytest.fixture(autouse=True)
def _truncate() -> Iterator[None]:
    """This module only compiles SQL and does not require the integration DB."""
    yield


@pytest.mark.parametrize("column", [User.availability, User.interests])
def test_json_list_filter_uses_postgres_jsonb_membership(column: object) -> None:
    statement = select(User.id).where(json_list_has(column, "카페"))
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "jsonb_exists" in sql
    assert "CAST(" in sql and " AS JSONB)" in sql
    assert " LIKE " not in sql


def profile(**overrides: object) -> SimpleNamespace:
    values = {
        "id": uuid4(),
        "display_name": "회원",
        "age": 27,
        "area": "성수",
        "job": "디자이너",
        "bio": "천천히 대화하며 알아가고 싶어요",
        "date_style": "산책과 카페",
        "interests": ["카페", "전시", "산책"],
        "availability": ["토요일 낮"],
        "account_verified": False,
        "trust_score": 50,
        "home_latitude": 37.5446,
        "home_longitude": 127.0559,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_distance_and_match_reasons_are_explainable() -> None:
    viewer = profile(display_name="나")
    candidate = profile(
        area="연남",
        home_latitude=37.5627,
        home_longitude=126.9220,
        account_verified=True,
    )

    distance = distance_km(viewer, candidate)
    assert distance is not None and 10 < distance < 20

    card = user_card(candidate, viewer, approximate_distance=distance)
    assert card["distance_km"] == round(distance, 1)
    assert any("취향" in reason for reason in card["match_reasons"])
    assert any("시간" in reason for reason in card["match_reasons"])
    assert card["account_verified"] is True
