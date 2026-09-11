"""add paused and cancelled to videostatus

Revision ID: f0412d529f7e
Revises: d3b52304dc4c
Create Date: 2026-09-11 19:34:20.805289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0412d529f7e'
down_revision: Union[str, Sequence[str], None] = 'd3b52304dc4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE videostatus ADD VALUE IF NOT EXISTS 'paused'")
    op.execute("ALTER TYPE videostatus ADD VALUE IF NOT EXISTS 'cancelled'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
