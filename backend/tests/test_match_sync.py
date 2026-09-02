"""Pure contract checks for the reciprocal MORROW Sync feature."""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace

import pytest
from app.routes.sync import SyncAnswerIn, _build_prompts, _common_values, _summary
from pydantic import ValidationError


@pytest.fixture(autouse=True)
def _truncate() -> Iterator[None]:
    """These contract checks only exercise deterministic helpers."""
    yield


def profile(**overrides: object) -> SimpleNamespace:
    values = {
        "area": "성수",
        "interests": ["카페", "전시", "산책"],
        "availability": ["토요일 낮", "일요일 저녁"],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_prompts_are_deterministic_and_use_shared_signals() -> None:
    first = profile()
    second = profile(interests=["카페", "음악"], availability=["토요일 낮"])

    assert _common_values(first, second) == (["카페"], ["토요일 낮"])
    assert _build_prompts(first, second) == _build_prompts(second, first)
    prompts = _build_prompts(first, second)
    assert prompts[0]["text"] == "카페를 같이 즐긴다면 가장 먼저 해보고 싶은 건?"
    assert prompts[1]["text"] == "토요일 낮에 만난다면 어떤 분위기가 가장 편할까요?"


def test_summary_never_contains_contact_or_private_answer_data() -> None:
    result = _summary(
        profile(interests=["전시"], availability=["금요일 밤"]),
        profile(interests=["전시"], availability=["금요일 밤"]),
    )

    assert result == {
        "common_interests": ["전시"],
        "common_times": ["금요일 밤"],
        "first_date_idea": "성수에서 전시 하나를 보고 마음에 남은 작품을 골라보기",
    }
    assert "@" not in str(result)


def test_answers_are_short_and_reject_markup() -> None:
    assert SyncAnswerIn(round=0, answer="  카페에서 이야기하고 싶어요  ").answer == (
        "카페에서 이야기하고 싶어요"
    )
    with pytest.raises(ValidationError):
        SyncAnswerIn(round=0, answer="<script>alert(1)</script>")
    with pytest.raises(ValidationError):
        SyncAnswerIn(round=3, answer="답변")
