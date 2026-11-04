"""media_links: external media (YouTube first) with a teacher approval state

Info cards show an image or video from the project's media library. Uploaded files already
have media_assets; a link has no storage_key and needs approval, so it gets a sibling table
instead of loosening media_assets' constraints. url is always rebuilt from provider and
provider_id, never stored as pasted.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("actors.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_id", sa.String(100), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("approval", sa.String(50), nullable=False, server_default="pending"),
        sa.Column(
            "approved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("actors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_comment", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "provider", "provider_id", name="uq_media_links_project_provider_id"),
        sa.CheckConstraint("kind in ('image', 'video')", name="ck_media_links_kind"),
        sa.CheckConstraint("provider in ('youtube')", name="ck_media_links_provider"),
        sa.CheckConstraint("approval in ('pending', 'approved', 'rejected')", name="ck_media_links_approval"),
    )


def downgrade() -> None:
    op.drop_table("media_links")
