from __future__ import annotations

from datetime import UTC, datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import and_, cast, desc, exists, func, or_, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat import create_chat_message, mark_match_read, message_item
from app.core.access import PRIVACY_VERSION, TERMS_VERSION, ensure_active
from app.core.database import get_session
from app.core.identity import require_identity
from app.core.realtime import publish_realtime
from app.models import (
    Block,
    DateFeedback,
    DatePlan,
    DiscoveryImpression,
    Match,
    Message,
    ProfilePhoto,
    Report,
    Swipe,
    User,
)
from app.notifications import create_notification
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api", tags=["dating"])

AREA_CENTERS: dict[str, tuple[float, float] | None] = {
    "성수": (37.5446, 127.0559),
    "연남": (37.5627, 126.9220),
    "강남": (37.4979, 127.0276),
    "잠실": (37.5133, 127.1001),
    "한남": (37.5346, 127.0005),
    "을지로": (37.5660, 126.9910),
    "망원": (37.5560, 126.9014),
    "신촌": (37.5598, 126.9425),
    "여의도": (37.5219, 126.9245),
    "인천": (37.4563, 126.7052),
    "수원": (37.2636, 127.0286),
    "성남": (37.4200, 127.1265),
    "고양": (37.6584, 126.8320),
    "용인": (37.2411, 127.1776),
    "대전": (36.3504, 127.3845),
    "세종": (36.4800, 127.2890),
    "부산": (35.1796, 129.0756),
    "대구": (35.8714, 128.6014),
    "광주": (35.1595, 126.8526),
    "울산": (35.5384, 129.3114),
    "창원": (35.2279, 128.6811),
    "제주": (33.4996, 126.5312),
    "기타": None,
}
AREAS = set(AREA_CENTERS)
AVAILABILITY = {
    "평일 저녁",
    "금요일 밤",
    "토요일 낮",
    "토요일 저녁",
    "일요일 낮",
    "일요일 저녁",
}
INTERESTS = {
    "카페",
    "전시",
    "맛집",
    "산책",
    "러닝",
    "영화",
    "음악",
    "여행",
    "독서",
    "요리",
    "반려동물",
    "운동",
}


def json_list_has(column: object, value: str):
    """Match one string in a JSON array without PostgreSQL's invalid JSON LIKE."""
    return func.jsonb_exists(cast(column, JSONB), value)


class ProfileDetailsIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=20)
    age: int = Field(ge=20, le=49)
    gender: str = Field(pattern="^(woman|man|other)$")
    seeking: str = Field(pattern="^(woman|man|all)$")
    area: str = Field(max_length=32)
    job: str = Field(min_length=1, max_length=48)
    bio: str = Field(min_length=10, max_length=240)
    date_style: str = Field(min_length=1, max_length=32)
    interests: list[str] = Field(min_length=3, max_length=6)
    availability: list[str] = Field(min_length=1, max_length=4)
    min_preferred_age: int = Field(default=20, ge=20, le=49)
    max_preferred_age: int = Field(default=39, ge=20, le=49)
    max_distance_km: int = Field(default=30, ge=3, le=200)

    @model_validator(mode="after")
    def valid_preference_range(self):
        if self.min_preferred_age > self.max_preferred_age:
            raise ValueError("선호 나이 범위를 확인해주세요")
        return self

    @field_validator("display_name", "job", "bio", "date_style")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if any(char in value for char in "<>\\{}"):
            raise ValueError("unsupported characters")
        return value

    @field_validator("area")
    @classmethod
    def valid_area(cls, value: str) -> str:
        if value not in AREAS:
            raise ValueError("unsupported area")
        return value

    @field_validator("interests")
    @classmethod
    def valid_interests(cls, values: list[str]) -> list[str]:
        unique = list(dict.fromkeys(values))
        if len(unique) != len(values) or not set(unique) <= INTERESTS:
            raise ValueError("unsupported interests")
        return unique

    @field_validator("availability")
    @classmethod
    def valid_availability(cls, values: list[str]) -> list[str]:
        unique = list(dict.fromkeys(values))
        if len(unique) != len(values) or not set(unique) <= AVAILABILITY:
            raise ValueError("unsupported availability")
        return unique


