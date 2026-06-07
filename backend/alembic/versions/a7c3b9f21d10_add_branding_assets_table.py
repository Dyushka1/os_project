"""add branding_assets table

Revision ID: a7c3b9f21d10
Revises: f322b6f9145f
Create Date: 2026-04-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c3b9f21d10"
down_revision: Union[str, Sequence[str], None] = "f322b6f9145f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "branding_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("asset_key", sa.String(), nullable=False),
        sa.Column("file_url", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("color_value", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_branding_assets_id"), "branding_assets", ["id"], unique=False)
    op.create_index(op.f("ix_branding_assets_asset_key"), "branding_assets", ["asset_key"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_branding_assets_asset_key"), table_name="branding_assets")
    op.drop_index(op.f("ix_branding_assets_id"), table_name="branding_assets")
    op.drop_table("branding_assets")
