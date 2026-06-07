"""add print2 fields to orders

Revision ID: f7a3c2e1d8b4
Revises: e5f2a1b3c8d9
Create Date: 2026-06-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a3c2e1d8b4'
down_revision: Union[str, Sequence[str], None] = 'e5f2a1b3c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('print2_id', sa.Integer(), sa.ForeignKey('catalog_prints.id'), nullable=True))
    op.add_column('orders', sa.Column('print2_text', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('print2_font', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('print2_side', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('print2_x', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('print2_y', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('print2_angle', sa.Float(), nullable=True))
    op.add_column('orders', sa.Column('print2_scale', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('print2_scale_x', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('print2_scale_y', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'print2_scale_y')
    op.drop_column('orders', 'print2_scale_x')
    op.drop_column('orders', 'print2_scale')
    op.drop_column('orders', 'print2_angle')
    op.drop_column('orders', 'print2_y')
    op.drop_column('orders', 'print2_x')
    op.drop_column('orders', 'print2_side')
    op.drop_column('orders', 'print2_font')
    op.drop_column('orders', 'print2_text')
    op.drop_column('orders', 'print2_id')
