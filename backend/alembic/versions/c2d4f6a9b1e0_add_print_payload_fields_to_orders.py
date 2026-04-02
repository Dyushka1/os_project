"""add print payload fields to orders

Revision ID: c2d4f6a9b1e0
Revises: 91407e191ba4
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d4f6a9b1e0"
down_revision: Union[str, Sequence[str], None] = "91407e191ba4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("print_text", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("print_font", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("print_side", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("print_x", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("print_y", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("print_angle", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "print_angle")
    op.drop_column("orders", "print_y")
    op.drop_column("orders", "print_x")
    op.drop_column("orders", "print_side")
    op.drop_column("orders", "print_font")
    op.drop_column("orders", "print_text")
