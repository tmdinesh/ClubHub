"""add team event fields to events

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-04 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("is_team_event", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("events", sa.Column("team_min_size", sa.Integer(), nullable=False, server_default="2"))
    op.add_column("events", sa.Column("team_max_size", sa.Integer(), nullable=False, server_default="5"))


def downgrade() -> None:
    op.drop_column("events", "team_max_size")
    op.drop_column("events", "team_min_size")
    op.drop_column("events", "is_team_event")
