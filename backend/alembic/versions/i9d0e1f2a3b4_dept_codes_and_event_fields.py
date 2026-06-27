"""add department_codes table and event restriction/attendance fields

Revision ID: i9d0e1f2a3b4
Revises: h8c9d0e1f2a3
Create Date: 2026-06-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "i9d0e1f2a3b4"
down_revision = "h8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "department_codes",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code", name="uq_department_codes_code"),
    )
    op.create_index("ix_department_codes_code", "department_codes", ["code"])

    op.add_column("events", sa.Column("allowed_departments", ARRAY(sa.String(16)), nullable=True))
    op.add_column("events", sa.Column("attendance_mode", sa.String(16), nullable=False, server_default="SCANNER"))
    op.add_column("events", sa.Column("mass_qr_interval", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "mass_qr_interval")
    op.drop_column("events", "attendance_mode")
    op.drop_column("events", "allowed_departments")
    op.drop_index("ix_department_codes_code", table_name="department_codes")
    op.drop_table("department_codes")
