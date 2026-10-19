"""actors.last_seen_at, so the admin Accounts page can say who has never signed in

An account is Invited until its first /me call and Active afterwards; that difference was the
last thing on the Accounts page with no column behind it. GET /me stamps this on every call,
which is the only place that knows a real person just arrived.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # nullable with no default: existing rows read as "never signed in", which is true of a
    # roster that was provisioned but never used
    op.add_column("actors", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("actors", "last_seen_at")
