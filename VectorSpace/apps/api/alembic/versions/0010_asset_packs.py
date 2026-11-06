"""asset_packs, pack_assets, pack_grants: admins group library files into packs and turn them on per school

A pack is a draft (rows only) until it is published. Publishing writes an immutable manifest,
library/packs/<slug>/<revision>.json, to the public library bucket and only then bumps
published_revision, so a revision number never points at a file that is not there yet.

pack_assets.library_asset_id is RESTRICT, not CASCADE: a library file that a pack ships must not
vanish under a manifest that already names it. pack_grants is one row per (school, pack).

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_packs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        # environments are a pack kind, not a second system
        sa.Column("kind", sa.String(20), nullable=False, server_default="objects"),
        # null = never published: a draft has rows but no manifest in the bucket
        sa.Column("published_revision", sa.Integer, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_asset_packs_slug"),
        sa.CheckConstraint("kind in ('objects', 'environments')", name="ck_asset_packs_kind"),
        sa.CheckConstraint("published_revision is null or published_revision >= 1", name="ck_asset_packs_revision"),
    )
    op.create_table(
        "pack_assets",
        sa.Column("pack_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("asset_packs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("library_asset_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("library_assets.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_pack_assets_library_asset", "pack_assets", ["library_asset_id"])
    op.create_table(
        "pack_grants",
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organisations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("pack_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("asset_packs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("granted_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("actors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pack_grants")
    op.drop_index("ix_pack_assets_library_asset", table_name="pack_assets")
    op.drop_table("pack_assets")
    op.drop_table("asset_packs")
