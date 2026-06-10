"""add user bank/roll fields and winners table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a1b2c3d4e5f6"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("roll_number", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("bank_account_name", sa.String(256), nullable=True))
    op.add_column("users", sa.Column("bank_account_number", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("bank_ifsc", sa.String(16), nullable=True))

    op.create_table(
        "event_winners",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("prize_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_winners_event_user"),
        sa.UniqueConstraint("event_id", "position", name="uq_event_winners_event_position"),
    )
    op.create_index("ix_event_winners_event_id", "event_winners", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_event_winners_event_id", table_name="event_winners")
    op.drop_table("event_winners")
    op.drop_column("users", "bank_ifsc")
    op.drop_column("users", "bank_account_number")
    op.drop_column("users", "bank_account_name")
    op.drop_column("users", "roll_number")
