"""library_assets: the shared, admin-curated asset library

One row per distinct file, keyed by the SHA-256 of its bytes. No project_id and no
organisation_id on purpose: a curated asset belongs to a pack, and packs are platform-wide.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "library_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("content_type", sa.String(150), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("attribution", sa.String(500), nullable=True),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="public"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("content_sha256", name="uq_library_assets_sha256"),
        sa.CheckConstraint("kind in ('model', 'environment', 'image', 'audio', 'video')", name="ck_library_assets_kind"),
        sa.CheckConstraint("visibility in ('public', 'signed')", name="ck_library_assets_visibility"),
        sa.CheckConstraint("status in ('pending', 'uploaded', 'failed')", name="ck_library_assets_status"),
        sa.CheckConstraint("size_bytes >= 0", name="ck_library_assets_size_nonnegative"),
    )
    op.create_index("ix_library_assets_kind_created", "library_assets", ["kind", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_library_assets_kind_created", table_name="library_assets")
    op.drop_table("library_assets")
