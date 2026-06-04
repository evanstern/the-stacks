# The Stacks

The Stacks is a TTRPG session harness. It is a local and deployable web app for running sessions with authenticated chat, uploads, retrieval-backed answers, ingestion and job visibility, and records views around material the operator supplies.

## What this project is

- A bare shared Git store plus worktrees workflow for day-to-day development.
- A TTRPG session harness that helps operators run sessions with their own lawful campaign and reference material.
- A web app with chat/session workflows, upload/import paths, retrieval-backed answers, and records/observability for uploads, jobs, sources, chunks, and retrieval runs.

## What this project is not

- It does not ship, download, scrape, or provide rulebooks.
- It does not include proprietary game data or bundled DnDBeyond exports.
- It does not replace ownership or licensing of source material.
- Users and operators must supply lawful content they have rights to use.

This repo runs as a bare shared Git store plus worktrees. `.bare/` is shared plumbing, `main/` is deploy-only, and day-to-day development happens in worktrees beside it. Keep `.omo/` at the repo root beside those worktrees so OMO planning, notes, and evidence stay outside the Git plumbing.

The Dockerized web app is intentionally exposed on host port `5173`. Keep that port contract when running or hardening the stack.

## Start the stack

```bash
docker compose up --build
```

Compose starts Postgres, Qdrant, the FastAPI API, the ingestion worker, and the Vite frontend. The API and worker wait on healthy Postgres/Qdrant; the frontend waits on the API healthcheck.

Create the local env file for each worktree from `.env.example`, then add only worktree-local overrides there. Do not bootstrap local development by copying production env files. Keep `.env.production.example` for the production path only.

The compose stack uses the same stack-specific env-file pattern as the promoted webpage runtime: `.env.example` plus `.env.webpage-5174`. That keeps the local app on `5173` while preserving the promoted storage layout and runtime defaults.

For local smoke, compose supplies the documented dev password `admin-password` through a valid bcrypt hash and a local-only session secret. Override `SMOKE_ADMIN_PASSWORD_HASH`, `SMOKE_SESSION_SECRET`, and `OPENAI_API_KEY` in your shell when using non-smoke credentials.

## Monitor local data

Postgres and Qdrant are exposed only on localhost for local inspection:

- Postgres: `localhost:5432`, database `thestacks`, user `thestacks`, password `thestacks`
- Qdrant dashboard/API: `http://localhost:6333/dashboard`

Start pgAdmin with the optional admin profile:

```bash
docker compose --profile admin up --build
```

Then open `http://localhost:5050` and log in with `admin@thestacks.local` / `admin-password`. Register the database server in pgAdmin with host `postgres`, port `5432`, maintenance database `thestacks`, username `thestacks`, and password `thestacks`.

For terminal monitoring, connect directly from the host while the stack is running:

```bash
psql postgresql://thestacks:thestacks@localhost:5432/thestacks
```

## Verify locally

```bash
make test
make smoke
make smoke-public
```

`make test` runs the backend pytest suite, using local pytest when available and the API container otherwise. `make smoke` waits for `http://localhost:8000/health` and `http://localhost:5173`, logs in with the dev password, verifies unauthenticated access is rejected, queues a supported Markdown upload, checks unsupported files return `415`, creates an empty chat session, and confirms chat dependency failures are explicit when `OPENAI_API_KEY` is not configured. It also rechecks the frontend on `5173` before exiting.

`make smoke-public` runs `scripts/smoke-public.sh` against both `THE_STACKS_LOCAL_URL=http://localhost:8423` and `THE_STACKS_BASE_URL=https://thestacks.ikis.ai` by default. It exercises the audited root-mounted API contract (`/health`, `/auth/*`, `/sessions*`, `/uploads`, `/jobs/*`, `/records/*`) and verifies SPA delivery on `/` and `/login` without browser automation. Override either base URL if you need to point at a different deployment target.

## Upload batches and runtime versions

- `POST /uploads` accepts repeated multipart field `file`. Single-file uploads keep the legacy response shape, while multi-file ZIP batches return `batch_id`, `items`, `queued`, and `upload_status_url`.
- Use the canonical browser refresh link `/upload?batch_id=<batch_id>` and the backend batch status endpoint `GET /uploads/batches/{batch_id}` to resume or inspect a batch.
- Batch status rows stay file-scoped. They surface `filename`, `category`, and a safe public `message`, and they do not expose tracebacks or raw filesystem paths.
- Immutable source archives are content-addressed under `/data/uploads/source-archives/...`. Matching bytes reuse the same archive record, and teardown does not delete `source-archives`.
- Version runtime namespaces come from internal version IDs, not user labels or filenames. Each version gets its own database name and URL, Qdrant collection, and upload, static, and runtime prefixes.
- Activation only accepts versions in `ready` state and refuses teardown-locked versions. The default active pointer is updated during activation, and the active version cannot be torn down.
- Teardown is dry-run first. Confirmed teardown requires explicit confirmation, records lifecycle events, persists steps so reruns can resume, and keeps failed steps marked for audit.

## Optional user-supplied corpus import

