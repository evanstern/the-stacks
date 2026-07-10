# Contract: Environment Variables

> **Superseded (2026-07-09)** by
> [specs/009-library-surface-env/contracts/environment.md](../../009-library-surface-env/contracts/environment.md),
> which adds the worktree environment protocol (deterministic per-worktree ports,
> compose identity, mint tooling, docker lifecycle rules). The variable tables below
> remain historically accurate for 007; consult the successor for current doctrine.

Source of truth: `v3/.env.example` (documented, safe local defaults, zero secrets —
FR-004, SC-006). Every published port and environment-specific value below is
overridable; startup fails fast naming any missing **required** variable (spec edge
case). v3 reads only its own `v3/.env`; v2's root `.env.example` is untouched (FR-005).

## Required (no default — operator must set)

| Variable | Consumer | Purpose |
|---|---|---|
| `OPERATOR_PASSWORD_HASH` | api | bcrypt hash of the operator password (D13). Generation command documented in `.env.example` comment |
| `SESSION_SECRET` | api | ≥32 chars; keys the sealed session cookie. Rotation invalidates all sessions |

## Stack identity & ports (defaults collide with nothing v2 publishes — research R3)

| Variable | Default | Purpose |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `the-stacks-v3` | container/network/volume namespace; per-worktree override is the doc-07 tooling hook |
| `V3_WEB_PORT` | `4400` | published SSR web port (the only published port in prod shape) |
| `V3_API_PORT` | `4401` | published in dev only |
| `V3_ML_PORT` | `4402` | published in dev only |
| `V3_POSTGRES_PORT` | `5442` | published in dev only (v2 uses 5433) |

All dev publishes bind `127.0.0.1`.

## Database

| Variable | Default | Purpose |
|---|---|---|
| `V3_POSTGRES_DB` | `stacks_v3` | |
| `V3_POSTGRES_USER` | `stacks_v3` | |
| `V3_POSTGRES_PASSWORD` | `stacks_v3` | safe local default; prod overrides |
| `DATABASE_URL` | `postgresql://stacks_v3:stacks_v3@postgres:5432/stacks_v3` | consumed by api + worker (in-network host/port) |

## Model role: embedding (D14, FR-013) — named, env-first

| Variable | Default | Purpose |
|---|---|---|
| `EMBEDDING_PROVIDER` | `local-sidecar` | provider kind |
| `EMBEDDING_ENDPOINT` | `http://ml:4402` | in-network sidecar URL |
| `EMBEDDING_MODEL_ID` | `sentence-transformers/all-MiniLM-L6-v2` | model identity — lives here, never in code |
| `EMBEDDING_DIMENSIONS` | `384` | stamped on every stored vector (FR-014) |
| `ML_EMBEDDING_MODEL` | `${EMBEDDING_MODEL_ID}` | the model the sidecar loads/serves |
| `EMBED_MAX_BATCH` | `64` | sidecar batch cap |
| `ML_REQUEST_TIMEOUT_MS` | `15000` | worker→sidecar call timeout |

The TS side resolves these once at boot into the `embedding` model-role config
(data-model.md); the sidecar pins its served model from `ML_EMBEDDING_MODEL`. Changing
the role is a config change whose effects are detectable, never silent (research R8).

## Auth & sessions

| Variable | Default | Purpose |
|---|---|---|
| `SESSION_COOKIE_SECURE` | `false` | `true` in prod shape |

## Worker & queue

| Variable | Default | Purpose |
|---|---|---|
| `WORKER_POLL_MS` | `2000` | queue poll interval |
| `WORKER_VISIBILITY_TIMEOUT_MS` | `60000` | reclaim window for stuck claims |
| `JOB_MAX_ATTEMPTS` | `3` | default retry budget |

## Web

| Variable | Default | Purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://api:4401` | server-side API base URL (research R9) |

## Prod-shape deltas (`docker-compose.prod.yml`, config shape only per spec assumptions)

- Only `V3_WEB_PORT` published; api/ml/postgres internal-only.
- `SESSION_COOKIE_SECURE=true`; real `V3_POSTGRES_PASSWORD`; pinned model config.
- Secrets supplied via the environment/secret store — never committed (constitution:
  Fixed Technical Decisions).
