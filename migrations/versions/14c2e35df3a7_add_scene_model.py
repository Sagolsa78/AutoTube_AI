"""add_scene_model

Revision ID: 14c2e35df3a7
Revises: de47fccac0ec
Create Date: 2026-09-04 13:50:09.650391

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "14c2e35df3a7"
down_revision: Union[str, Sequence[str], None] = "de47fccac0ec"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "scenes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("script_id", sa.String(), nullable=False),
        sa.Column("scene_number", sa.Integer(), nullable=False),
        sa.Column("narration", sa.Text(), nullable=True),
        sa.Column("visual_description", sa.Text(), nullable=True),
        sa.Column("asset_id", sa.String(), nullable=True),
        sa.Column("duration_est", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["script_id"], ["scripts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("scenes")
    # ### end Alembic commands ###
