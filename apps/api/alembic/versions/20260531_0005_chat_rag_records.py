"""add chat rag records

Revision ID: 20260531_0005
Revises: 20260531_0004
Create Date: 2026-05-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260531_0005"
down_revision: str | None = "20260531_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    existing_tables = sa.inspect(op.get_bind()).get_table_names()
    if "chat_messages" not in existing_tables:
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("chat_session_id", sa.String(length=36), nullable=False),
            sa.Column("role", sa.String(length=32), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_chat_messages_session_created", "chat_messages", ["chat_session_id", "created_at"])
    if "retrieval_runs" not in existing_tables:
        op.create_table(
            "retrieval_runs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("chat_session_id", sa.String(length=36), nullable=False),
            sa.Column("user_message_id", sa.String(length=36), nullable=False),
            sa.Column("assistant_message_id", sa.String(length=36), nullable=True),
            sa.Column("query", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["assistant_message_id"], ["chat_messages.id"]),
            sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"]),
            sa.ForeignKeyConstraint(["user_message_id"], ["chat_messages.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_retrieval_runs_session_created", "retrieval_runs", ["chat_session_id", "created_at"])
    if "retrieval_hits" not in existing_tables:
        op.create_table(
            "retrieval_hits",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("retrieval_run_id", sa.String(length=36), nullable=False),
            sa.Column("document_chunk_id", sa.String(length=36), nullable=False),
            sa.Column("rank", sa.Integer(), nullable=False),
            sa.Column("score", sa.String(length=64), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_chunk_id"], ["chunks.id"]),
            sa.ForeignKeyConstraint(["retrieval_run_id"], ["retrieval_runs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if "citations" not in existing_tables:
        op.create_table(
            "citations",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("assistant_message_id", sa.String(length=36), nullable=False),
            sa.Column("retrieval_run_id", sa.String(length=36), nullable=False),
            sa.Column("document_chunk_id", sa.String(length=36), nullable=False),
            sa.Column("label", sa.String(length=64), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["assistant_message_id"], ["chat_messages.id"]),
            sa.ForeignKeyConstraint(["document_chunk_id"], ["chunks.id"]),
            sa.ForeignKeyConstraint(["retrieval_run_id"], ["retrieval_runs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_citations_message", "citations", ["assistant_message_id"])


def downgrade() -> None:
    op.drop_index("ix_citations_message", table_name="citations")
    op.drop_table("citations")
    op.drop_table("retrieval_hits")
    op.drop_index("ix_retrieval_runs_session_created", table_name="retrieval_runs")
    op.drop_table("retrieval_runs")
    op.drop_index("ix_chat_messages_session_created", table_name="chat_messages")
    op.drop_table("chat_messages")
