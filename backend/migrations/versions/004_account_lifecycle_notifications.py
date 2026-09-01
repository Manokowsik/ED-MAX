"""
Account lifecycle and in-app notifications.

Revision ID: 004_account_lifecycle_notifications
Revises: 003_auth_verification_tokens
Create Date: 2026-09-01

Adds:
  - users.deleted_at (soft deletion)
  - users.token_version (session invalidation after password change / deletion)
  - notifications table
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004_account_lifecycle_notifications"
down_revision: Union[str, None] = "003_auth_verification_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).scalar()
    return result is not None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": table_name},
    ).scalar()
    return result is not None


def upgrade() -> None:
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64)")

    if not _column_exists("users", "deleted_at"):
        op.add_column(
            "users",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _column_exists("users", "token_version"):
        op.add_column(
            "users",
            sa.Column(
                "token_version",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            ),
        )

    if not _table_exists("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "organization_id",
                sa.Integer(),
                sa.ForeignKey("organizations.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("type", sa.String(length=64), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("link", sa.String(length=512), nullable=True),
            sa.Column(
                "is_read",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("FALSE"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "idx_notifications_user_id",
            "notifications",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "idx_notifications_user_unread",
            "notifications",
            ["user_id", "is_read"],
            unique=False,
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS token_version")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS deleted_at")