class ProfileIn(ProfileDetailsIn):
    referral_code: str | None = Field(default=None, max_length=12)
    terms_agreed: bool
    privacy_agreed: bool
    adult_confirmed: bool
    marketing_opt_in: bool = False

    @field_validator("referral_code")
    @classmethod
    def clean_referral_code(cls, value: str | None) -> str | None:
        cleaned = value.strip().upper() if value else None
        if cleaned and len(cleaned) < 8:
            raise ValueError("초대 코드를 확인해주세요")
        return cleaned


def distance_km(first: User, second: User) -> float | None:
    if None in (
        first.home_latitude,
        first.home_longitude,
        second.home_latitude,
        second.home_longitude,
    ):
        return None
    lat1, lon1 = radians(first.home_latitude), radians(first.home_longitude)
    lat2, lon2 = radians(second.home_latitude), radians(second.home_longitude)
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    value = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    return 6371.0 * 2 * asin(sqrt(value))


def user_card(
    user: User,
    viewer: User,
    photos: list[ProfilePhoto] | None = None,
    *,
    approximate_distance: float | None = None,
    recent_exposure: int = 0,
) -> dict:
    photos = photos or []
    common_interests = sorted(set(user.interests) & set(viewer.interests))
    common_times = [x for x in viewer.availability if x in set(user.availability)]
    score = min(
        98,
        68
        + len(common_interests) * 5
        + len(common_times) * 7
        + (5 if user.area == viewer.area else 0),
    )
    # MORROW is intentionally photo-first without becoming appearance-only:
    # a complete, recent profile gets a small discovery lift, while the
    # compatibility score remains the primary sort signal.
    discovery_lift = min(len(photos), 3) * 3
    verification_lift = 4 if user.account_verified else 0
    reliability_lift = max(-5, min(5, (user.trust_score - 50) // 5))
    exposure_penalty = min(15, recent_exposure // 3)
    reasons = []
    if common_times:
        reasons.append(f"{common_times[0]} 시간이 맞아요")
    if common_interests:
        reasons.append(f"{common_interests[0]} 취향이 같아요")
    if user.area == viewer.area:
        reasons.append("같은 생활권이에요")
    elif approximate_distance is not None:
        reasons.append(f"약 {max(1, round(approximate_distance))}km 거리예요")
    return {
        "id": str(user.id),
        "display_name": user.display_name,
        "age": user.age,
        "area": user.area,
        "job": user.job,
        "bio": user.bio,
        "date_style": user.date_style,
        "interests": user.interests,
        "availability": user.availability,
        "common_interests": common_interests,
        "common_times": common_times,
        "compatibility": score,
        "discovery_score": max(
            0,
            min(
                100,
                score
                + discovery_lift
                + verification_lift
                + reliability_lift
                - exposure_penalty,
            ),
        ),
        "distance_km": round(approximate_distance, 1)
        if approximate_distance is not None
        else None,
        "match_reasons": reasons[:3],
        "photos": [
            {
                "id": str(photo.id),
                "url": f"/api/photos/{photo.id}",
                "content_type": photo.content_type,
                "position": photo.position,
            }
            for photo in photos
            if photo.is_public
        ],
        "photo_count": len([photo for photo in photos if photo.is_public]),
        "photo_prompt": "사진을 올린 프로필"
        if photos
        else "사진 없이도 취향을 먼저 확인해요",
        "account_verified": user.account_verified,
    }


async def current_user(session: AsyncSession, coders_id: UUID) -> User:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user)
    return user


def apply_profile_details(user: User, body: ProfileDetailsIn) -> None:
    for key, value in body.model_dump().items():
        setattr(user, key, value)
    center = AREA_CENTERS.get(body.area)
    user.home_latitude = center[0] if center else None
    user.home_longitude = center[1] if center else None


@router.put("/profile")
async def save_profile(
    body: ProfileIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await upsert_local_user(session, coders_id)
    ensure_active(user, require_legal=False)
    if not (body.terms_agreed and body.privacy_agreed and body.adult_confirmed):
        raise HTTPException(422, "필수 동의와 만 20세 이상 확인이 필요해요")
    apply_profile_details(
        user,
        ProfileDetailsIn.model_validate(
            body.model_dump(include=set(ProfileDetailsIn.model_fields))
        ),
    )
    if body.referral_code and not user.referred_by_user_id:
        inviter = await session.scalar(
            select(User).where(User.referral_code == body.referral_code)
        )
        if inviter is None:
            raise HTTPException(422, "초대 코드를 확인해주세요")
        if inviter.id == user.id:
            raise HTTPException(422, "내 초대 코드는 등록할 수 없어요")
        user.referred_by_user_id = inviter.id
        await create_notification(
            session,
            user_id=inviter.id,
            kind="growth",
            title="친구가 MORROW에 합류했어요",
            body="초대 링크를 통해 새로운 회원이 가입했어요.",
            action_type="profile",
            action_id=user.id,
            dedupe_key=f"referral:{user.id}",
        )
    now = datetime.now(UTC)
    user.terms_version = TERMS_VERSION
    user.privacy_version = PRIVACY_VERSION
    user.terms_agreed_at = now
    user.privacy_agreed_at = now
    user.adult_confirmed_at = now
    user.marketing_opt_in = body.marketing_opt_in
    user.marketing_opt_in_at = now if body.marketing_opt_in else None
    user.profile_complete = True
    await session.flush()
    return {"status": "ok", "profile_complete": True}


@router.patch("/profile")
async def update_profile(
    body: ProfileDetailsIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if not user.profile_complete:
        raise HTTPException(409, "complete profile first")
    apply_profile_details(user, body)
    await session.flush()
    return {"status": "ok", "profile_complete": True}


@router.get("/discover")
async def discover(
    limit: int = Query(default=8, ge=1, le=20),
    area: str | None = Query(default=None, max_length=32),
    min_age: int | None = Query(default=None, ge=20, le=49),
    max_age: int | None = Query(default=None, ge=20, le=49),
    availability: str | None = Query(default=None, max_length=32),
    interest: str | None = Query(default=None, max_length=32),
    photo_only: bool = Query(default=False),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    viewer = await current_user(session, coders_id)
    if not viewer.profile_complete:
        raise HTTPException(409, "complete profile first")

    blocked = select(Block.blocked_id).where(Block.blocker_id == viewer.id)
    blocked_by = select(Block.blocker_id).where(Block.blocked_id == viewer.id)
    seen = select(Swipe.target_id).where(Swipe.swiper_id == viewer.id)
    recently_shown = select(DiscoveryImpression.target_id).where(
        DiscoveryImpression.viewer_id == viewer.id,
        DiscoveryImpression.shown_at >= datetime.now(UTC) - timedelta(hours=6),
    )
    candidate_limit = min(200, max(limit * 4, 40))
    query = (
        select(User)
        .where(
            User.id != viewer.id,
            User.profile_complete.is_(True),
            User.status == "active",
            User.discoverable.is_(True),
            User.terms_version == TERMS_VERSION,
            User.privacy_version == PRIVACY_VERSION,
            User.adult_confirmed_at.is_not(None),
            User.id.not_in(blocked),
            User.id.not_in(blocked_by),
            User.id.not_in(seen),
            User.id.not_in(recently_shown),
            User.age >= viewer.min_preferred_age,
            User.age <= viewer.max_preferred_age,
            User.min_preferred_age <= viewer.age,
            User.max_preferred_age >= viewer.age,
        )
        .order_by(desc(User.last_seen_at))
        .limit(candidate_limit)
    )
    if area in AREAS:
        query = query.where(User.area == area)
    if min_age is not None:
        query = query.where(User.age >= min_age)
    if max_age is not None:
        query = query.where(User.age <= max_age)
    if availability in AVAILABILITY:
        query = query.where(json_list_has(User.availability, availability))
    if interest in INTERESTS:
        query = query.where(json_list_has(User.interests, interest))
    if photo_only:
        query = query.where(
            exists().where(
                ProfilePhoto.owner_id == User.id,
                ProfilePhoto.is_public.is_(True),
                ProfilePhoto.moderation_status == "approved",
            )
        )
    if viewer.seeking != "all":
        query = query.where(User.gender == viewer.seeking)
    query = query.where(or_(User.seeking == "all", User.seeking == viewer.gender))
    users = (await session.execute(query)).scalars().all()
    user_ids = [user.id for user in users]
    photo_rows = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(
                    ProfilePhoto.owner_id.in_(user_ids),
                    ProfilePhoto.is_public.is_(True),
                    ProfilePhoto.moderation_status == "approved",
                )
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
        if user_ids
        else []
    )
    photo_groups: dict[UUID, list[ProfilePhoto]] = {}
    for photo in photo_rows:
        photo_groups.setdefault(photo.owner_id, []).append(photo)
    exposure_rows = (
        (
            await session.execute(
                select(
                    DiscoveryImpression.target_id,
                    func.count(DiscoveryImpression.id),
                )
                .where(
                    DiscoveryImpression.target_id.in_(user_ids),
                    DiscoveryImpression.shown_at
                    >= datetime.now(UTC) - timedelta(days=7),
                )
                .group_by(DiscoveryImpression.target_id)
            )
        ).all()
        if user_ids
        else []
    )
    exposure = {target_id: int(count) for target_id, count in exposure_rows}
    cards = []
    for candidate in users:
        approximate_distance = distance_km(viewer, candidate)
        if (
            approximate_distance is not None
            and approximate_distance > viewer.max_distance_km
        ):
            continue
        cards.append(
            user_card(
                candidate,
                viewer,
                photo_groups.get(candidate.id, []),
                approximate_distance=approximate_distance,
                recent_exposure=exposure.get(candidate.id, 0),
            )
        )
    # Time-first is a product promise: a shared availability slot takes
    # priority over photo/trust boosts, while the score still ranks people
    # within the same time-match tier.
    cards.sort(
        key=lambda item: (
            bool(item["common_times"]),
            len(item["common_times"]),
            item["discovery_score"],
        ),
        reverse=True,
    )
    visible_cards = cards[:limit]
    session.add_all(
        [
            DiscoveryImpression(viewer_id=viewer.id, target_id=UUID(item["id"]))
            for item in visible_cards
        ]
    )
    return {"items": visible_cards, "has_more": len(cards) > limit}


class SwipeIn(BaseModel):
    target_id: UUID
    decision: str = Field(pattern="^(like|pass)$")


@router.post("/swipes")
async def swipe(
    body: SwipeIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if body.target_id == user.id:
        raise HTTPException(400, "cannot swipe yourself")
    target = await session.get(User, body.target_id)
    if (
        target is None
        or not target.profile_complete
        or target.status != "active"
        or not target.discoverable
        or target.terms_version != TERMS_VERSION
        or target.privacy_version != PRIVACY_VERSION
        or target.adult_confirmed_at is None
    ):
        raise HTTPException(404, "profile not found")
    is_blocked = await session.scalar(
        select(
            exists().where(
                or_(
                    and_(Block.blocker_id == user.id, Block.blocked_id == target.id),
                    and_(Block.blocker_id == target.id, Block.blocked_id == user.id),
                )
            )
        )
    )
    if is_blocked:
        raise HTTPException(404, "profile not found")

    day_ago = datetime.now(UTC) - timedelta(days=1)
    recent_swipes = await session.scalar(
        select(func.count(Swipe.id)).where(
            Swipe.swiper_id == user.id,
            Swipe.created_at >= day_ago,
        )
    )
    if (recent_swipes or 0) >= 80:
        raise HTTPException(429, "오늘 확인할 수 있는 추천을 모두 봤어요")

    stmt = (
        pg_insert(Swipe)
        .values(swiper_id=user.id, target_id=target.id, decision=body.decision)
        .on_conflict_do_update(
            constraint="uq_swipes_pair",
            set_={"decision": body.decision, "created_at": datetime.now(UTC)},
        )
    )
    await session.execute(stmt)
    if body.decision != "like":
        return {"matched": False}

    reverse_like = await session.scalar(
        select(
            exists().where(
                Swipe.swiper_id == target.id,
                Swipe.target_id == user.id,
                Swipe.decision == "like",
            )
        )
    )
    if not reverse_like:
        return {"matched": False}

    user_a, user_b = sorted([user.id, target.id], key=str)
    match_stmt = (
        pg_insert(Match)
        .values(user_a_id=user_a, user_b_id=user_b)
        .on_conflict_do_nothing(constraint="uq_matches_pair")
        .returning(Match.id)
    )
    match_id = (await session.execute(match_stmt)).scalar_one_or_none()
    created = match_id is not None
    if match_id is None:
        match_id = await session.scalar(
            select(Match.id).where(Match.user_a_id == user_a, Match.user_b_id == user_b)
        )
    if created:
        if user.notify_matches:
            await create_notification(
                session,
                user_id=user.id,
                kind="match",
                title="새로운 사이가 이어졌어요",
                body=f"{target.display_name}님과 서로 관심이 닿았어요.",
                action_type="match",
                action_id=match_id,
                dedupe_key=f"match:{match_id}",
            )
        if target.notify_matches:
            await create_notification(
                session,
                user_id=target.id,
                kind="match",
                title="새로운 사이가 이어졌어요",
                body=f"{user.display_name}님과 서로 관심이 닿았어요.",
                action_type="match",
                action_id=match_id,
                dedupe_key=f"match:{match_id}",
            )
    return {"matched": True, "match_id": str(match_id), "person": target.display_name}


async def owned_match(session: AsyncSession, match_id: UUID, user_id: UUID) -> Match:
    match = await session.get(Match, match_id)
    if match is None or user_id not in {match.user_a_id, match.user_b_id}:
        raise HTTPException(404, "match not found")
    return match


@router.get("/matches")
async def matches(
    limit: int = Query(default=20, ge=1, le=50),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    last_message_body = (
        select(Message.body)
        .where(Message.match_id == Match.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Match)
        .scalar_subquery()
    )
    last_message_at = (
        select(Message.created_at)
        .where(Message.match_id == Match.id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .correlate(Match)
        .scalar_subquery()
    )
    unread_count = (
        select(func.count(Message.id))
        .where(
            Message.match_id == Match.id,
            Message.sender_id != user.id,
            Message.read_at.is_(None),
        )
        .correlate(Match)
        .scalar_subquery()
    )
    rows = (
        await session.execute(
            select(
                Match,
                last_message_body.label("last_message"),
                last_message_at.label("last_message_at"),
                unread_count.label("unread_count"),
            )
            .where(
                Match.status == "active",
                or_(Match.user_a_id == user.id, Match.user_b_id == user.id),
            )
            .order_by(desc(func.coalesce(last_message_at, Match.matched_at)))
            .limit(limit)
        )
    ).all()
    other_ids = [
        match.user_b_id if match.user_a_id == user.id else match.user_a_id
        for match, _, _, _ in rows
    ]
    other_users = (
        (await session.execute(select(User).where(User.id.in_(other_ids))))
        .scalars()
        .all()
        if other_ids
        else []
    )
    users_by_id = {other.id: other for other in other_users}
    photo_rows = (
        (
            await session.execute(
                select(ProfilePhoto)
                .where(
                    ProfilePhoto.owner_id.in_(other_ids),
                    ProfilePhoto.is_public.is_(True),
                    ProfilePhoto.moderation_status == "approved",
                )
                .order_by(ProfilePhoto.position, ProfilePhoto.created_at)
            )
        )
        .scalars()
        .all()
        if other_ids
        else []
    )
    photos_by_owner: dict[UUID, list[ProfilePhoto]] = {}
    for photo in photo_rows:
        photos_by_owner.setdefault(photo.owner_id, []).append(photo)
    items = []
    for match, last_message, latest_at, unread in rows:
        other_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id
        other = users_by_id.get(other_id)
        if other:
            items.append(
                {
                    "id": str(match.id),
                    "person": user_card(other, user, photos_by_owner.get(other.id, [])),
                    "matched_at": match.matched_at.isoformat(),
                    "last_message": last_message,
                    "last_message_at": latest_at.isoformat() if latest_at else None,
                    "unread_count": int(unread or 0),
                    "last_active_at": other.last_seen_at.isoformat(),
                }
            )
    return {"items": items}


@router.get("/matches/{match_id}/messages")
async def messages(
    match_id: UUID,
    limit: int = Query(default=40, ge=1, le=50),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    await owned_match(session, match_id, user.id)
    rows = (
        (
            await session.execute(
                select(Message)
                .where(Message.match_id == match_id)
                .order_by(desc(Message.created_at))
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    await mark_match_read(session, match_id, user.id)
    return {"items": [message_item(message, user.id) for message in reversed(rows)]}


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=500)
    client_id: UUID | None = None

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        return " ".join(value.split())


@router.post("/matches/{match_id}/messages", status_code=201)
async def send_message(
    match_id: UUID,
    body: MessageIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    match = await owned_match(session, match_id, user.id)
    message, _ = await create_chat_message(
        session, match, user.id, body.body, body.client_id
    )
    return message_item(message, user.id)


@router.post("/matches/{match_id}/read")
async def read_messages(
    match_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    await owned_match(session, match_id, user.id)
    count, read_at = await mark_match_read(session, match_id, user.id)
    return {"status": "ok", "count": count, "read_at": read_at.isoformat()}


class DatePlanIn(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    area: str = Field(max_length=32)
    scheduled_for: datetime
    note: str = Field(default="", max_length=240)
    place_id: str | None = Field(default=None, max_length=32, pattern=r"^\d+$")
    place_name: str | None = Field(default=None, max_length=100)
    place_url: str | None = Field(default=None, max_length=500)
    road_address: str | None = Field(default=None, max_length=160)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)

    @field_validator("title", "area", "note", "place_name", "road_address")
    @classmethod
    def clean_plan_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if any(char in value for char in "<>\\{}"):
            raise ValueError("unsupported characters")
        return value

    @field_validator("place_url")
    @classmethod
    def valid_place_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith(
            ("https://place.map.kakao.com/", "http://place.map.kakao.com/")
        ):
            raise ValueError("unsupported place URL")
        return value

    @field_validator("area")
    @classmethod
    def valid_plan_area(cls, value: str) -> str:
        if value not in AREAS:
            raise ValueError("unsupported area")
        return value


def date_plan_item(
    plan: DatePlan,
    viewer_id: UUID,
    feedback_plan_ids: set[UUID] | None = None,
) -> dict:
    mine = plan.proposer_id == viewer_id
    return {
        "id": str(plan.id),
        "title": plan.title,
        "area": plan.area,
        "scheduled_for": plan.scheduled_for.isoformat(),
        "note": plan.note,
        "place_id": plan.place_id,
        "place_name": plan.place_name,
        "place_url": plan.place_url,
        "road_address": plan.road_address,
        "longitude": plan.longitude,
        "latitude": plan.latitude,
        "status": plan.status,
        "mine": mine,
        "my_safe_confirmed": bool(
            plan.proposer_safe_at if mine else plan.responder_safe_at
        ),
        "feedback_submitted": plan.id in (feedback_plan_ids or set()),
        "created_at": plan.created_at.isoformat(),
    }


@router.get("/matches/{match_id}/plans")
async def list_date_plans(
    match_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    await owned_match(session, match_id, user.id)
    plans = (
        (
            await session.execute(
                select(DatePlan)
                .where(DatePlan.match_id == match_id)
                .order_by(desc(DatePlan.scheduled_for), desc(DatePlan.created_at))
                .limit(12)
            )
        )
        .scalars()
        .all()
    )
    plan_ids = [plan.id for plan in plans]
    feedback_plan_ids = (
        set(
            (
                await session.execute(
                    select(DateFeedback.plan_id).where(
                        DateFeedback.plan_id.in_(plan_ids),
                        DateFeedback.reviewer_id == user.id,
                    )
                )
            ).scalars()
        )
        if plan_ids
        else set()
    )
    return {
        "items": [
            date_plan_item(plan, user.id, feedback_plan_ids) for plan in reversed(plans)
        ]
    }


@router.post("/matches/{match_id}/plans", status_code=201)
async def create_date_plan(
    match_id: UUID,
    body: DatePlanIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    match = await owned_match(session, match_id, user.id)
    if match.status != "active":
        raise HTTPException(409, "conversation is closed")
    scheduled_for = body.scheduled_for
    if scheduled_for.tzinfo is None:
        scheduled_for = scheduled_for.replace(tzinfo=UTC)
    if scheduled_for <= datetime.now(UTC):
        raise HTTPException(422, "date must be in the future")
    plan = DatePlan(
        match_id=match.id,
        proposer_id=user.id,
        title=body.title,
        area=body.area,
        scheduled_for=scheduled_for,
        note=body.note or None,
        place_id=body.place_id,
        place_name=body.place_name,
        place_url=body.place_url,
        road_address=body.road_address,
        longitude=body.longitude,
        latitude=body.latitude,
    )
    session.add(plan)
    await session.flush()
    recipient_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id
    recipient = await session.get(User, recipient_id)
    if recipient and recipient.notify_dates:
        await create_notification(
            session,
            user_id=recipient.id,
            kind="date",
            title="새 약속 제안이 도착했어요",
            body=f"{user.display_name}님이 {body.area}에서 만날 시간을 제안했어요.",
            action_type="match",
            action_id=match.id,
            dedupe_key=f"date-plan:{plan.id}",
        )
    return {"item": date_plan_item(plan, user.id)}


class DatePlanResponseIn(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")


@router.post("/matches/{match_id}/plans/{plan_id}/respond")
async def respond_date_plan(
    match_id: UUID,
    plan_id: UUID,
    body: DatePlanResponseIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    await owned_match(session, match_id, user.id)
    plan = await session.get(DatePlan, plan_id)
    if plan is None or plan.match_id != match_id:
        raise HTTPException(404, "date plan not found")
    if plan.proposer_id == user.id:
        raise HTTPException(400, "cannot respond to your own plan")
    if plan.status != "pending":
        raise HTTPException(409, "date plan already answered")
    plan.status = body.status
    plan.responded_by_id = user.id
    plan.responded_at = datetime.now(UTC)
    proposer = await session.get(User, plan.proposer_id)
    if proposer and proposer.notify_dates:
        response_text = (
            "수락했어요" if body.status == "accepted" else "이번에는 어렵다고 답했어요"
        )
        await create_notification(
            session,
            user_id=proposer.id,
            kind="date",
            title="약속 제안에 답변이 왔어요",
            body=f"{user.display_name}님이 약속을 {response_text}.",
            action_type="match",
            action_id=match_id,
            dedupe_key=f"date-response:{plan.id}",
        )
    return {"item": date_plan_item(plan, user.id)}


@router.post("/matches/{match_id}/plans/{plan_id}/safe")
async def confirm_safe_return(
    match_id: UUID,
    plan_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    match = await owned_match(session, match_id, user.id)
    plan = await session.get(DatePlan, plan_id)
    if plan is None or plan.match_id != match.id:
        raise HTTPException(404, "약속을 찾지 못했어요")
    if plan.status != "accepted":
        raise HTTPException(409, "수락된 약속에서만 확인할 수 있어요")
    scheduled_for = plan.scheduled_for
    if scheduled_for.tzinfo is None:
        scheduled_for = scheduled_for.replace(tzinfo=UTC)
    if datetime.now(UTC) < scheduled_for - timedelta(hours=4):
        raise HTTPException(409, "약속 4시간 전부터 안전 확인을 남길 수 있어요")
    now = datetime.now(UTC)
    if plan.proposer_id == user.id:
        plan.proposer_safe_at = plan.proposer_safe_at or now
    else:
        plan.responder_safe_at = plan.responder_safe_at or now
    return {"item": date_plan_item(plan, user.id)}


class DateFeedbackIn(BaseModel):
    attended: bool
    felt_safe: bool
    would_meet_again: bool
    note: str = Field(default="", max_length=500)

    @field_validator("note")
    @classmethod
    def clean_feedback_note(cls, value: str) -> str:
        return " ".join(value.split())


@router.post("/matches/{match_id}/plans/{plan_id}/feedback", status_code=201)
async def submit_date_feedback(
    match_id: UUID,
    plan_id: UUID,
    body: DateFeedbackIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    match = await owned_match(session, match_id, user.id)
    plan = await session.get(DatePlan, plan_id)
    if plan is None or plan.match_id != match.id:
        raise HTTPException(404, "약속을 찾지 못했어요")
    if plan.status != "accepted":
        raise HTTPException(409, "수락된 약속에만 후기를 남길 수 있어요")
    scheduled_for = plan.scheduled_for
    if scheduled_for.tzinfo is None:
        scheduled_for = scheduled_for.replace(tzinfo=UTC)
    if scheduled_for > datetime.now(UTC):
        raise HTTPException(409, "약속 시간이 지난 뒤 후기를 남길 수 있어요")
    duplicate = await session.scalar(
        select(
            exists().where(
                DateFeedback.plan_id == plan.id,
                DateFeedback.reviewer_id == user.id,
            )
        )
    )
    if duplicate:
        raise HTTPException(409, "이미 약속 후기를 남겼어요")
    reviewed_user_id = (
        match.user_b_id if match.user_a_id == user.id else match.user_a_id
    )
    reviewed = await session.get(User, reviewed_user_id)
    if reviewed is None:
        raise HTTPException(404, "상대 계정을 찾지 못했어요")
    session.add(
        DateFeedback(
            plan_id=plan.id,
            reviewer_id=user.id,
            reviewed_user_id=reviewed.id,
            attended=body.attended,
            felt_safe=body.felt_safe,
            would_meet_again=body.would_meet_again,
            note=body.note or None,
        )
    )
    reviewed.date_feedback_count += 1
    score_change = 2 if body.attended and body.felt_safe else -5
    if not body.attended:
        reviewed.no_show_count += 1
        score_change = -8
    reviewed.trust_score = max(0, min(100, reviewed.trust_score + score_change))
    return {
        "status": "saved",
        "safety_follow_up_recommended": not body.felt_safe,
    }


class CloseIn(BaseModel):
    reason: str = Field(pattern="^(not_fit|need_time|met_someone|uncomfortable|other)$")


@router.post("/matches/{match_id}/close")
async def close_match(
    match_id: UUID,
    body: CloseIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    match = await owned_match(session, match_id, user.id)
    match.status = "closed"
    match.closed_by_id = user.id
    match.closed_reason = body.reason
    match.closed_at = datetime.now(UTC)
    await publish_realtime(
        session,
        {
            "type": "match_closed",
            "match_id": str(match.id),
            "closed_by_id": str(user.id),
            "reason": body.reason,
        },
    )
    return {"status": "closed"}


class SafetyIn(BaseModel):
    user_id: UUID


@router.post("/safety/block")
async def block_user(
    body: SafetyIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if user.id == body.user_id:
        raise HTTPException(400, "cannot block yourself")
    if await session.get(User, body.user_id) is None:
        raise HTTPException(404, "profile not found")
    await session.execute(
        pg_insert(Block)
        .values(blocker_id=user.id, blocked_id=body.user_id)
        .on_conflict_do_nothing(constraint="uq_blocks_pair")
    )
    closed_result = await session.execute(
        update(Match)
        .where(
            Match.status == "active",
            or_(
                and_(Match.user_a_id == user.id, Match.user_b_id == body.user_id),
                and_(Match.user_a_id == body.user_id, Match.user_b_id == user.id),
            ),
        )
        .values(
            status="closed",
            closed_by_id=user.id,
            closed_reason="blocked",
            closed_at=datetime.now(UTC),
        )
        .returning(Match.id)
    )
    for closed_match_id in closed_result.scalars().all():
        await publish_realtime(
            session,
            {
                "type": "match_closed",
                "match_id": str(closed_match_id),
                "closed_by_id": str(user.id),
                "reason": "blocked",
            },
        )
    return {"status": "blocked"}


class ReportIn(BaseModel):
    user_id: UUID
    category: str = Field(
        pattern="^(fake_profile|harassment|money_request|no_show|married|other)$"
    )
    detail: str = Field(default="", max_length=500)
    block: bool = True


@router.post("/safety/report", status_code=201)
async def report_user(
    body: ReportIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await current_user(session, coders_id)
    if user.id == body.user_id:
        raise HTTPException(400, "cannot report yourself")
    target = await session.get(User, body.user_id)
    if target is None:
        raise HTTPException(404, "profile not found")
    since = datetime.now(UTC) - timedelta(hours=24)
    recent_reports = await session.scalar(
        select(func.count(Report.id)).where(
            Report.reporter_id == user.id,
            Report.created_at >= since,
        )
    )
    if (recent_reports or 0) >= 10:
        raise HTTPException(429, "신고 접수가 많아요. 잠시 후 다시 시도해주세요")
    duplicate = await session.scalar(
        select(
            exists().where(
                Report.reporter_id == user.id,
                Report.reported_id == body.user_id,
                Report.category == body.category,
                Report.created_at >= since,
            )
        )
    )
    if duplicate:
        raise HTTPException(409, "같은 내용의 신고가 이미 접수됐어요")
    report = Report(
        reporter_id=user.id,
        reported_id=body.user_id,
        category=body.category,
        detail=" ".join(body.detail.split()) or None,
        priority="urgent"
        if body.category in {"money_request", "harassment"}
        else "normal",
    )
    session.add(report)
    await session.flush()
    await create_notification(
        session,
        user_id=user.id,
        kind="safety",
        title="신고가 안전 운영팀에 접수됐어요",
        body="처리 결과는 안전센터와 알림에서 확인할 수 있어요.",
        action_type="safety",
        action_id=report.id,
        dedupe_key=f"report-received:{report.id}",
    )
    if body.block:
        await session.execute(
            pg_insert(Block)
            .values(blocker_id=user.id, blocked_id=body.user_id)
            .on_conflict_do_nothing(constraint="uq_blocks_pair")
        )
        closed_result = await session.execute(
            update(Match)
            .where(
                Match.status == "active",
                or_(
                    and_(Match.user_a_id == user.id, Match.user_b_id == body.user_id),
                    and_(Match.user_a_id == body.user_id, Match.user_b_id == user.id),
                ),
            )
            .values(
                status="closed",
                closed_by_id=user.id,
                closed_reason="reported",
                closed_at=datetime.now(UTC),
            )
            .returning(Match.id)
        )
        for closed_match_id in closed_result.scalars().all():
            await publish_realtime(
                session,
                {
                    "type": "match_closed",
                    "match_id": str(closed_match_id),
                    "closed_by_id": str(user.id),
                    "reason": "reported",
                },
            )
    return {"status": "received", "blocked": body.block}
