---
title: ETL Architecture
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-06
tags:
  - wiki
  - etl
  - architecture
---

# ETL Architecture

This page documents the current ETL path from upload intake through embedding and Qdrant indexing. It is written for code changes, so the focus is on module ownership, status transitions, persistence shape, and the boundaries between the host, the plugins, and the worker.

## End-to-end flow

### 1. Upload intake and validation

`POST /uploads` is handled by `app.routes_uploads`. That module owns upload validation and job creation.

- `_validate_upload()` checks the file extension and MIME type against `SUPPORTED_CONTENT_TYPES`.
- `_safe_filename()` rejects path traversal and empty names.
- `_create_upload_and_job()` writes the `Upload` row, stores the file, and creates the `IngestionJob` row in `queued` status.
- ZIP uploads are stored through `store_source_archive()` and receive archive metadata from `_metadata_for_archive()`.

Batch uploads are also handled here. `_batch_inputs_from_uploads()` and `_nested_zip_batch_inputs()` expand ZIP batches before validation. A ZIP whose contents are themselves ZIP files is treated as a batch bundle when it only contains nested ZIP entries and no HTML content. Single file uploads keep the legacy response shape, while multi-file batch uploads return batch identifiers and per-file status rows.

### 2. Worker claim

`apps/worker/worker.py` runs a poll loop that opens a database session and calls `process_next_job()` from `app.ingestion`.

- `WORKER_RUN_ONCE=true` makes the worker process at most one iteration and exit.
- `WORKER_POLL_SECONDS` controls the sleep interval between polls.
- The worker prints the uploaded directory once at startup, but the actual claim logic lives in `app.ingestion`.

`claim_next_job()` selects one `queued` job with `FOR UPDATE SKIP LOCKED`, orders by `created_at` and `id`, then moves the job to `processing` and records a `processing` event. `claim_next_awaiting_embedding_job()` uses the same locking pattern for jobs already parked at `awaiting_embedding`.

### 3. Parse, chunk, and persist canonical rows

`app.ingestion` orchestrates the host-owned ETL path. It wires together the plugin, parser compatibility layer, chunker, Postgres load service, embeddings, and Qdrant indexing.

The sequential runner in `app.etl.runner.DirectSequentialEtlRunner` performs the early stages in order:

1. `extract`
2. optional `transform`
3. `chunk`
4. `load`

For host-driven jobs, `process_claimed_job()` records `parsing_started`, builds the sequential runner, and then records `parsing_completed` once a parsed document and chunks exist. The job then moves through `chunking` and `awaiting_embedding`.

The canonical persistence model written by `app.etl.load_services.PostgresLoadService` is:

- `Source` belongs to one `Upload` and stores the source-wide metadata.
- `Document` belongs to one `Source` and represents the normalized document record.
- `Section` belongs to one `Document` and stores each persisted section heading and offsets.
- `DocumentChunk` belongs to one `Upload`, `IngestionJob`, `Source`, `Document`, and `Section`.
- `IndexedChunk` belongs to one `DocumentChunk` and records the Qdrant point and embedding identity.

### 4. Embedding and indexing

Once the job reaches `awaiting_embedding`, `process_next_job()` can pick it up again and route it through `_embed_and_index_job()`.

The job status sequence is:

- `queued`
- `processing`
- `chunking`
- `awaiting_embedding`
- `embedding`
- `indexing`
- `completed`

Any stage can transition to `failed` through `_fail_job()`. The failure path also stores a sanitized error summary on `IngestionJob.error_summary` and keeps redacted diagnostics in `metadata_json` under the `failure` key.

`_embed_and_index_job()` records these event types in order:

- `embedding_started`
- `embedding_completed`
- `indexing_started`
- `indexing_completed`
- `job_completed`

Failure paths record `job_failed`. Earlier parsing paths also record `parsing_started`, `parsing_completed`, `parsing_warnings`, `chunking_started`, `chunking_completed`, and `awaiting_embedding`.

The embedding step uses `app.embeddings.get_embedding_client()` and supports `openai` and `huggingface` providers. The client embeds all chunk texts, then `_qdrant_points()` pairs each vector with the matching `DocumentChunk` and builds a deterministic `QdrantPoint` payload. `QdrantLoadService.persist_index()` ensures the collection, upserts points, and inserts `IndexedChunk` rows.

## Module map

