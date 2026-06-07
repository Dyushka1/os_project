"""add print_scale to orders

Revision ID: b1f4c8d2e9a7
Revises: 3c9d4a61d8f2
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1f4c8d2e9a7"
down_revision: Union[str, Sequence[str], None] = "3c9d4a61d8f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("print_scale", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "print_scale")
