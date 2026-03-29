"""add promo notify columns to orders

Revision ID: 91407e191ba4
Revises: 7e5d698ab939
Create Date: 2026-03-27 22:09:38.446362

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91407e191ba4'
down_revision: Union[str, Sequence[str], None] = '7e5d698ab939'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column("orders", sa.Column("promo_code", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("notify_method", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("notify_contact", sa.String(), nullable=True))
    op.create_index("ix_orders_promo_code", "orders", ["promo_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_orders_promo_code", table_name="orders")
    op.drop_column("orders", "notify_contact")
    op.drop_column("orders", "notify_method")
    op.drop_column("orders", "promo_code")