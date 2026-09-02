"""scale, trust, safety feedback and growth foundations

Revision ID: 0008
Revises: 0007_social_auth_places
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "min_preferred_age", sa.SmallInteger(), nullable=False, server_default="20"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "max_preferred_age", sa.SmallInteger(), nullable=False, server_default="39"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "max_distance_km", sa.SmallInteger(), nullable=False, server_default="30"
        ),
    )
    op.add_column("users", sa.Column("home_latitude", sa.Float()))
    op.add_column("users", sa.Column("home_longitude", sa.Float()))
    op.add_column(
        "users",
        sa.Column(
            "verification_status",
            sa.String(16),
            nullable=False,
            server_default="unverified",
        ),
    )
    op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("referral_code", sa.String(12)))
    op.add_column("users", sa.Column("referred_by_user_id", sa.UUID()))
    op.add_column(
        "users",
        sa.Column(
            "trust_score", sa.SmallInteger(), nullable=False, server_default="50"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "date_feedback_count", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "users",
        sa.Column("no_show_count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute(
        sa.text(
            "UPDATE users SET referral_code = "
            "upper(substr(replace(id::text, '-', ''), 1, 12)) "
            "WHERE referral_code IS NULL"
        )
    )
    op.alter_column(
        "users", "referral_code", existing_type=sa.String(12), nullable=False
    )
    op.create_unique_constraint("uq_users_referral_code", "users", ["referral_code"])
    op.create_foreign_key(
        "fk_users_referred_by_user_id",
        "users",
        "users",
        ["referred_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    for name, columns in (
        ("ix_users_verification_status", ["verification_status"]),
        ("ix_users_referral_code", ["referral_code"]),
        ("ix_users_referred_by_user_id", ["referred_by_user_id"]),
    ):
        op.create_index(name, "users", columns)

    op.alter_column(
        "profile_photos", "content", existing_type=sa.LargeBinary(), nullable=True
    )
    op.add_column("profile_photos", sa.Column("storage_key", sa.String(300)))
    op.create_unique_constraint(
        "uq_profile_photos_storage_key", "profile_photos", ["storage_key"]
    )

    op.add_column(
        "date_plans", sa.Column("proposer_safe_at", sa.DateTime(timezone=True))
    )
    op.add_column(
        "date_plans", sa.Column("responder_safe_at", sa.DateTime(timezone=True))
    )

    op.create_table(
        "verification_requests",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("method", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("provider_transaction_id", sa.String(191), unique=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("note", sa.String(500)),
        sa.Column("reviewer_coders_id", sa.UUID()),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
    )
    for column in ("user_id", "status", "reviewer_coders_id", "requested_at"):
        op.create_index(
            f"ix_verification_requests_{column}", "verification_requests", [column]
        )

    op.create_table(
        "discovery_impressions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "viewer_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shown_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in ("viewer_id", "target_id", "shown_at"):
        op.create_index(
            f"ix_discovery_impressions_{column}", "discovery_impressions", [column]
        )
    op.create_index(
        "ix_discovery_impressions_viewer_shown",
        "discovery_impressions",
        ["viewer_id", "shown_at"],
    )
    op.create_index(
        "ix_discovery_impressions_target_shown",
        "discovery_impressions",
        ["target_id", "shown_at"],
    )

    op.create_table(
        "date_feedback",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "plan_id",
            sa.UUID(),
            sa.ForeignKey("date_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewed_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attended", sa.Boolean(), nullable=False),
        sa.Column("felt_safe", sa.Boolean(), nullable=False),
        sa.Column("would_meet_again", sa.Boolean(), nullable=False),
        sa.Column("note", sa.String(500)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("plan_id", "reviewer_id", name="uq_date_feedback_reviewer"),
    )
    for column in ("plan_id", "reviewer_id", "reviewed_user_id", "created_at"):
        op.create_index(f"ix_date_feedback_{column}", "date_feedback", [column])


def downgrade() -> None:
    op.drop_table("date_feedback")
    op.drop_table("discovery_impressions")
    op.drop_table("verification_requests")
    op.drop_column("date_plans", "responder_safe_at")
    op.drop_column("date_plans", "proposer_safe_at")
    op.drop_constraint(
        "uq_profile_photos_storage_key", "profile_photos", type_="unique"
    )
    op.drop_column("profile_photos", "storage_key")
    op.alter_column(
        "profile_photos", "content", existing_type=sa.LargeBinary(), nullable=False
    )
    op.drop_constraint("fk_users_referred_by_user_id", "users", type_="foreignkey")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    for name in (
        "ix_users_referred_by_user_id",
        "ix_users_referral_code",
        "ix_users_verification_status",
    ):
        op.drop_index(name, table_name="users")
    for column in (
        "no_show_count",
        "date_feedback_count",
        "trust_score",
        "referred_by_user_id",
        "referral_code",
        "verified_at",
        "verification_status",
        "home_longitude",
        "home_latitude",
        "max_distance_km",
        "max_preferred_age",
        "min_preferred_age",
    ):
        op.drop_column("users", column)
