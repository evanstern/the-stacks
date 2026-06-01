# Task 5 - Worker Job Claiming, Parser Adapters, Chunking, and Events

Implemented against `main/` worktree.

Created/modified worker pipeline pieces:
- Added shared ingestion logic in `apps/api/app/ingestion.py` for transactional queued-job claims, Markdown/TXT/HTML parsing, chunking, durable events, and success/failure transitions.
- Extended API models with `DocumentChunk`, `IngestionEvent`, `IngestionJob.error_summary`, and `IngestionJob.metadata_json`.
- Added Alembic revision `20260531_0003_ingestion_worker.py` for `document_chunks`, `ingestion_events`, and ingestion job metadata/error columns.
- Updated `apps/worker` so the Docker worker imports the shared API ingestion code and polls jobs, with `WORKER_RUN_ONCE=true` available for deterministic verification.
- Updated worker Compose build context without touching the web host-port contract; frontend remains pinned to `5174`.

Worker contract notes:
- Queue claims use `SELECT ... FOR UPDATE SKIP LOCKED` through SQLAlchemy, ordered by `created_at` then `id`, and immediately transition `queued -> processing` with a `job_claimed` event.
- Successful parse/chunk flow records `parsing_started`, `parsing_completed`, `chunking_started`, `chunking_completed`, and `awaiting_embedding` events, stores chunks in `document_chunks`, and leaves the job in `awaiting_embedding` for Task 6.
- Parser failures are not swallowed; jobs transition to `failed`, store `error_summary`, and record a `job_failed` event. Unsupported EPUB currently fails this way because EPUB reconstruction is intentionally out of scope.
- Chunk metadata is JSON and includes `upload_id`, `job_id`, source filename/SHA/extension, parser, title, section heading, char offsets, token estimate, and chunk index for downstream Qdrant indexing/retrieval.

Verification evidence:
- Host `pytest tests/test_worker_jobs.py tests/test_parsers.py tests/test_chunking.py` could not run because `pytest` is not installed on the host PATH.
- `docker compose build api` passed after adding tests and ingestion code.
- `docker compose run --rm api pytest tests/test_worker_jobs.py tests/test_parsers.py tests/test_chunking.py` passed: 9 tests passed.
- `docker compose build worker` passed with the worker importing shared API ingestion code.
- `docker compose up -d api` applied Alembic revision `20260531_0003` before API health.
- `docker compose run --rm -e WORKER_RUN_ONCE=true worker` processed live `sample.md` rows to `awaiting_embedding`.
- Final live Postgres inspection showed `statuses=awaiting_embedding:5`; the latest `sample.md` had `chunks=1` and events `job_claimed,parsing_started,parsing_completed,chunking_started,chunking_completed,awaiting_embedding`.

## 2026-05-31 re-validation findings

- Re-read Task 1, Task 2, and Task 4 notes plus the existing Task 5 implementation in `apps/api/app/ingestion.py`, `apps/worker/worker.py`, and Alembic revision `20260531_0003_ingestion_worker.py`.
- Confirmed the current implementation keeps the scope narrow: Markdown/TXT/HTML parsing only, explicit parser failure for unsupported EPUB, no embedding calls, no Qdrant upserts, and no frontend port changes.
- Confirmed the required pytest files already exist: `tests/test_worker_jobs.py`, `tests/test_parsers.py`, and `tests/test_chunking.py`.
- Host `pytest tests/test_worker_jobs.py tests/test_parsers.py tests/test_chunking.py` still cannot run because `pytest` is not installed on the host PATH.
- `docker compose run --rm api pytest tests/test_worker_jobs.py tests/test_parsers.py tests/test_chunking.py` passed again: 9 tests passed.
