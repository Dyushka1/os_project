"""add print_scale_x and print_scale_y to orders

Revision ID: e5f2a1b3c8d9
Revises: d4e1f2a3b5c6
Create Date: 2026-06-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f2a1b3c8d9'
down_revision: Union[str, Sequence[str], None] = 'd4e1f2a3b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('print_scale_x', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('print_scale_y', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'print_scale_y')
    op.drop_column('orders', 'print_scale_x')
