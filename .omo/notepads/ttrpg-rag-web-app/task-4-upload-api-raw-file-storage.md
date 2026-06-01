# Task 4 - Upload API, Raw File Storage, and Unsupported-Type Guardrails

Implemented against `main/` worktree.

Created/modified upload intake foundation:
- Added `POST /uploads` under `apps/api/app/routes_uploads.py`, mounted from `app/main.py`, protected by the existing Task 2 admin session dependency.
- Added `UPLOAD_DIR` settings support and raw local file writes using the compose contract path `/data/uploads` by default.
- Added `uploads` and `ingestion_jobs` SQLAlchemy models plus Alembic revision `20260531_0002_uploads.py` so upload canonical state remains Postgres-backed.
- Added `UploadQueued` response schema returning `upload_id`, `job_id`, and `queued` with HTTP `201`.
- Added `python-multipart` because FastAPI multipart upload handling requires it.
- Added `apps/api/tests/test_uploads.py` coverage for supported uploads, unsupported extensions, wrong content types, and authentication requirements.

Contract notes:
- Supported extensions are limited to `.md`, `.markdown`, `.txt`, `.html`, `.htm`, and `.epub`.
- Supported content types are constrained to markdown/plain text, HTML/XHTML, and EPUB zip types, with `application/octet-stream` accepted for raw fixture/dev clients.
- `.pdf`, `.docx`, images, unknown extensions, and supported extensions with unsupported content types return `415` with exactly `Unsupported file type. Supported types: EPUB, HTML, TXT, MD.`
- The API hashes bytes with SHA-256, stores raw bytes on disk under `UPLOAD_DIR`, records metadata in `uploads`, and creates a queued `ingestion_jobs` row.
- No parsing, indexing, OCR, retrieval, chat generation, records UI, or frontend port changes were added.

Verification evidence captured during implementation:
- Host `pytest tests/test_uploads.py` could not run because `pytest` is unavailable on the host.
- `docker compose build api` passed and installed `python-multipart==0.0.20`.
- `docker compose run --rm api pytest tests/test_uploads.py` passed: 12 tests passed, with one Passlib dependency deprecation warning.
- `lsp_diagnostics` was attempted on every changed Python file, but `basedpyright-langserver` is not installed in this environment.
- `ADMIN_PASSWORD_HASH='<test hash>' SESSION_SECRET='task4-curl-session-secret' docker compose up -d --build api` rebuilt/recreated the API without touching the web service or host port `5174`.
- `curl -fsS http://localhost:8000/health` returned `{"status":"ok"}`.
- `curl` login with `admin-password` returned `200 {"authenticated":true}` and stored the existing `thestacks_session` cookie.
- Authenticated `curl -F 'file=@tests/fixtures/sample.md;type=text/markdown' http://localhost:8000/uploads` returned `201` with `upload_id`, `job_id`, and `queued: true`.
- Authenticated `curl -F 'file=@tests/fixtures/sample.pdf;type=application/pdf' http://localhost:8000/uploads` returned `415 {"detail":"Unsupported file type. Supported types: EPUB, HTML, TXT, MD."}`.

Operational notes for downstream tasks:
- Task 5 can consume jobs from `ingestion_jobs` where `status='queued'` and join to `uploads.stored_path`, `uploads.sha256`, `uploads.extension`, and `uploads.content_type`.
- Raw file paths are stored as absolute paths from the API/worker container perspective, matching the shared compose `uploads:/data/uploads` volume.
