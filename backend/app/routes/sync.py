"""MORROW Sync: a reciprocal, privacy-first match icebreaker.

The feature deliberately keeps the prompt set deterministic and stores only
short answers. A member can never read the other person's answer early: the
API reveals a round only after both rows exist in the same transaction.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import desc, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.identity import require_identity
from app.core.realtime import publish_realtime
from app.models import Match, MatchSync, MatchSyncAnswer, User
from app.notifications import create_notification
from app.routes.dating import current_user, owned_match

router = APIRouter(prefix="/api", tags=["match-sync"])

TOTAL_ROUNDS = 3

DATE_IDEAS = {
    "카페": "카페에서 서로의 취향 플레이리스트를 나눠보기",
    "전시": "전시 하나를 보고 마음에 남은 작품을 골라보기",
    "맛집": "새로운 맛집에서 서로 먹어보고 싶은 메뉴를 고르기",
    "산책": "산책하기 좋은 길을 천천히 걸으며 이야기하기",
    "러닝": "가볍게 뛰고 시원한 음료를 마시기",
    "영화": "영화를 보고 가장 기억에 남은 장면 이야기하기",
    "음악": "서로의 플레이리스트를 교환하고 라이브 공연 찾아보기",
    "여행": "가까운 동네의 작은 여행 코스를 함께 짜보기",
    "독서": "서점이나 북카페에서 서로에게 책 한 권 추천하기",
    "요리": "간단한 원데이 쿠킹 클래스를 함께 찾아보기",
    "반려동물": "반려동물과 함께 갈 수 있는 공원이나 카페 산책하기",
    "운동": "가벼운 운동 뒤 건강한 식사를 함께 고르기",
}


class SyncAnswerIn(BaseModel):
    round: int = Field(ge=0, le=TOTAL_ROUNDS - 1)
    answer: str = Field(min_length=1, max_length=180)

    @field_validator("answer")
    @classmethod
    def clean_answer(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("답변을 한 글자 이상 입력해주세요")
        if any(char in value for char in "<>\\{}"):
            raise ValueError("unsupported characters")
        return value


def _common_values(first: User, second: User) -> tuple[list[str], list[str]]:
    second_interests = set(second.interests)
    second_times = set(second.availability)
    common_interests = [item for item in first.interests if item in second_interests]
    common_times = [item for item in first.availability if item in second_times]
    return common_interests[:3], common_times[:3]


def _build_prompts(first: User, second: User) -> list[dict[str, object]]:
    common_interests, common_times = _common_values(first, second)
    prompts = [
        (
            f"{common_interests[0]}를 같이 즐긴다면 가장 먼저 해보고 싶은 건?"
            if common_interests
            else "요즘 하루 중 가장 기분 좋은 순간은 언제예요?"
        ),
        (
            f"{common_times[0]}에 만난다면 어떤 분위기가 가장 편할까요?"
            if common_times
            else "첫 만남에서 편안함을 느끼는 작은 배려는 뭐예요?"
        ),
        "서로를 알게 되면 꼭 해보고 싶은 작은 약속은 뭐예요?",
    ]
    return [{"round": index, "text": text} for index, text in enumerate(prompts)]


def _prompt_text(sync: MatchSync, round_index: int) -> str:
    for prompt in sync.prompts:
        if not isinstance(prompt, dict):
            continue
        if prompt.get("round") != round_index:
            continue
        text = prompt.get("text")
        if isinstance(text, str):
            return text
    return "서로를 알게 되면 꼭 해보고 싶은 작은 약속은 뭐예요?"


def _summary(first: User, second: User) -> dict[str, object]:
    common_interests, common_times = _common_values(first, second)
    interest = common_interests[0] if common_interests else None
    idea = DATE_IDEAS.get(interest or "", "조용한 공간에서 서로 좋아하는 이야기를 천천히 나눠보기")
    area = first.area or second.area
    first_date_idea = f"{area}에서 {idea}" if area else idea
    return {
        "common_interests": common_interests,
        "common_times": common_times,
        "first_date_idea": first_date_idea,
    }


async def _match_users(
    session: AsyncSession, match: Match
) -> tuple[User, User]:
    first = await session.get(User, match.user_a_id)
    second = await session.get(User, match.user_b_id)
    if first is None or second is None:
        raise HTTPException(404, "match users not found")
    return first, second


async def _sync_payload(
    session: AsyncSession,
    sync: MatchSync,
    match: Match,
    viewer: User,
) -> dict[str, object]:
    answers = (
        (
            await session.execute(
                select(MatchSyncAnswer)
                .where(MatchSyncAnswer.sync_id == sync.id)
                .order_by(MatchSyncAnswer.round_index, desc(MatchSyncAnswer.created_at))
            )
        )
        .scalars()
        .all()
    )
    grouped: dict[int, list[MatchSyncAnswer]] = {}
    for answer in answers:
        grouped.setdefault(answer.round_index, []).append(answer)

    revealed_rounds: list[dict[str, object]] = []
    for round_index in range(TOTAL_ROUNDS):
        round_answers = grouped.get(round_index, [])
        if len(round_answers) < 2:
            continue
        revealed_rounds.append(
            {
                "round": round_index,
                "prompt": _prompt_text(sync, round_index),
                "answers": [
                    {
                        "mine": answer.user_id == viewer.id,
                        "answer": answer.answer,
                    }
                    for answer in sorted(
                        round_answers, key=lambda item: item.user_id != viewer.id
                    )
                ],
            }
        )

    current_answers = grouped.get(sync.current_round, [])
    my_answer = next(
        (answer.answer for answer in current_answers if answer.user_id == viewer.id),
        None,
    )
    summary = None
    if sync.status == "completed":
        first, second = await _match_users(session, match)
        summary = _summary(first, second)

    return {
        "id": str(sync.id),
        "status": sync.status,
        "current_round": sync.current_round,
        "total_rounds": TOTAL_ROUNDS,
        "prompts": [
            {
                "round": index,
                "text": _prompt_text(sync, index),
            }
            for index in range(TOTAL_ROUNDS)
        ],
        "revealed_rounds": revealed_rounds,
        "my_answer": my_answer,
        "current_round_answers": len(current_answers),
        "waiting_for_partner": bool(my_answer and len(current_answers) < 2),
        "can_answer": sync.status == "active"
        and sync.current_round < TOTAL_ROUNDS
        and my_answer is None,
        "summary": summary,
        "started_at": sync.started_at.isoformat(),
        "completed_at": sync.completed_at.isoformat() if sync.completed_at else None,
    }


@router.get("/matches/{match_id}/sync")
async def get_match_sync(
    match_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    viewer = await current_user(session, coders_id)
    match = await owned_match(session, match_id, viewer.id)
    sync = await session.scalar(
        select(MatchSync).where(MatchSync.match_id == match.id)
    )
    if sync is None:
        return {"started": False, "session": None}
    return {
        "started": True,
        "session": await _sync_payload(session, sync, match, viewer),
    }


@router.post("/matches/{match_id}/sync/start")
async def start_match_sync(
    match_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    viewer = await current_user(session, coders_id)
    match = await owned_match(session, match_id, viewer.id)
    if match.status != "active":
        raise HTTPException(409, "conversation is closed")
    first, second = await _match_users(session, match)
    statement = (
        pg_insert(MatchSync)
        .values(match_id=match.id, prompts=_build_prompts(first, second))
        .on_conflict_do_nothing(constraint="uq_match_syncs_match")
        .returning(MatchSync.id)
    )
    sync_id = (await session.execute(statement)).scalar_one_or_none()
    sync = (
        await session.get(MatchSync, sync_id)
        if sync_id
        else await session.scalar(
            select(MatchSync).where(MatchSync.match_id == match.id)
        )
    )
    if sync is None:
        raise HTTPException(500, "sync session could not be started")
    return {
        "started": True,
        "session": await _sync_payload(session, sync, match, viewer),
    }


@router.post("/matches/{match_id}/sync/answers")
async def answer_match_sync(
    match_id: UUID,
    body: SyncAnswerIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    viewer = await current_user(session, coders_id)
    match = await owned_match(session, match_id, viewer.id)
    if match.status != "active":
        raise HTTPException(409, "conversation is closed")
    sync = await session.scalar(
        select(MatchSync)
        .where(MatchSync.match_id == match.id)
        .with_for_update()
    )
    if sync is None:
        raise HTTPException(404, "sync session not started")
    if sync.status != "active":
        raise HTTPException(409, "sync session is already complete")
    if body.round != sync.current_round:
        raise HTTPException(409, "sync round already advanced")

    duplicate = await session.scalar(
        select(MatchSyncAnswer).where(
            MatchSyncAnswer.sync_id == sync.id,
            MatchSyncAnswer.round_index == body.round,
            MatchSyncAnswer.user_id == viewer.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(409, "이미 이 라운드에 답변했어요")

    answer = MatchSyncAnswer(
        sync_id=sync.id,
        round_index=body.round,
        user_id=viewer.id,
        answer=body.answer,
    )
    session.add(answer)
    await session.flush()
    round_answers = (
        (
            await session.execute(
                select(MatchSyncAnswer).where(
                    MatchSyncAnswer.sync_id == sync.id,
                    MatchSyncAnswer.round_index == body.round,
                )
            )
        )
        .scalars()
        .all()
    )
    recipient_id = match.user_b_id if match.user_a_id == viewer.id else match.user_a_id
    recipients: list[UUID]
    if len(round_answers) >= 2:
        sync.current_round += 1
        if sync.current_round == TOTAL_ROUNDS:
            sync.status = "completed"
            sync.completed_at = datetime.now(UTC)
            notification_title = "Sync 카드가 완성됐어요"
            notification_body = "서로의 답변이 모두 공개됐어요. 이제 대화를 이어가 보세요."
        else:
            notification_title = f"Sync {body.round + 1}라운드가 공개됐어요"
            notification_body = "서로의 답변을 확인하고 다음 질문에 답해보세요."
        recipients = [viewer.id, recipient_id]
        for user_id in recipients:
            recipient = viewer if user_id == viewer.id else await session.get(User, user_id)
            if recipient and recipient.notify_matches:
                await create_notification(
                    session,
                    user_id=user_id,
                    kind="sync",
                    title=notification_title,
                    body=notification_body,
                    action_type="match",
                    action_id=match.id,
                    dedupe_key=f"sync-round:{sync.id}:{body.round}:{user_id}",
                )
    else:
        recipients = [recipient_id]
        recipient = await session.get(User, recipient_id)
        if recipient and recipient.notify_matches:
            await create_notification(
                session,
                user_id=recipient_id,
                kind="sync",
                title="새로운 Sync 답변을 기다리고 있어요",
                body=f"{viewer.display_name}님이 {body.round + 1}라운드에 답했어요. 답하면 동시에 공개돼요.",
                action_type="match",
                action_id=match.id,
                dedupe_key=f"sync-waiting:{sync.id}:{body.round}:{viewer.id}",
            )

    await publish_realtime(
        session,
        {
            "type": "match_sync_updated",
            "match_id": str(match.id),
            "audience_user_ids": [str(user_id) for user_id in [viewer.id, recipient_id]],
            "round": body.round,
            "status": sync.status,
            "current_round": sync.current_round,
        },
    )
    return {
        "started": True,
        "session": await _sync_payload(session, sync, match, viewer),
    }
