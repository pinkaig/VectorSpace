"""school_permissions: the admin Permissions page's settings, saved per school

One row per (school, setting key) that an admin has saved. A school with no row for a key uses the
default in app/permissions.py, so this table starts empty and nothing has to be backfilled.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "school_permissions",
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organisations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("students", sa.Boolean, nullable=False),
        sa.Column("educators", sa.Boolean, nullable=False),
        sa.Column("can_adjust", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("actors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("school_permissions")
