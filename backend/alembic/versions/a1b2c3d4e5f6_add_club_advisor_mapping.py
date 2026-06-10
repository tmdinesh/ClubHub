"""add club_id to users and faculty_advisor_id to clubs

Revision ID: a1b2c3d4e5f6
Revises: b21d3caaaff3
Create Date: 2026-06-03 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "b21d3caaaff3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clubs",
        sa.Column("faculty_advisor_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_clubs_faculty_advisor_id",
        "clubs", "users",
        ["faculty_advisor_id"], ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "users",
        sa.Column("club_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_club_id",
        "users", "clubs",
        ["club_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_club_id", "users", type_="foreignkey")
    op.drop_column("users", "club_id")

    op.drop_constraint("fk_clubs_faculty_advisor_id", "clubs", type_="foreignkey")
    op.drop_column("clubs", "faculty_advisor_id")
