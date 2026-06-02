# The Stacks local runbook

The Dockerized web app is intentionally exposed on host port `5173`. Keep that port contract when running or hardening the stack.

## Start the stack

```bash
docker compose up --build
```

Compose starts Postgres, Qdrant, the FastAPI API, the ingestion worker, and the Vite frontend. The API and worker wait on healthy Postgres/Qdrant; the frontend waits on the API healthcheck.

The compose stack now uses the same stack-specific env-file pattern as the promoted webpage runtime: `.env.example` plus `.env.webpage-5174`. That keeps the local app on `5173` while preserving the promoted storage layout and runtime defaults.

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
