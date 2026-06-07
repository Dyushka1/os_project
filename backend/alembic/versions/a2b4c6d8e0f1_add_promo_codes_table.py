"""add promo_codes table

Revision ID: a2b4c6d8e0f1
Revises: f7a3c2e1d8b4
Create Date: 2026-06-08 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b4c6d8e0f1'
down_revision: Union[str, Sequence[str], None] = 'f7a3c2e1d8b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'promo_codes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('code', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade() -> None:
    op.drop_table('promo_codes')
