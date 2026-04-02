"""add garment_type to catalog models

Revision ID: f322b6f9145f
Revises: c2d4f6a9b1e0
Create Date: 2026-03-29 15:01:56.101641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f322b6f9145f'
down_revision: Union[str, Sequence[str], None] = 'c2d4f6a9b1e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("catalog_models", sa.Column("garment_type", sa.String(), nullable=True))
    op.create_index("ix_catalog_models_garment_type", "catalog_models", ["garment_type"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_catalog_models_garment_type", table_name="catalog_models")
    op.drop_column("catalog_models", "garment_type")
