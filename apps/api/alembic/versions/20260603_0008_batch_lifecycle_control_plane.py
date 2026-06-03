"""add batch and version lifecycle control plane

Revision ID: 20260603_0008
Revises: 20260601_0007
Create Date: 2026-06-03
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260603_0008"
down_revision: str | None = "20260601_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "upload_batches" not in existing_tables:
        op.create_table(
            "upload_batches",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("file_count", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("upload_batches", "metadata_json", server_default=None)

    upload_columns = {column["name"] for column in inspector.get_columns("uploads")}
    if "batch_id" not in upload_columns:
        op.add_column("uploads", sa.Column("batch_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_uploads_batch_id_upload_batches", "uploads", "upload_batches", ["batch_id"], ["id"])
    if "batch_position" not in upload_columns:
        op.add_column("uploads", sa.Column("batch_position", sa.Integer(), nullable=True))

    ingestion_job_columns = {column["name"] for column in inspector.get_columns("ingestion_jobs")}
    if "batch_id" not in ingestion_job_columns:
        op.add_column("ingestion_jobs", sa.Column("batch_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_ingestion_jobs_batch_id_upload_batches", "ingestion_jobs", "upload_batches", ["batch_id"], ["id"])

    ingestion_event_columns = {column["name"] for column in inspector.get_columns("ingestion_events")}
    if "batch_id" not in ingestion_event_columns:
        op.add_column("ingestion_events", sa.Column("batch_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_ingestion_events_batch_id_upload_batches", "ingestion_events", "upload_batches", ["batch_id"], ["id"])

    if "immutable_source_archives" not in existing_tables:
        op.create_table(
            "immutable_source_archives",
            sa.Column("content_hash", sa.String(length=64), nullable=False),
            sa.Column("storage_path", sa.Text(), nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("content_hash"),
        )
        op.alter_column("immutable_source_archives", "metadata_json", server_default=None)

    if "runtime_versions" not in existing_tables:
        op.create_table(
            "runtime_versions",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("display_label", sa.String(length=255), nullable=True),
            sa.Column("label_slug", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("database_name", sa.String(length=63), nullable=False),
            sa.Column("database_url", sa.Text(), nullable=False),
            sa.Column("qdrant_collection", sa.String(length=255), nullable=False),
            sa.Column("upload_prefix", sa.Text(), nullable=False),
            sa.Column("static_prefix", sa.Text(), nullable=False),
            sa.Column("runtime_prefix", sa.Text(), nullable=False),
            sa.Column("source_archive_hash", sa.String(length=64), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["source_archive_hash"], ["immutable_source_archives.content_hash"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("runtime_versions", "metadata_json", server_default=None)

    if "active_version_pointers" not in existing_tables:
        op.create_table(
            "active_version_pointers",
            sa.Column("name", sa.String(length=64), nullable=False),
            sa.Column("runtime_version_id", sa.String(length=36), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["runtime_version_id"], ["runtime_versions.id"]),
            sa.PrimaryKeyConstraint("name"),
        )
        op.alter_column("active_version_pointers", "metadata_json", server_default=None)

    if "version_lifecycle_events" not in existing_tables:
        op.create_table(
            "version_lifecycle_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("runtime_version_id", sa.String(length=36), nullable=False),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["runtime_version_id"], ["runtime_versions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("version_lifecycle_events", "metadata_json", server_default=None)

    if "teardown_steps" not in existing_tables:
        op.create_table(
            "teardown_steps",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("runtime_version_id", sa.String(length=36), nullable=False),
            sa.Column("step_type", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("ordinal", sa.Integer(), nullable=False),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["runtime_version_id"], ["runtime_versions.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("teardown_steps", "metadata_json", server_default=None)


def downgrade() -> None:
    op.drop_table("teardown_steps")
    op.drop_table("version_lifecycle_events")
    op.drop_table("active_version_pointers")
    op.drop_table("runtime_versions")
    op.drop_table("immutable_source_archives")
    op.drop_constraint("fk_ingestion_events_batch_id_upload_batches", "ingestion_events", type_="foreignkey")
    op.drop_column("ingestion_events", "batch_id")
    op.drop_constraint("fk_ingestion_jobs_batch_id_upload_batches", "ingestion_jobs", type_="foreignkey")
    op.drop_column("ingestion_jobs", "batch_id")
    op.drop_column("uploads", "batch_position")
    op.drop_constraint("fk_uploads_batch_id_upload_batches", "uploads", type_="foreignkey")
    op.drop_column("uploads", "batch_id")
    op.drop_table("upload_batches")
