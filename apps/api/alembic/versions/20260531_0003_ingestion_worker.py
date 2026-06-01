"""add ingestion worker outputs

Revision ID: 20260531_0003
Revises: 20260531_0002
Create Date: 2026-05-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260531_0003"
down_revision: str | None = "20260531_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    ingestion_job_columns = {column["name"] for column in inspector.get_columns("ingestion_jobs")}
    if "error_summary" not in ingestion_job_columns:
        op.add_column("ingestion_jobs", sa.Column("error_summary", sa.Text(), nullable=True))
    if "metadata_json" not in ingestion_job_columns:
        op.add_column(
            "ingestion_jobs",
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        )
        op.alter_column("ingestion_jobs", "metadata_json", server_default=None)

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

    if "ingestion_events" not in existing_tables:
        op.create_table(
            "ingestion_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("ingestion_job_id", sa.String(length=36), nullable=False),
            sa.Column("upload_id", sa.String(length=36), nullable=False),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"]),
            sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ingestion_events_job_created", "ingestion_events", ["ingestion_job_id", "created_at"])

    if "indexed_chunks" not in existing_tables:
        op.create_table(
            "indexed_chunks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("upload_id", sa.String(length=36), nullable=False),
            sa.Column("ingestion_job_id", sa.String(length=36), nullable=False),
            sa.Column("document_chunk_id", sa.String(length=36), nullable=False),
            sa.Column("qdrant_collection", sa.String(length=255), nullable=False),
            sa.Column("qdrant_point_id", sa.String(length=36), nullable=False),
            sa.Column("embedding_model", sa.String(length=255), nullable=False),
            sa.Column("embedding_dimensions", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_chunk_id"], ["chunks.id"]),
            sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"]),
            sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_indexed_chunks_job", "indexed_chunks", ["ingestion_job_id"])


def downgrade() -> None:
    op.drop_index("ix_indexed_chunks_job", table_name="indexed_chunks")
    op.drop_table("indexed_chunks")
    op.drop_index("ix_ingestion_events_job_created", table_name="ingestion_events")
    op.drop_table("ingestion_events")
    op.drop_index("ix_chunks_job_index", table_name="chunks")
    op.drop_table("chunks")
    op.drop_index("ix_sections_document", table_name="sections")
    op.drop_table("sections")
    op.drop_index("ix_documents_source", table_name="documents")
    op.drop_table("documents")
    op.drop_index("ix_sources_upload", table_name="sources")
    op.drop_table("sources")
    op.drop_column("ingestion_jobs", "metadata_json")
    op.drop_column("ingestion_jobs", "error_summary")
