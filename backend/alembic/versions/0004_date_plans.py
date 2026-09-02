"""date proposals inside a match

Revision ID: 0004
Revises: 0003
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "date_plans",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proposer_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("area", sa.String(32), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.String(240), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column(
            "responded_by_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_date_plans_match_id", "date_plans", ["match_id"])
    op.create_index("ix_date_plans_proposer_id", "date_plans", ["proposer_id"])
    op.create_index("ix_date_plans_scheduled_for", "date_plans", ["scheduled_for"])
    op.create_index("ix_date_plans_status", "date_plans", ["status"])
    op.create_index("ix_date_plans_created_at", "date_plans", ["created_at"])


def downgrade() -> None:
    op.drop_table("date_plans")
