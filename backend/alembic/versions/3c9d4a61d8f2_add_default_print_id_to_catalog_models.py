"""add default_print_id to catalog models

Revision ID: 3c9d4a61d8f2
Revises: a7c3b9f21d10
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c9d4a61d8f2'
down_revision: Union[str, Sequence[str], None] = 'a7c3b9f21d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('catalog_models', sa.Column('default_print_id', sa.Integer(), nullable=True))
    op.create_index('ix_catalog_models_default_print_id', 'catalog_models', ['default_print_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_catalog_models_default_print_id', table_name='catalog_models')
    op.drop_column('catalog_models', 'default_print_id')