"""
Multi-Tenant Organization Isolation Migration

Revision ID: 001_multi_tenant_organizations
Revises:
Create Date: 2026-08-31

Creates organizations table, adds organization_id columns and indexes to users and courses,
and deterministically migrates existing data to preserve tenant boundaries.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_multi_tenant_organizations'
down_revision: Union[str, None] = '000_base_schema'
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


def _constraint_exists(table_name: str, constraint_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_name = :table_name
              AND constraint_name = :constraint_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "constraint_name": constraint_name},
    ).scalar()
    return result is not None


def upgrade() -> None:
    bind = op.get_bind()

    if not bind.execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations' LIMIT 1")
    ).scalar():
        op.create_table(
            'organizations',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        )

    if not _column_exists('users', 'organization_id'):
        op.add_column('users', sa.Column('organization_id', sa.Integer(), nullable=True))

    if not _column_exists('courses', 'organization_id'):
        op.add_column('courses', sa.Column('organization_id', sa.Integer(), nullable=True))

    admins_without_org = bind.execute(
        sa.text(
            """
            SELECT id, name
            FROM users
            WHERE LOWER(role) = 'admin' AND organization_id IS NULL
            ORDER BY id
            """
        )
    ).fetchall()

    for admin_id, admin_name in admins_without_org:
        display_name = (admin_name or '').strip() or f'Admin {admin_id}'
        org_name = f"{display_name}'s Organization"

        org_result = bind.execute(
            sa.text('INSERT INTO organizations (name) VALUES (:name) RETURNING id;'),
            {'name': org_name},
        )
        org_id = org_result.fetchone()[0]

        bind.execute(
            sa.text('UPDATE users SET organization_id = :org_id WHERE id = :admin_id;'),
            {'org_id': org_id, 'admin_id': admin_id},
        )

    bind.execute(
        sa.text(
            """
            UPDATE courses c
            SET organization_id = u.organization_id
            FROM users u
            WHERE c.created_by = u.id
              AND c.organization_id IS NULL
              AND u.organization_id IS NOT NULL
            """
        )
    )

    bind.execute(
        sa.text(
            """
            UPDATE courses
            SET organization_id = (
                SELECT id FROM organizations ORDER BY id LIMIT 1
            )
            WHERE organization_id IS NULL
              AND EXISTS (SELECT 1 FROM organizations)
            """
        )
    )

    bind.execute(
        sa.text(
            """
            UPDATE users u
            SET organization_id = sub.org_id
            FROM (
                SELECT DISTINCT ON (e.student_id) e.student_id, c.organization_id AS org_id
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                WHERE c.organization_id IS NOT NULL
                ORDER BY e.student_id, e.assigned_at DESC
            ) sub
            WHERE u.id = sub.student_id
              AND LOWER(u.role) = 'student'
              AND u.organization_id IS NULL
            """
        )
    )

    bind.execute(
        sa.text(
            """
            UPDATE users
            SET organization_id = (
                SELECT id FROM organizations ORDER BY id LIMIT 1
            )
            WHERE LOWER(role) = 'student'
              AND organization_id IS NULL
              AND EXISTS (SELECT 1 FROM organizations)
            """
        )
    )

    if not _constraint_exists('users', 'fk_users_organization_id'):
        op.create_foreign_key(
            'fk_users_organization_id',
            'users',
            'organizations',
            ['organization_id'],
            ['id'],
            ondelete='SET NULL',
        )

    if not _constraint_exists('courses', 'fk_courses_organization_id'):
        op.create_foreign_key(
            'fk_courses_organization_id',
            'courses',
            'organizations',
            ['organization_id'],
            ['id'],
            ondelete='SET NULL',
        )

    op.create_index('idx_users_organization_id', 'users', ['organization_id'], unique=False)
    op.create_index('idx_courses_organization_id', 'courses', ['organization_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text('DROP INDEX IF EXISTS idx_courses_organization_id;'))
    bind.execute(sa.text('DROP INDEX IF EXISTS idx_users_organization_id;'))

    bind.execute(sa.text('ALTER TABLE courses DROP CONSTRAINT IF EXISTS fk_courses_organization_id;'))
    bind.execute(sa.text('ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_organization_id;'))

    bind.execute(sa.text('ALTER TABLE courses DROP COLUMN IF EXISTS organization_id;'))
    bind.execute(sa.text('ALTER TABLE users DROP COLUMN IF EXISTS organization_id;'))

    bind.execute(sa.text('DROP TABLE IF EXISTS organizations CASCADE;'))
