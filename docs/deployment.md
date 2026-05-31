# Ikis self-host deployment

Ikis runs as a single React Router production server backed by SQLite and a filesystem upload directory. The self-host path is intentionally single-user: one owner password unlocks the workspace, and no account or role model is created.

## Required environment

- `IKIS_SHARED_PASSWORD`: shared owner password for the login form.
- `IKIS_AUTH_SECRET`: HMAC secret for signed auth cookies. Generate with `openssl rand -hex 32`.

Optional environment:

- `APP_HOST_PORT`, default `8423`, maps the host port to container port `3000`.
- `PUBLIC_URL`, default `http://localhost:8423`. In production HTTPS deployments, set this to the public `https://` origin so cookies include `Secure`. Explicit local HTTP URLs are allowed for port-mapped local hosting.
- `MAX_UPLOAD_MB`, default `25`, controls the upload validator.
- `THE_STACKS_DB_PATH`, defaults to the compose value `/app/data/the-stacks.sqlite` in containers or `./data/the-stacks.sqlite` locally.
- `IKIS_UPLOAD_DIR`, defaults to the compose value `/app/data/uploads` in containers or `./data/uploads` locally.
- `REDIS_URL`, defaults to `redis://127.0.0.1:6379/0` locally and `redis://redis:6379/0` in compose, provides the OCR worker queue transport.
- `IKIS_OCR_QUEUE_NAME`, default `ikis:ocr:jobs`, names the Redis list used for OCR jobs.
- `IKIS_OCR_WORKER_MAX_ATTEMPTS`, default `3`, bounds worker-level retries before a queue payload is treated as terminally failed.
- `LANGGRAPH_ENABLED=false`, optional for local deterministic review suggestions through the fake workflow provider.

If either `IKIS_SHARED_PASSWORD` or `IKIS_AUTH_SECRET` is missing, startup fails with an actionable error before protected routes can run.

## Docker compose

Create a `.env` file next to `docker-compose.yml`:

```bash
IKIS_SHARED_PASSWORD=change-this-password
IKIS_AUTH_SECRET=<output of openssl rand -hex 32>
PUBLIC_URL=http://localhost:8423
APP_HOST_PORT=8423
```

Start Ikis:

```bash
docker compose up -d --build
```

The compose stack starts the app, Redis, and an `ocr-worker` process. It mounts
`./data:/app/data`, so both the SQLite database at `/app/data/the-stacks.sqlite`
and uploaded source files under `/app/data/uploads` persist across container
restarts. OCR job rows stay authoritative in SQLite; Redis only transports
`pdf-ocr` job IDs from the `ocr_queued` state to the worker.

## Local development

For a local dev server, create `.env` or export the required variables, then run:

```bash
pnpm install
pnpm dev --host 127.0.0.1
```

The browser will redirect unauthenticated requests to `/login`. After sign-in,
the workspace home accepts `.json`, `.md`, `.txt`, `.epub`, and `.mobi` uploads.
Uploads are hashed, written under `IKIS_UPLOAD_DIR`, normalized into documents,
and shown in the import status cards with source and import-job detail links.

## Review and chat operations

Open `/review` after importing. The queue shows advisory LLM or fake LangGraph
suggestions separately from the final human decision. Approving a document indexes
its chunks for the lexical SQLite FTS retrieval baseline; rejecting or deferring
keeps it out of chat evidence.

Open `/chat` after approval. Ikis answers from approved indexed chunks only,
stores the conversation, persists retrieval traces, and links every citation to a
source preview. Unsupported questions return an explicit insufficient-evidence
answer without fabricated citations.

## Verification commands

Run the full local gate before treating a deployment or task slice as ready:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

`pnpm e2e` uses isolated `THE_STACKS_DB_PATH` and `IKIS_UPLOAD_DIR` values so it
does not mutate the operator's normal SQLite database or uploaded source files.

## Authentication and cookie security

All app routes are password-gated except `/login`. Browser page requests without a valid cookie redirect to `/login?next=...`; unauthenticated form/API actions return `401 unauthorized`.

Successful login sets an HMAC-signed `ikis_auth` cookie with:

- `HttpOnly`
- `SameSite=Strict`
- `Path=/`
- `Max-Age=2592000`
- `Secure` in production unless `PUBLIC_URL` explicitly starts with `http://` for local port-mapped hosting

Rotating `IKIS_AUTH_SECRET` invalidates existing cookies.
