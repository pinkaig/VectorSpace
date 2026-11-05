"""submissions: a student's museum handed in for the teacher to review

One row per hand-in, so a museum sent back and sent again keeps the history of comments.
status is waiting until the teacher approves it or sends it back.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="waiting"),
        sa.Column("share_with", sa.String(20), nullable=True),
        sa.Column("grade", sa.String(20), nullable=True),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column("submitted_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status in ('waiting', 'approved', 'sent_back')", name="ck_submissions_status"),
        sa.CheckConstraint(
            "share_with is null or share_with in ('public', 'unlisted', 'sign_in_only')",
            name="ck_submissions_share_with",
        ),
    )
    op.create_index("ix_submissions_project_submitted_at", "submissions", ["project_id", "submitted_at"])


def downgrade() -> None:
    op.drop_index("ix_submissions_project_submitted_at", table_name="submissions")
    op.drop_table("submissions")