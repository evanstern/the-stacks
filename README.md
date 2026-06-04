# The Stacks

The Stacks is a TTRPG session harness. It is a local and deployable web app for running sessions with authenticated chat, uploads, retrieval-backed answers, ingestion and job visibility, and records views around material the operator supplies.

## What this project is

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

This starts Postgres, Qdrant, the FastAPI API, the ingestion worker, and the Vite frontend. Use `.env.example` for local runs and `.env.production.example` for production-only values. Keep the app on host port `5173`.

Smoke runs use the compose-provided dev password and a local-only session secret. Override `SMOKE_ADMIN_PASSWORD_HASH`, `SMOKE_SESSION_SECRET`, and `OPENAI_API_KEY` when you need non-smoke credentials.

## Monitor local data

Use the local services directly when you need to inspect data, or start the admin profile for the GUI tools:

- Postgres: `localhost:5432`, database `thestacks`, user `thestacks`, password `thestacks`
- Qdrant dashboard/API: `http://localhost:6333/dashboard`

Admin UI:

```bash
docker compose --profile admin up --build
```

Open `http://localhost:5050` with `admin@thestacks.local` / `admin-password`. For terminal access, use:

```bash
psql postgresql://thestacks:thestacks@localhost:5432/thestacks
```

## Verify locally

```bash
make test
make smoke
make smoke-public
```

Use `make test` for the backend suite, `make smoke` for the local end to end stack, and `make smoke-public` for the public deployment contract in `scripts/smoke-public.sh`.

## Upload batches and runtime versions

- `POST /uploads` accepts repeated multipart `file` fields. Single-file uploads keep the legacy response shape, while multi-file ZIP batches return `batch_id`, `items`, `queued`, and `upload_status_url`.
- Use `/upload?batch_id=<batch_id>` plus `GET /uploads/batches/{batch_id}` to resume or inspect a batch.
- Batch status rows stay file-scoped and public-safe. They show `filename`, `category`, and `message`, and they do not expose tracebacks or raw filesystem paths.
- Runtime versions are named by internal version IDs, not user labels. Each version gets its own database name and URL, Qdrant collection, and upload, static, and runtime prefixes.
- Activation only accepts `ready` versions and refuses teardown-locked ones. Teardown stays dry-run first, requires confirmation, and records lifecycle events for audit.

## Optional user-supplied corpus import

The optional corpus workflow can load the 5e core trio, Player's Handbook, Dungeon Master's Guide, and Monster Manual, into an isolated `default-corpus` runtime version. Any DnDBeyond archives or 5e book exports are local external inputs supplied by the operator. The repository does not provide them, and the tool must not download or commit them.

### Archive setup

Place saved DnDBeyond HTML ZIP archives in your archive root directory, `/data/uploads/sourcebooks` by default. When you supply those files locally, the identity manifest expects these filenames:

- `phb-2014.zip` — Player's Handbook
- `dmg-2014.zip` — Dungeon Master's Guide
- `mm-2014.zip` — Monster Manual

These files must be DnDBeyond saved-HTML exports that you already lawfully possess. Do not rename archives from other sources to match these filenames, and do not treat the repository as a source for the archives.

### How to run it

From `main/`, use `make corpus-preflight`, `make corpus-lock ARCHIVE_ROOT=/data/uploads/sourcebooks`, `make corpus-seed-dry-run`, `make corpus-seed`, and `make corpus-verify`. The first two establish the lock manifest, the middle steps import the corpus, and the last step checks the seeded result.

### Reset

Use `make corpus-reset-dry-run` to preview removal and `make corpus-reset-confirm` for the confirmed runtime-only reset. Reset preserves immutable source archive bytes and refuses to operate on the currently active runtime version.

### Environment variables

`CORPUS_VERSION` defaults to `default-corpus`, `CORPUS_IDENTITY_MANIFEST` points to `apps/api/corpus/default-dndbeyond-corpus.json`, `CORPUS_MANIFEST` is generated under `../.omo/corpus/default-dndbeyond-corpus.lock.json`, and `ARCHIVE_ROOT` defaults to `/data/uploads/sourcebooks`.

### Troubleshooting

- Missing archive, seed and verify stop before mutation if a ZIP is missing under `ARCHIVE_ROOT`.
- Hash mismatch, regenerate the lock manifest with `make corpus-lock` after replacing the archive.
- Active-version refusal, reset refuses the currently active runtime version.
- Count mismatch, verify fails when counts diverge from the lock manifest, usually because ingestion did not finish or the lock is stale.
- Prerequisite failure, `make corpus-preflight` surfaces missing upstream primitives.

## Worktree lifecycle

Use the current worktree’s helper or runbook step to stop the matching compose stack. The broader operating model lives in `docs/worktree-operating-model.md`.

To stop the stack:

```bash
docker compose down
```

## Production environment contract

Use `.env.production.example` as the production-only template. Copy it to a local-only `.env.production`, keep production separate from the local dev compose defaults above, and fill in secrets outside the repo. The production host port is `APP_HOST_PORT=8423`, the browser origin is `CORS_ORIGINS=https://thestacks.ikis.ai`, and secure cookies must stay enabled with `SESSION_COOKIE_SECURE=true`.

Production storage must be durable and isolated from dev data:

- Postgres must persist `/var/lib/postgresql/data`.
- Qdrant must persist `/qdrant/storage`.
- Uploads must persist `/data/uploads` and be shared by the API and worker containers.

The local compose file already demonstrates the storage shape with named volumes `webpage-semantic-chunking-metadata-postgres-data`, `webpage-semantic-chunking-metadata-qdrant-data`, and `webpage-semantic-chunking-metadata-uploads`; production compose/deploy files should define their own production volumes or host mounts rather than reusing local dev state.

If you need the broader bare-worktree operating rules, read `docs/worktree-operating-model.md`.
