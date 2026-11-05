"""projects.showcase: a published museum a teacher chose for the sign-in page

The sign-in page is public, so it shows only museums a teacher switched on, never every
published one. False for every existing project.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-30

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("showcase", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("projects", "showcase")
