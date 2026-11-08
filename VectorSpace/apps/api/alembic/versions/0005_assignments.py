"""assignments: the task and due date a teacher gives a class

The student home showed a fake task and due date because nothing stored them. An
assignment is one row per class: which project the students' copies come from, the
task text and the due date. Each student copy points back to it through
projects.assignment_id, so the task is stored once per class, not once per student.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-26

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "class_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("task", sa.Text(), nullable=False),
        sa.Column("due_at", sa.Date(), nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("actors.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # student copies point at their assignment; nullable, so existing projects are untouched
    op.add_column("projects", sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_projects_assignment_id", "projects", "assignments", ["assignment_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    # the exact reverse of upgrade(), in reverse order
    op.drop_constraint("fk_projects_assignment_id", "projects", type_="foreignkey")
    op.drop_column("projects", "assignment_id")
    op.drop_table("assignments")