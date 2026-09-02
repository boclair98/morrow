"""dating profiles, matching, messages and safety

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("age", sa.SmallInteger(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("seeking", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("area", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("job", sa.String(48), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(240), nullable=True))
    op.add_column("users", sa.Column("date_style", sa.String(32), nullable=True))
    op.add_column(
        "users", sa.Column("interests", sa.JSON(), nullable=False, server_default="[]")
    )
    op.add_column(
        "users",
        sa.Column("availability", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "users",
        sa.Column(
            "profile_complete", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "account_verified", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )
    op.create_index("ix_users_profile_complete", "users", ["profile_complete"])
    op.create_index("ix_users_area_profile", "users", ["area", "profile_complete"])

    op.create_table(
        "swipes",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "swiper_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("decision", sa.String(8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("swiper_id", "target_id", name="uq_swipes_pair"),
        sa.CheckConstraint("swiper_id <> target_id", name="ck_swipes_not_self"),
    )
    op.create_index("ix_swipes_swiper_id", "swipes", ["swiper_id"])
    op.create_index("ix_swipes_target_id", "swipes", ["target_id"])
    op.create_index("ix_swipes_created_at", "swipes", ["created_at"])
    op.create_index(
        "ix_swipes_reverse_lookup", "swipes", ["target_id", "swiper_id", "decision"]
    )

    op.create_table(
        "matches",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_a_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_b_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "closed_by_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("closed_reason", sa.String(32), nullable=True),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_matches_pair"),
        sa.CheckConstraint("user_a_id <> user_b_id", name="ck_matches_not_self"),
    )
    op.create_index("ix_matches_user_a_id", "matches", ["user_a_id"])
    op.create_index("ix_matches_user_b_id", "matches", ["user_b_id"])
    op.create_index("ix_matches_status", "matches", ["status"])
    op.create_index("ix_matches_matched_at", "matches", ["matched_at"])

    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_messages_match_id", "messages", ["match_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_messages_match_created", "messages", ["match_id", "created_at"])

    op.create_table(
        "blocks",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "blocker_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "blocked_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_blocks_pair"),
        sa.CheckConstraint("blocker_id <> blocked_id", name="ck_blocks_not_self"),
    )
    op.create_index("ix_blocks_blocker_id", "blocks", ["blocker_id"])
    op.create_index("ix_blocks_blocked_id", "blocks", ["blocked_id"])

    op.create_table(
        "reports",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reporter_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reported_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("detail", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_reported_id", "reports", ["reported_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("blocks")
    op.drop_table("messages")
    op.drop_table("matches")
    op.drop_table("swipes")
    op.drop_index("ix_users_area_profile", table_name="users")
    op.drop_index("ix_users_profile_complete", table_name="users")
    for column in [
        "account_verified",
        "profile_complete",
        "availability",
        "interests",
        "date_style",
        "bio",
        "job",
        "area",
        "seeking",
        "gender",
        "age",
    ]:
        op.drop_column("users", column)
