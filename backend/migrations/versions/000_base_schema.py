"""
Base Schema Migration

Revision ID: 000_base_schema
Revises: 
Create Date: 2026-08-30

Creates baseline core tables for the training platform application:
  - users
  - courses
  - course_modules
  - training_contents
  - quizzes
  - quiz_questions
  - quiz_options
  - enrollments
  - module_progress
  - quiz_attempts
  - certificates
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '000_base_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    # 1. users
    if not _table_exists('users'):
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False, unique=True),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('role', sa.String(length=50), nullable=False, server_default=sa.text("'STUDENT'")),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_users_email', 'users', ['email'], unique=True)
        op.create_index('idx_users_role', 'users', ['role'], unique=False)

    # 2. courses
    if not _table_exists('courses'):
        op.create_table(
            'courses',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_courses_created_by', 'courses', ['created_by'], unique=False)

    # 3. course_modules
    if not _table_exists('course_modules'):
        op.create_table(
            'course_modules',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('module_order', sa.Integer(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_course_modules_course_id', 'course_modules', ['course_id'], unique=False)

    # 4. training_contents
    if not _table_exists('training_contents'):
        op.create_table(
            'training_contents',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('module_id', sa.Integer(), sa.ForeignKey('course_modules.id', ondelete='CASCADE'), nullable=False),
            sa.Column('content_type', sa.String(length=50), nullable=False, server_default=sa.text("'TEXT'")),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('video_url', sa.String(length=500), nullable=True),
            sa.Column('content_order', sa.Integer(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_training_contents_module_id', 'training_contents', ['module_id'], unique=False)

    # 5. quizzes
    if not _table_exists('quizzes'):
        op.create_table(
            'quizzes',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('module_id', sa.Integer(), sa.ForeignKey('course_modules.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('passing_score', sa.Integer(), nullable=False, server_default=sa.text('70')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_quizzes_module_id', 'quizzes', ['module_id'], unique=False)

    # 6. quiz_questions
    if not _table_exists('quiz_questions'):
        op.create_table(
            'quiz_questions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('quiz_id', sa.Integer(), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
            sa.Column('question_text', sa.Text(), nullable=False),
            sa.Column('question_order', sa.Integer(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_quiz_questions_quiz_id', 'quiz_questions', ['quiz_id'], unique=False)

    # 7. quiz_options
    if not _table_exists('quiz_options'):
        op.create_table(
            'quiz_options',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('question_id', sa.Integer(), sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('option_text', sa.Text(), nullable=False),
            sa.Column('option_label', sa.String(length=10), nullable=False),
            sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_quiz_options_question_id', 'quiz_options', ['question_id'], unique=False)

    # 8. enrollments
    if not _table_exists('enrollments'):
        op.create_table(
            'enrollments',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False, server_default=sa.text("'ASSIGNED'")),
            sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.UniqueConstraint('student_id', 'course_id', name='uq_enrollments_student_course'),
        )
        op.create_index('idx_enrollments_student_course', 'enrollments', ['student_id', 'course_id'], unique=True)

    # 9. module_progress
    if not _table_exists('module_progress'):
        op.create_table(
            'module_progress',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('module_id', sa.Integer(), sa.ForeignKey('course_modules.id', ondelete='CASCADE'), nullable=False),
            sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('score', sa.Integer(), nullable=True),
            sa.Column('attempts_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.UniqueConstraint('student_id', 'module_id', name='uq_module_progress_student_module'),
        )
        op.create_index('idx_module_progress_student_module', 'module_progress', ['student_id', 'module_id'], unique=True)

    # 10. quiz_attempts
    if not _table_exists('quiz_attempts'):
        op.create_table(
            'quiz_attempts',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('quiz_id', sa.Integer(), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False),
            sa.Column('score', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('passed', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
            sa.Column('attempted_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('answers_json', sa.Text(), nullable=True),
        )
        op.create_index('idx_quiz_attempts_student_quiz', 'quiz_attempts', ['student_id', 'quiz_id'], unique=False)

    # 11. certificates
    if not _table_exists('certificates'):
        op.create_table(
            'certificates',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('certificate_number', sa.String(length=100), nullable=False, unique=True),
            sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
            sa.Column('student_name', sa.String(length=255), nullable=False),
            sa.Column('student_email', sa.String(length=255), nullable=True),
            sa.Column('course_title', sa.String(length=255), nullable=False),
            sa.Column('final_score', sa.Integer(), nullable=True),
            sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        )
        op.create_index('idx_certificates_number', 'certificates', ['certificate_number'], unique=True)
        op.create_index('idx_certificates_student_course', 'certificates', ['student_id', 'course_id'], unique=False)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS certificates CASCADE")
    op.execute("DROP TABLE IF EXISTS quiz_attempts CASCADE")
    op.execute("DROP TABLE IF EXISTS module_progress CASCADE")
    op.execute("DROP TABLE IF EXISTS enrollments CASCADE")
    op.execute("DROP TABLE IF EXISTS quiz_options CASCADE")
    op.execute("DROP TABLE IF EXISTS quiz_questions CASCADE")
    op.execute("DROP TABLE IF EXISTS quizzes CASCADE")
    op.execute("DROP TABLE IF EXISTS training_contents CASCADE")
    op.execute("DROP TABLE IF EXISTS course_modules CASCADE")
    op.execute("DROP TABLE IF EXISTS courses CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
