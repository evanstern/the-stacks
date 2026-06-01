"""retarget chat chunk foreign keys

Revision ID: 20260601_0007
Revises: 20260601_0006
Create Date: 2026-06-01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260601_0007"
down_revision: str | None = "20260601_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "chunks" not in inspector.get_table_names():
        return
    _retarget_document_chunk_fk(inspector, "indexed_chunks")
    _retarget_document_chunk_fk(inspector, "retrieval_hits")
    _retarget_document_chunk_fk(inspector, "citations")


def downgrade() -> None:
    pass


def _retarget_document_chunk_fk(inspector: sa.Inspector, table_name: str) -> None:
    if table_name not in inspector.get_table_names():
        return
    for foreign_key in inspector.get_foreign_keys(table_name):
        if foreign_key.get("constrained_columns") != ["document_chunk_id"]:
            continue
        if foreign_key.get("referred_table") == "chunks":
            return
        constraint_name = foreign_key.get("name")
        if constraint_name is None:
            continue
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")
        op.create_foreign_key(None, table_name, "chunks", ["document_chunk_id"], ["id"], postgresql_not_valid=True)
        return
