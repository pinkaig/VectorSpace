"""school roster (classes, roles) and project templates

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # actors: school roles replace the generic ones; rows are remapped before the new check.
    op.drop_constraint("ck_actors_role", "actors", type_="check")
    op.execute("UPDATE actors SET role = 'admin' WHERE role = 'owner'")
    op.execute("UPDATE actors SET role = 'teacher' WHERE role = 'member'")
    op.execute("UPDATE actors SET role = 'student' WHERE role = 'viewer'")
    op.alter_column("actors", "role", server_default="student")
    op.create_check_constraint("ck_actors_role", "actors", "role in ('admin', 'teacher', 'student')")
    op.add_column("actors", sa.Column("active", sa.Boolean(), nullable=False, server_default="true"))

    op.create_table(
        "classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organisation_id", "name", name="uq_classes_org_name"),
    )
    op.create_table(
        "class_members",
        sa.Column(
            "class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actors.id", ondelete="CASCADE"), primary_key=True
        ),
    )

    op.add_column("projects", sa.Column("kind", sa.String(20), nullable=False, server_default="project"))
    op.add_column(
        "projects",
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id", ondelete="SET NULL")),
    )
    op.add_column(
        "projects",
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL")),
    )
    op.add_column("projects", sa.Column("template_revision", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_projects_kind", "projects", "kind in ('project', 'template')")


def downgrade() -> None:
    op.drop_constraint("ck_projects_kind", "projects", type_="check")
    op.drop_column("projects", "template_revision")
    op.drop_column("projects", "template_id")
    op.drop_column("projects", "class_id")
    op.drop_column("projects", "kind")
    op.drop_table("class_members")
    op.drop_table("classes")
    op.drop_column("actors", "active")
    op.drop_constraint("ck_actors_role", "actors", type_="check")
    op.execute("UPDATE actors SET role = 'owner' WHERE role = 'admin'")
    op.execute("UPDATE actors SET role = 'member' WHERE role IN ('teacher', 'student')")
    op.alter_column("actors", "role", server_default="member")
    op.create_check_constraint("ck_actors_role", "actors", "role in ('owner', 'admin', 'member', 'viewer')")
