"""add unique join_key index and fix concurrency

Revision ID: a2b3c4d5e6f7
Revises: f6a7b8c9d0e1
Create Date: 2026-06-10
"""
from __future__ import annotations

from alembic import op

revision = "a2b3c4d5e6f7"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partial unique index: join_key must be unique when not NULL
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_join_key "
        "ON teams (join_key) WHERE join_key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_teams_join_key")