- `app.routes_uploads`: upload validation, ZIP batch expansion, upload row creation, and ingestion job creation.
- `app.ingestion`: legacy parser routing, chunking, job lifecycle, embedding orchestration, error normalization, and Qdrant point construction.
- `app.etl.runner`: sequential ETL runner that executes extract, transform, chunk, and load in order.
- `app.etl.load_services`: Postgres persistence for `Source`, `Document`, `Section`, `DocumentChunk`, plus Qdrant persistence for `IndexedChunk`.
- `app.etl.bundled`: built-in source plugins for D&D Beyond saved HTML, archived webpages, and generic HTML.
- `app.etl.ingestion_compat`: adapters between legacy parsed documents and normalized plugin documents, plus archive locator translation.
- `apps/worker/worker.py`: background poll loop that claims queued or awaiting-embedding jobs.
- `app.embeddings`: provider abstraction for OpenAI and Hugging Face embeddings.
- `app.ddb_import`: DnDBeyond saved HTML detection, sanitization, parsing, and artifact extraction.

## Chunking

`app.ingestion` owns chunking for the host path. The constants are `MAX_CHUNK_CHARS = 1200` and `CHUNK_OVERLAP_CHARS = 160`.

- Section text is normalized, then split by `_split_text()` into overlapping slices that stay within the max length.
- Each chunk keeps section-relative offsets in `start_char` and `end_char`.
- Chunk metadata carries upload and parser identity, the section heading, token count estimate, and any section or document metadata.

`app.etl.runner` does not chunk on its own. It delegates to the chunker callable supplied by the host, which keeps chunking a host concern rather than a plugin concern.

## Embedding

The embedding client is selected by `get_embedding_client(settings)`.

- `OpenAIEmbeddingClient` batches texts with `_batch_texts()` using the token estimate in `_estimate_text_tokens()` and the request token limit `OPENAI_EMBEDDING_REQUEST_TOKEN_LIMIT = 2500`.
- OpenAI requests are retried on `429` with `OPENAI_EMBEDDING_REQUEST_MAX_RETRIES = 3` and a backoff derived from `Retry-After` or `OPENAI_EMBEDDING_RETRY_BACKOFF_SECONDS = 12.0`.
- `HuggingFaceEmbeddingClient` loads `sentence_transformers.SentenceTransformer` locally and encodes the full text list in process.
- Both clients return an `EmbeddingBatch` with the vectors, model name, dimensions, and provider string.

`_embed_and_index_job()` requires the embedding vector count to match the chunk count and the vector dimensions to match the configured embedding size before it will proceed to indexing.

## Qdrant indexing

`app.qdrant_index.HttpQdrantIndexer` manages the collection and points.

- `ensure_collection()` creates the collection if needed and refuses to reuse an existing collection with a different vector size.
- `upsert_points()` sends points in batches of 25 with `wait=true`.
- `QdrantPoint` stores the point id, vector, and payload.

Point ids are deterministic. `_qdrant_points()` calls `deterministic_point_id(chunk)`, which uses `uuid5(NAMESPACE_URL, f"thestacks:{chunk.upload_id}:{chunk.ingestion_job_id}:{chunk.id}")`.

The payload contains `source_id`, `chunk_id`, `filename`, `section`, `embedding_model`, `embedding_dimensions`, `chunk_index`, and `ingestion_job_id`. For archived webpages, `_archive_locator_metadata()` adds archive locator fields from the chunk metadata.

## Error handling

`app.ingestion` classifies failures into the current `FAILURE_CATEGORIES` set, including `invalid_zip`, `unsupported_source_type`, `ddb_parse_error`, `missing_required_file`, `duplicate_source`, `storage_error`, `database_error`, `qdrant_index_error`, `plugin_error`, `worker_timeout`, and `unknown_error`.

- `_failure_category()` inspects the exception chain and summary text.
- `_safe_failure_message()` maps categories to public-safe messages.
- `_redact_failure_message()` strips tracebacks, file paths, and other unsafe content when the category is `unknown_error`.
- `_failure_diagnostics()` stores a truncated summary plus exception type, module, and traceback for internal diagnostics.

The job row stores the sanitized summary in `error_summary`, and the structured failure data is merged into `metadata_json` under the `failure` key.

## Related notes

- [[ETL Plugin Contracts]] for the plugin interface and registry.
- [[LangGraph ETL Decision]] for the orchestration decision that shaped the runner boundary.
- [[Layer Boundaries]] for the broader ownership split.
- [[RAG Retrieval Architecture]] for the downstream retrieval contract.
