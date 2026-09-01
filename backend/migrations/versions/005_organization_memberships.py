"""
Organization Memberships & Org Invitations Migration

Revision ID: 005_organization_memberships
Revises: 004_account_lifecycle_notifications
Create Date: 2026-09-01

Introduces:
  - organization_memberships: M-to-M link between users and organizations.
    Allows one user account (one email) to belong to multiple organizations.
  - org_invitations: Stores single-use invitation tokens sent to existing users
    when an admin adds them to a new organization they're not yet part of.

Backfills:
  - Existing users with a non-null organization_id get a row in
    organization_memberships automatically.

Note:
  - users.organization_id is deliberately kept for JWT backward compatibility
    and is still set on new user creation (primary org). It is NOT dropped here.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005_organization_memberships"
down_revision: Union[str, None] = "004_account_lifecycle_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": table_name},
    ).scalar()
    return result is not None


def _index_exists(index_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1 FROM pg_indexes WHERE indexname = :index_name LIMIT 1
            """
        ),
        {"index_name": index_name},
    ).scalar()
    return result is not None


def upgrade() -> None:
    bind = op.get_bind()

    # ----------------------------------------------------------------
    # 1. Create organization_memberships table
    # ----------------------------------------------------------------
    if not _table_exists("organization_memberships"):
        op.create_table(
            "organization_memberships",
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
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("TRUE"),
            ),
            sa.Column(
                "joined_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.UniqueConstraint("user_id", "organization_id", name="uq_org_membership"),
        )

    if not _index_exists("idx_org_memberships_user_id"):
        op.create_index(
            "idx_org_memberships_user_id",
            "organization_memberships",
            ["user_id"],
            unique=False,
        )

    if not _index_exists("idx_org_memberships_org_id"):
        op.create_index(
            "idx_org_memberships_org_id",
            "organization_memberships",
            ["organization_id"],
            unique=False,
        )

    if not _index_exists("idx_org_memberships_user_org"):
        op.create_index(
            "idx_org_memberships_user_org",
            "organization_memberships",
            ["user_id", "organization_id"],
            unique=True,
        )

    # ----------------------------------------------------------------
    # 2. Backfill existing user→org relationships
    # ----------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            INSERT INTO organization_memberships (user_id, organization_id, is_active, joined_at)
            SELECT id, organization_id, TRUE, CURRENT_TIMESTAMP
            FROM users
            WHERE organization_id IS NOT NULL
            ON CONFLICT (user_id, organization_id) DO NOTHING
            """
        )
    )

    # ----------------------------------------------------------------
    # 3. Create org_invitations table
    # ----------------------------------------------------------------
    if not _table_exists("org_invitations"):
        op.create_table(
            "org_invitations",
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
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "is_used",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("FALSE"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )

    if not _index_exists("idx_org_invitations_token_hash"):
        op.create_index(
            "idx_org_invitations_token_hash",
            "org_invitations",
            ["token_hash"],
            unique=True,
        )

    if not _index_exists("idx_org_invitations_user_id"):
        op.create_index(
            "idx_org_invitations_user_id",
            "org_invitations",
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS org_invitations CASCADE")
    op.execute("DROP TABLE IF EXISTS organization_memberships CASCADE")
