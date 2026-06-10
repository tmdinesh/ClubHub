"""add is_public and join_key to teams

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-04 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("is_public", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("teams", sa.Column("join_key", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "join_key")
    op.drop_column("teams", "is_public")
