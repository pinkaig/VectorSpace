"""projects.showcase: a published museum a teacher chose for the sign-in page

The sign-in page is public, so it shows only museums a teacher switched on, never every
published one. False for every existing project.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("showcase", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("projects", "showcase")
