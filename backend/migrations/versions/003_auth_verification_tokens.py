"""
Auth Verification Tokens Migration

Revision ID: 003_auth_verification_tokens
Revises: 002_module_authoring_fields
Create Date: 2026-09-01

Adds is_verified to users table and creates persistence tables for:
  - email_verifications (OTP verification state)
  - student_activations (Student invitation tokens)
  - password_resets (Password reset tokens)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_auth_verification_tokens'
down_revision: Union[str, None] = '002_module_authoring_fields'
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
    # 1. Add is_verified column to users table
    if not _column_exists('users', 'is_verified'):
        op.add_column(
            'users',
            sa.Column(
                'is_verified',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('TRUE'),
            ),
        )

    # 2. Create email_verifications table
    if not _table_exists('email_verifications'):
        op.create_table(
            'email_verifications',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                'user_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('otp_hash', sa.String(length=255), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('attempts', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('resend_available_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_email_verifications_user_id', 'email_verifications', ['user_id'], unique=False)
        op.create_index('idx_email_verifications_expires_at', 'email_verifications', ['expires_at'], unique=False)

    # 3. Create student_activations table
    if not _table_exists('student_activations'):
        op.create_table(
            'student_activations',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                'user_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('token_hash', sa.String(length=255), nullable=False, unique=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_student_activations_token_hash', 'student_activations', ['token_hash'], unique=True)
        op.create_index('idx_student_activations_user_id', 'student_activations', ['user_id'], unique=False)

    # 4. Create password_resets table
    if not _table_exists('password_resets'):
        op.create_table(
            'password_resets',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                'user_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('token_hash', sa.String(length=255), nullable=False, unique=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_password_resets_token_hash', 'password_resets', ['token_hash'], unique=True)
        op.create_index('idx_password_resets_user_id', 'password_resets', ['user_id'], unique=False)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS password_resets CASCADE")
    op.execute("DROP TABLE IF EXISTS student_activations CASCADE")
    op.execute("DROP TABLE IF EXISTS email_verifications CASCADE")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_verified")
