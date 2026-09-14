from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None


def upgrade():
    op.create_table("sites", sa.Column("id", sa.String(64), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("site_type", sa.String(16), nullable=False), sa.Column("longitude", sa.Float, nullable=False), sa.Column("latitude", sa.Float, nullable=False), sa.Column("power_limit_kw", sa.Float, nullable=False), sa.Column("price_per_kwh", sa.Float, nullable=False))


def downgrade():
    op.drop_table("sites")