The optional corpus workflow can load the 5e core trio — Player's Handbook, Dungeon Master's Guide, and Monster Manual — into an isolated `default-corpus` runtime version. Any DnDBeyond archives or 5e book exports are local external inputs supplied by the operator. The repository does not provide them, and the tool must not download or commit them.

### Archive setup

Place saved DnDBeyond HTML ZIP archives in your archive root directory (`/data/uploads/sourcebooks` by default). The identity manifest expects exactly these filenames when you supply those files locally:

- `phb-2014.zip` — Player's Handbook
- `dmg-2014.zip` — Dungeon Master's Guide
- `mm-2014.zip` — Monster Manual

These files must be DnDBeyond saved-HTML exports that you already lawfully possess. Do not rename archives from other sources to match these filenames, and do not treat the repository as a source for the archives.

### Workflow

Run these Make targets from `main/`:

```bash
# 1. Verify upstream primitives are available
make corpus-preflight

# 2. Generate a lock manifest with SHA256 hashes and expected counts
make corpus-lock ARCHIVE_ROOT=/data/uploads/sourcebooks

# 3. Preview what seed will do without mutating state
make corpus-seed-dry-run

# 4. Seed the corpus (imports archives, waits for ingestion, verifies counts)
make corpus-seed

# 5. Verify the seeded corpus matches the lock manifest
make corpus-verify
```

### Reset

Reset tears down only the `default-corpus` runtime version's derived data (DB rows, Qdrant points, runtime paths) while preserving immutable source archive bytes and metadata. Reset is dry-run by default and requires explicit confirmation.

```bash
# Preview what reset will delete and preserve
make corpus-reset-dry-run

# Confirm destructive reset (re-type the version name for safety)
make corpus-reset-confirm
```

Reset refuses to operate on the currently active runtime version. Seed and reset never mutate the active version pointer. Activation is a separate, explicit step.

### Make target reference

| Target | Description |
|--------|-------------|
| `corpus-preflight` | Validate upstream lifecycle primitives exist |
| `corpus-lock` | Generate lock manifest from local archives |
| `corpus-seed-dry-run` | Preview seed plan without mutation |
| `corpus-seed` | Import archives, wait for ingestion, verify |
| `corpus-reset-dry-run` | Preview reset delete/preserve manifest |
| `corpus-reset-confirm` | Confirmed destructive runtime-only reset |
| `corpus-verify` | Verify seeded corpus matches lock manifest |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORPUS_VERSION` | `default-corpus` | Target runtime version name |
| `CORPUS_IDENTITY_MANIFEST` | `apps/api/corpus/default-dndbeyond-corpus.json` | Checked-in identity manifest |
| `CORPUS_MANIFEST` | `../.omo/corpus/default-dndbeyond-corpus.lock.json` | Generated lock manifest (not committed) |
| `ARCHIVE_ROOT` | `/data/uploads/sourcebooks` | Directory containing source ZIP archives |

### Troubleshooting

- **Missing archive**: Seed and verify fail before any mutation if an expected ZIP file is not found under `ARCHIVE_ROOT`. Place the correct file and retry.
- **Hash mismatch**: If an archive's SHA256 does not match the lock manifest, seed refuses to enqueue jobs. Regenerate the lock manifest with `make corpus-lock` after replacing the archive.
- **Active-version refusal**: Reset refuses to operate on the currently active runtime version. Deactivate or switch the active pointer first.
- **Count mismatch**: Verify fails if per-source or aggregate counts (uploads, jobs, sources, documents, sections, chunks, indexed chunks) differ from the lock manifest. This usually means ingestion did not complete or the lock manifest is stale.
- **Prerequisite failure**: `make corpus-preflight` fails if upstream multi-ZIP upload or runtime lifecycle primitives are missing. Complete the upstream plan first.

## Worktree lifecycle

Use the current worktree’s helper or runbook step to stop the matching compose stack. Do not shut down a different checkout by accident, and do not rely on a blanket repo-wide teardown when you are only trying to stop one worktree.

The full operating model is documented in `docs/worktree-operating-model.md`.

To stop the stack:

```bash
docker compose down
```

## Production environment contract

Use `.env.production.example` as the production-only template. Copy it to a local-only `.env.production`, fill in real secrets outside the repo, and keep production separate from the local dev compose defaults above. The production host port is `APP_HOST_PORT=8423`, the browser origin is `CORS_ORIGINS=https://thestacks.ikis.ai`, and secure cookies must stay enabled with `SESSION_COOKIE_SECURE=true`.

Production storage must be durable and isolated from dev data:

- Postgres must persist `/var/lib/postgresql/data`.
- Qdrant must persist `/qdrant/storage`.
- Uploads must persist `/data/uploads` and be shared by the API and worker containers.

The local compose file already demonstrates the storage shape with named volumes `webpage-semantic-chunking-metadata-postgres-data`, `webpage-semantic-chunking-metadata-qdrant-data`, and `webpage-semantic-chunking-metadata-uploads`; production compose/deploy files should define their own production volumes or host mounts rather than reusing local dev state.

If you need the broader bare-worktree operating rules, read `docs/worktree-operating-model.md`.
