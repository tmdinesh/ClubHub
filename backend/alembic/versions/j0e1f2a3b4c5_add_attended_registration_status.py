"""add ATTENDED registration status

Revision ID: j0e1f2a3b4c5
Revises: i9d0e1f2a3b4
Create Date: 2026-06-27

"""
from alembic import op

revision = "j0e1f2a3b4c5"
down_revision = "i9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # status column is VARCHAR — no enum alteration needed
    pass


def downgrade() -> None:
    pass
