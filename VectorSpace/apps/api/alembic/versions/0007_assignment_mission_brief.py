"""assignments.mission_brief: the teacher's mission brief, stored once per class

Template setup's "Assign to <class>" only wrote the brief into the teacher's browser, so
students opening their copy from the server never saw it. The brief now lives on the
class's assignment and is sent with each student copy (GET /projects/{id}).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-27

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # nullable, so assignments made before this keep working (they just have no brief)
    op.add_column("assignments", sa.Column("mission_brief", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("assignments", "mission_brief")
