"""launch readiness: consent, account state, moderation and notifications

Revision ID: 0006
Revises: 0005
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
    )
    op.add_column("users", sa.Column("suspended_until", sa.DateTime(timezone=True)))
    op.add_column(
        "users",
        sa.Column(
            "safety_strikes", sa.SmallInteger(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "discoverable", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )
    op.add_column("users", sa.Column("terms_version", sa.String(16)))
    op.add_column("users", sa.Column("privacy_version", sa.String(16)))
    op.add_column("users", sa.Column("terms_agreed_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("privacy_agreed_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("adult_confirmed_at", sa.DateTime(timezone=True)))
    op.add_column(
        "users",
        sa.Column(
            "marketing_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column("users", sa.Column("marketing_opt_in_at", sa.DateTime(timezone=True)))
    for name in ("notify_matches", "notify_messages", "notify_dates"):
        op.add_column(
            "users",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    op.alter_column("users", "account_verified", server_default=sa.false())
    op.execute(sa.text("UPDATE users SET account_verified = false"))
    op.create_index("ix_users_status", "users", ["status"])
    op.create_index("ix_users_discoverable", "users", ["discoverable"])
    op.create_index(
        "ix_users_discovery_ready",
        "users",
        ["status", "discoverable", "profile_complete", "last_seen_at"],
    )

    op.add_column("profile_photos", sa.Column("sha256", sa.String(64)))
    op.add_column(
        "profile_photos",
        sa.Column(
            "moderation_status", sa.String(16), nullable=False, server_default="pending"
        ),
    )
    op.add_column("profile_photos", sa.Column("moderation_reason", sa.String(240)))
    op.add_column(
        "profile_photos", sa.Column("moderated_at", sa.DateTime(timezone=True))
    )
    op.create_index("ix_profile_photos_sha256", "profile_photos", ["sha256"])
    op.create_index(
        "ix_profile_photos_moderation_status", "profile_photos", ["moderation_status"]
    )

    op.add_column(
        "reports",
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
    )
    op.add_column(
        "reports",
        sa.Column("priority", sa.String(12), nullable=False, server_default="normal"),
    )
    op.add_column("reports", sa.Column("resolution", sa.String(32)))
    op.add_column("reports", sa.Column("admin_note", sa.String(500)))
    op.add_column("reports", sa.Column("resolved_at", sa.DateTime(timezone=True)))
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_priority", "reports", ["priority"])
    op.create_index(
        "ix_reports_moderation_queue", "reports", ["status", "priority", "created_at"]
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("body", sa.String(240), nullable=False),
        sa.Column("action_type", sa.String(24)),
        sa.Column("action_id", sa.UUID(as_uuid=True)),
        sa.Column("dedupe_key", sa.String(96)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id", "dedupe_key", name="uq_notifications_user_dedupe"
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_kind", "notifications", ["kind"])
    op.create_index("ix_notifications_action_id", "notifications", ["action_id"])
    op.create_index("ix_notifications_read_at", "notifications", ["read_at"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "read_at", "created_at"],
    )

    op.create_table(
        "moderation_actions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_coders_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "subject_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "report_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("reports.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "photo_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("profile_photos.id", ondelete="SET NULL"),
        ),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("note", sa.String(500)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    for column in (
        "admin_coders_id",
        "subject_user_id",
        "report_id",
        "photo_id",
        "action",
        "created_at",
    ):
        op.create_index(
            f"ix_moderation_actions_{column}", "moderation_actions", [column]
        )


def downgrade() -> None:
    op.drop_table("moderation_actions")
    op.drop_table("notifications")
    op.drop_index("ix_reports_moderation_queue", table_name="reports")
    for name in ("priority", "status"):
        op.drop_index(f"ix_reports_{name}", table_name="reports")
    for name in ("resolved_at", "admin_note", "resolution", "priority", "status"):
        op.drop_column("reports", name)
    op.drop_index("ix_profile_photos_moderation_status", table_name="profile_photos")
    op.drop_index("ix_profile_photos_sha256", table_name="profile_photos")
    for name in ("moderated_at", "moderation_reason", "moderation_status", "sha256"):
        op.drop_column("profile_photos", name)
    op.drop_index("ix_users_discovery_ready", table_name="users")
    op.drop_index("ix_users_discoverable", table_name="users")
    op.drop_index("ix_users_status", table_name="users")
    op.alter_column("users", "account_verified", server_default=sa.true())
    for name in (
        "notify_dates",
        "notify_messages",
        "notify_matches",
        "marketing_opt_in_at",
        "marketing_opt_in",
        "adult_confirmed_at",
        "privacy_agreed_at",
        "terms_agreed_at",
        "privacy_version",
        "terms_version",
        "discoverable",
        "safety_strikes",
        "suspended_until",
        "status",
    ):
        op.drop_column("users", name)
