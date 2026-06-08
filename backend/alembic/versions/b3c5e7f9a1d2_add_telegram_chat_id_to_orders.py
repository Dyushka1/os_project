"""add telegram_chat_id to orders

Revision ID: b3c5e7f9a1d2
Revises: a2b4c6d8e0f1
Create Date: 2026-06-08 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c5e7f9a1d2'
down_revision: Union[str, Sequence[str], None] = 'a2b4c6d8e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('telegram_chat_id', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'telegram_chat_id')
