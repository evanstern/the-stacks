"""repair canonical ingestion tables

Revision ID: 20260601_0006
Revises: 20260531_0005
Create Date: 2026-06-01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260601_0006"
down_revision: str | None = "20260531_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "sources" not in existing_tables:
        op.create_table(
            "sources",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("upload_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("source_type", sa.String(length=32), nullable=False),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("chunk_count", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_sources_upload", "sources", ["upload_id"])
        existing_tables.add("sources")

    if "documents" not in existing_tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("source_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("ordinal", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_documents_source", "documents", ["source_id"])
        existing_tables.add("documents")

    if "sections" not in existing_tables:
        op.create_table(
            "sections",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("heading_path", sa.Text(), nullable=True),
            sa.Column("ordinal", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_sections_document", "sections", ["document_id"])
        existing_tables.add("sections")

    if "chunks" not in existing_tables:
        op.create_table(
            "chunks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("upload_id", sa.String(length=36), nullable=False),
            sa.Column("ingestion_job_id", sa.String(length=36), nullable=False),
            sa.Column("source_id", sa.String(length=36), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("section_id", sa.String(length=36), nullable=False),
            sa.Column("chunk_index", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.String(length=64), nullable=False),
            sa.Column("token_count", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
            sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"]),
            sa.ForeignKeyConstraint(["section_id"], ["sections.id"]),
            sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
            sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_chunks_job_index", "chunks", ["ingestion_job_id", "chunk_index"])
        existing_tables.add("chunks")

    if "chunks" in existing_tables:
        _retarget_document_chunk_fk(inspector, "indexed_chunks")
        _retarget_document_chunk_fk(inspector, "retrieval_hits")
        _retarget_document_chunk_fk(inspector, "citations")


def downgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())
    if "chunks" in existing_tables:
        op.drop_index("ix_chunks_job_index", table_name="chunks")
        op.drop_table("chunks")
    if "sections" in existing_tables:
        op.drop_index("ix_sections_document", table_name="sections")
        op.drop_table("sections")
    if "documents" in existing_tables:
        op.drop_index("ix_documents_source", table_name="documents")
        op.drop_table("documents")
    if "sources" in existing_tables:
        op.drop_index("ix_sources_upload", table_name="sources")
        op.drop_table("sources")


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
