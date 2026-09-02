"""social auth sessions and Kakao place-backed date plans

Revision ID: 0007
Revises: 0006
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_identities",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("provider_subject", sa.String(191), nullable=False),
        sa.Column("email", sa.String(320)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_auth_identity"),
        sa.UniqueConstraint("email", name="uq_auth_identities_email"),
    )
    for name in ("user_id", "provider"):
        op.create_index(f"ix_auth_identities_{name}", "auth_identities", [name])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for name in ("user_id", "expires_at"):
        op.create_index(f"ix_auth_sessions_{name}", "auth_sessions", [name])

    op.create_table(
        "oauth_flows",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("state_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("code_verifier", sa.String(128)),
        sa.Column("nonce", sa.String(128)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for name in ("provider", "expires_at"):
        op.create_index(f"ix_oauth_flows_{name}", "oauth_flows", [name])

    for name, type_ in (
        ("place_id", sa.String(32)),
        ("place_name", sa.String(100)),
        ("place_url", sa.String(500)),
        ("road_address", sa.String(160)),
        ("longitude", sa.Float()),
        ("latitude", sa.Float()),
    ):
        op.add_column("date_plans", sa.Column(name, type_))
    op.create_index("ix_date_plans_place_id", "date_plans", ["place_id"])


def downgrade() -> None:
    op.drop_index("ix_date_plans_place_id", table_name="date_plans")
    for name in (
        "latitude",
        "longitude",
        "road_address",
        "place_url",
        "place_name",
        "place_id",
    ):
        op.drop_column("date_plans", name)
    op.drop_table("oauth_flows")
    op.drop_table("auth_sessions")
    op.drop_table("auth_identities")
