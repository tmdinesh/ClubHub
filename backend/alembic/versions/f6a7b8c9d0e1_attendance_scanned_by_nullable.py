"""attendance scanned_by nullable - drop users FK

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "attendance_records_scanned_by_fkey",
        "attendance_records",
        type_="foreignkey",
    )
    op.alter_column("attendance_records", "scanned_by", nullable=True)


def downgrade() -> None:
    op.alter_column("attendance_records", "scanned_by", nullable=False)
    op.create_foreign_key(
        "attendance_records_scanned_by_fkey",
        "attendance_records",
        "users",
        ["scanned_by"],
        ["id"],
        ondelete="RESTRICT",
    )
