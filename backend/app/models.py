import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """App-local member linked to one or more verified OAuth identities."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Stable internal identity used by existing domain tables and API payloads.
    coders_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), unique=True, nullable=False, index=True
    )
    # Editable inside the app. Default to a short slice of coders_id so
    # something shows up before the user picks a name.
    display_name: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    age: Mapped[int | None] = mapped_column(sa.SmallInteger, nullable=True)
    gender: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    seeking: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    area: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    job: Mapped[str | None] = mapped_column(sa.String(48), nullable=True)
    bio: Mapped[str | None] = mapped_column(sa.String(240), nullable=True)
    date_style: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    interests: Mapped[list[str]] = mapped_column(sa.JSON, default=list, nullable=False)
    availability: Mapped[list[str]] = mapped_column(
        sa.JSON, default=list, nullable=False
    )
    min_preferred_age: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="20"
    )
    max_preferred_age: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="39"
    )
    max_distance_km: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="30"
    )
    home_latitude: Mapped[float | None] = mapped_column(sa.Float())
    home_longitude: Mapped[float | None] = mapped_column(sa.Float())
    profile_complete: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.false(), index=True
    )
    account_verified: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.false()
    )
    verification_status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="unverified", index=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="active", index=True
    )
    suspended_until: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    safety_strikes: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="0"
    )
    discoverable: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.true(), index=True
    )
    terms_version: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    privacy_version: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    terms_agreed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    privacy_agreed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    adult_confirmed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    marketing_opt_in: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.false()
    )
    marketing_opt_in_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    notify_matches: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.true()
    )
    notify_messages: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.true()
    )
    notify_dates: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.true()
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )
    referral_code: Mapped[str] = mapped_column(
        sa.String(12), unique=True, nullable=False, index=True
    )
    referred_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    trust_score: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="50"
    )
    date_feedback_count: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default="0"
    )
    no_show_count: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default="0"
    )

    posts: Mapped[list["Post"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    photos: Mapped[list["ProfilePhoto"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        order_by="ProfilePhoto.position",
    )


class ProfilePhoto(Base):
    """A compressed profile image owned by one MORROW member.

    Images are intentionally private to signed-in MORROW members at the API
    boundary. The browser uploads a resized WebP/JPEG payload, while the
    backend still validates the magic bytes before persisting it.
    """

    __tablename__ = "profile_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content_type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    content: Mapped[bytes | None] = mapped_column(sa.LargeBinary, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(
        sa.String(300), nullable=True, unique=True
    )
    byte_size: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    position: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="0"
    )
    is_public: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.true(), index=True
    )
    sha256: Mapped[str | None] = mapped_column(sa.String(64), nullable=True, index=True)
    moderation_status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="pending", index=True
    )
    moderation_reason: Mapped[str | None] = mapped_column(sa.String(240))
    moderated_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )

    owner: Mapped[User] = relationship(back_populates="photos")


class Post(Base):
    """A short message authored by a logged-in user."""

    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(sa.String(280), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )

    author: Mapped[User] = relationship(back_populates="posts")


class Swipe(Base):
    __tablename__ = "swipes"
    __table_args__ = (
        sa.UniqueConstraint("swiper_id", "target_id", name="uq_swipes_pair"),
        sa.CheckConstraint("swiper_id <> target_id", name="ck_swipes_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    swiper_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(sa.String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_matches_pair"),
        sa.CheckConstraint("user_a_id <> user_b_id", name="ck_matches_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        sa.String(12), nullable=False, server_default="active", index=True
    )
    matched_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    closed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    closed_reason: Mapped[str | None] = mapped_column(sa.String(32))


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        sa.UniqueConstraint("sender_id", "client_id", name="uq_messages_sender_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), nullable=True
    )
    body: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class DatePlan(Base):
    """A lightweight, in-app first-date proposal shared by a match.

    Keeping the proposal inside MORROW gives both people a concrete next step
    without asking them to exchange phone numbers or jump to another app.
    """

    __tablename__ = "date_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    proposer_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    area: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, index=True
    )
    note: Mapped[str | None] = mapped_column(sa.String(240))
    place_id: Mapped[str | None] = mapped_column(sa.String(32), index=True)
    place_name: Mapped[str | None] = mapped_column(sa.String(100))
    place_url: Mapped[str | None] = mapped_column(sa.String(500))
    road_address: Mapped[str | None] = mapped_column(sa.String(160))
    longitude: Mapped[float | None] = mapped_column(sa.Float())
    latitude: Mapped[float | None] = mapped_column(sa.Float())
    status: Mapped[str] = mapped_column(
        sa.String(12), nullable=False, server_default="pending", index=True
    )
    responded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    responded_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    proposer_safe_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True)
    )
    responder_safe_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class MatchSync(Base):
    """A private, reciprocal icebreaker shared by one active match.

    Prompts are snapshotted when the session starts so a profile edit cannot
    change an in-progress conversation. Answers live in a separate table and
    are only revealed by the API after both people have submitted that round.
    """

    __tablename__ = "match_syncs"
    __table_args__ = (
        sa.UniqueConstraint("match_id", name="uq_match_syncs_match"),
        sa.CheckConstraint(
            "current_round >= 0 AND current_round <= 3",
            name="ck_match_syncs_current_round",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompts: Mapped[list[dict[str, object]]] = mapped_column(
        sa.JSON, nullable=False
    )
    current_round: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, server_default="0"
    )
    status: Mapped[str] = mapped_column(
        sa.String(12), nullable=False, server_default="active", index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )


class MatchSyncAnswer(Base):
    """One member's answer to one synchronized prompt round."""

    __tablename__ = "match_sync_answers"
    __table_args__ = (
        sa.UniqueConstraint(
            "sync_id", "round_index", "user_id", name="uq_match_sync_answers_user_round"
        ),
        sa.CheckConstraint(
            "round_index >= 0 AND round_index <= 2",
            name="ck_match_sync_answers_round",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sync_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("match_syncs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_index: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answer: Mapped[str] = mapped_column(sa.String(180), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class AuthIdentity(Base):
    """A social-provider subject linked to one local MORROW member."""

    __tablename__ = "auth_identities"
    __table_args__ = (
        sa.UniqueConstraint("provider", "provider_subject", name="uq_auth_identity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(sa.String(16), nullable=False, index=True)
    provider_subject: Mapped[str] = mapped_column(sa.String(191), nullable=False)
    email: Mapped[str | None] = mapped_column(
        sa.String(320), unique=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    last_login_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class AuthSession(Base):
    """Revocable browser session; only a SHA-256 token digest is persisted."""

    __tablename__ = "auth_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, index=True
    )
    last_used_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class OAuthFlow(Base):
    """Short-lived, single-use OAuth state and PKCE material."""

    __tablename__ = "oauth_flows"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider: Mapped[str] = mapped_column(sa.String(16), nullable=False, index=True)
    state_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, nullable=False)
    code_verifier: Mapped[str | None] = mapped_column(sa.String(128))
    nonce: Mapped[str | None] = mapped_column(sa.String(128))
    expires_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, index=True
    )
    used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_blocks_pair"),
        sa.CheckConstraint("blocker_id <> blocked_id", name="ck_blocks_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reported_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    detail: Mapped[str | None] = mapped_column(sa.String(500))
    status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="pending", index=True
    )
    priority: Mapped[str] = mapped_column(
        sa.String(12), nullable=False, server_default="normal", index=True
    )
    resolution: Mapped[str | None] = mapped_column(sa.String(32))
    admin_note: Mapped[str | None] = mapped_column(sa.String(500))
    resolved_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        sa.UniqueConstraint(
            "user_id", "dedupe_key", name="uq_notifications_user_dedupe"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(sa.String(24), nullable=False, index=True)
    title: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    body: Mapped[str] = mapped_column(sa.String(240), nullable=False)
    action_type: Mapped[str | None] = mapped_column(sa.String(24))
    action_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), index=True
    )
    dedupe_key: Mapped[str | None] = mapped_column(sa.String(96))
    read_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class VerificationRequest(Base):
    """Provider-neutral verification queue.

    Manual review works for a small closed beta. A future identity provider can
    store its transaction id here without changing the public account model.
    """

    __tablename__ = "verification_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="manual"
    )
    provider_transaction_id: Mapped[str | None] = mapped_column(
        sa.String(191), unique=True
    )
    status: Mapped[str] = mapped_column(
        sa.String(16), nullable=False, server_default="pending", index=True
    )
    note: Mapped[str | None] = mapped_column(sa.String(500))
    reviewer_coders_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), index=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


class DiscoveryImpression(Base):
    __tablename__ = "discovery_impressions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    viewer_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shown_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class DateFeedback(Base):
    """Private, post-date quality signal; never shown verbatim to the match."""

    __tablename__ = "date_feedback"
    __table_args__ = (
        sa.UniqueConstraint("plan_id", "reviewer_id", name="uq_date_feedback_reviewer"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("date_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewed_user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attended: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)
    felt_safe: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)
    would_meet_again: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)
    note: Mapped[str | None] = mapped_column(sa.String(500))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )


class ModerationAction(Base):
    __tablename__ = "moderation_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admin_coders_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), nullable=False, index=True
    )
    subject_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("reports.id", ondelete="SET NULL"), nullable=True, index=True
    )
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("profile_photos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(sa.String(32), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(sa.String(500))
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )
