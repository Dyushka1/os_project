"""add width and height to catalog_prints

Revision ID: d4e1f2a3b5c6
Revises: b1f4c8d2e9a7
Create Date: 2026-05-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e1f2a3b5c6'
down_revision: Union[str, Sequence[str], None] = 'b1f4c8d2e9a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('catalog_prints', sa.Column('width', sa.Integer(), nullable=True))
    op.add_column('catalog_prints', sa.Column('height', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('catalog_prints', 'height')
    op.drop_column('catalog_prints', 'width')
