"""
Module Authoring Fields Migration

Revision ID: 002_module_authoring_fields
Revises: 001_multi_tenant_organizations
Create Date: 2026-08-31

Adds instructor-authoring fields to course_modules and training_contents:
  - course_modules.is_published  BOOLEAN NOT NULL DEFAULT FALSE
  - course_modules.objectives    TEXT[]  NOT NULL DEFAULT '{}'
  - course_modules.key_takeaways TEXT[]  NOT NULL DEFAULT '{}'
  - training_contents.title      VARCHAR(255) NOT NULL DEFAULT ''
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_module_authoring_fields'
down_revision: Union[str, None] = '001_multi_tenant_organizations'
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


def upgrade() -> None:
    # --- course_modules additions ---
    if not _column_exists('course_modules', 'is_published'):
        op.add_column(
            'course_modules',
            sa.Column(
                'is_published',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('FALSE'),
            ),
        )

    if not _column_exists('course_modules', 'objectives'):
        op.execute(
            "ALTER TABLE course_modules "
            "ADD COLUMN objectives TEXT[] NOT NULL DEFAULT '{}'"
        )

    if not _column_exists('course_modules', 'key_takeaways'):
        op.execute(
            "ALTER TABLE course_modules "
            "ADD COLUMN key_takeaways TEXT[] NOT NULL DEFAULT '{}'"
        )

    # --- training_contents additions ---
    if not _column_exists('training_contents', 'title'):
        op.add_column(
            'training_contents',
            sa.Column(
                'title',
                sa.String(length=255),
                nullable=False,
                server_default=sa.text("''"),
            ),
        )

    # Index for fast published-module queries
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_course_modules_is_published
        ON course_modules (course_id, is_published)
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS idx_course_modules_is_published"
    )
    op.execute(
        "ALTER TABLE training_contents DROP COLUMN IF EXISTS title"
    )
    op.execute(
        "ALTER TABLE course_modules DROP COLUMN IF EXISTS key_takeaways"
    )
    op.execute(
        "ALTER TABLE course_modules DROP COLUMN IF EXISTS objectives"
    )
    op.execute(
        "ALTER TABLE course_modules DROP COLUMN IF EXISTS is_published"
    )
