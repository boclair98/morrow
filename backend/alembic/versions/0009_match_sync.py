"""reciprocal match sync icebreakers

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "match_syncs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("prompts", sa.JSON(), nullable=False),
        sa.Column(
            "current_round", sa.SmallInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "status", sa.String(12), nullable=False, server_default="active"
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("match_id", name="uq_match_syncs_match"),
        sa.CheckConstraint(
            "current_round >= 0 AND current_round <= 3",
            name="ck_match_syncs_current_round",
        ),
    )
    op.create_index("ix_match_syncs_match_id", "match_syncs", ["match_id"])
    op.create_index("ix_match_syncs_status", "match_syncs", ["status"])
    op.create_index("ix_match_syncs_started_at", "match_syncs", ["started_at"])

    op.create_table(
        "match_sync_answers",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "sync_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("match_syncs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round_index", sa.SmallInteger(), nullable=False),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("answer", sa.String(180), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "sync_id",
            "round_index",
            "user_id",
            name="uq_match_sync_answers_user_round",
        ),
        sa.CheckConstraint(
            "round_index >= 0 AND round_index <= 2",
            name="ck_match_sync_answers_round",
        ),
    )
    for column in ("sync_id", "round_index", "user_id", "created_at"):
        op.create_index(
            f"ix_match_sync_answers_{column}", "match_sync_answers", [column]
        )


def downgrade() -> None:
    op.drop_table("match_sync_answers")
    op.drop_table("match_syncs")
