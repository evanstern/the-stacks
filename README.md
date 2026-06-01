# The Stacks local runbook

The Dockerized web app is intentionally exposed on host port `5173`. Keep that port contract when running or hardening the stack.

## Start the stack

```bash
docker compose up --build
```

Compose starts Postgres, Qdrant, the FastAPI API, the ingestion worker, and the Vite frontend. The API and worker wait on healthy Postgres/Qdrant; the frontend waits on the API healthcheck.

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
```

`make test` runs the backend pytest suite, using local pytest when available and the API container otherwise. `make smoke` waits for `http://localhost:8000/health` and `http://localhost:5173`, logs in with the dev password, verifies unauthenticated access is rejected, queues a supported Markdown upload, checks unsupported files return `415`, creates an empty chat session, and confirms chat dependency failures are explicit when `OPENAI_API_KEY` is not configured. It also rechecks the frontend on `5173` before exiting.

To stop the stack:

```bash
docker compose down
```
