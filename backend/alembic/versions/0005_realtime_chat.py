"""realtime chat delivery, idempotency and read receipts

Revision ID: 0005
Revises: 0004
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages", sa.Column("client_id", sa.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        "messages",
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_messages_sender_client",
        "messages",
        ["sender_id", "client_id"],
    )
    op.create_index("ix_messages_read_at", "messages", ["read_at"])
    op.create_index(
        "ix_messages_match_unread",
        "messages",
        ["match_id", "read_at", "sender_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_match_unread", table_name="messages")
    op.drop_index("ix_messages_read_at", table_name="messages")
    op.drop_constraint("uq_messages_sender_client", "messages", type_="unique")
    op.drop_column("messages", "read_at")
    op.drop_column("messages", "client_id")
