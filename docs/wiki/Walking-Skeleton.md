---
title: Walking Skeleton
status: active
owner: docs
created: 2026-07-05
updated: 2026-07-06
tags:
  - wiki
  - v3
  - architecture
---

# Walking Skeleton

The greenfield rebuild's foundation slice: a pnpm + Docker Compose monorepo that
starts with one command, authenticates a single operator, and proves a
request can cross every architectural seam — UI → API → Postgres job queue →
worker → ML inference sidecar → pgvector write + similarity read-back → status
view — leaving an inspectable, append-only event trail. Full detail lives in
`specs/007-v3-skeleton/` (plan, research, data-model, contracts, quickstart); this
page is the durable summary of what settled there.

## Location & the v2 retirement

The skeleton was built under a `v3/` directory beside the then-running v2 stack
(constitution D1), with mechanically enforced isolation. On **2026-07-06** v2 was
retired ([ADR 0001](../adr/0001-retire-v2-before-parity.md)) and v3 was promoted to
the **repository root** — the layout below is now the repo's layout. The distinct
port block and the `the-stacks-v3` compose project name were retained (deployed
volumes/containers depend on them, and they stay useful for parallel worktrees):

| Service | Port | notes |
|---|---|---|
| web (SSR) | 4400 | only published port in prod shape |
| api | 4401 | dev-published only |
| ml sidecar | 4402 | dev-published only |
| postgres | 5442 | dev-published only |

`scripts/check-boundaries.mjs` (wired into `pnpm verify`) still enforces the
architecture boundaries: web never imports `@stacks/db`, no relative imports escape
the source roots, no hardcoded model ids in product code.

## Monorepo layout

```text
(repo root)
├── apps/{api,worker,web,ml}
└── packages/{core,db,ingestion-contract}
```

- `apps/api` — Fastify 5. Auth, health/ready, skeleton-check routes, the
  DomainError→HTTP error mapper.
- `apps/worker` — TS queue consumer. Polls `jobs`, dispatches to a handler
  registry keyed by job `kind`.
- `apps/web` — React Router 7 framework-mode SSR + Tailwind + shadcn/ui. The
  browser only ever talks to `web`; server-side loaders/actions relay the
  session cookie to `api` (`app/lib/api.server.ts`).
- `apps/ml` — Python 3.12 + FastAPI sidecar, inference-only, no DB access. The
  only Python in v3.
- `packages/core` — typed domain errors, env-first model-role config,
  skeleton-check domain (deterministic vector id, seam constants).
- `packages/db` — Drizzle schema + migrations, DB client factory, queue
  helpers, the append-only event-insert helper.
- `packages/ingestion-contract` — placeholder shape; the full contract is
  owned by the ingestion spec that follows this one.

## Compose topology

Five services (`postgres`, `api`, `ml`, `worker`, `web`) with a `depends_on
service_healthy` chain: `api`→`postgres`; `worker`→`api`+`ml`; `web`→`api`. The
API applies pending migrations during boot, before binding its port, so
`/ready` implies schema-current — the whole stack effectively serializes behind
migration success. `docker-compose.prod.yml` overrides publish only the web
port and flip `SESSION_COOKIE_SECURE=true`.

## Queue, event, and vector doctrine

- **Queue**: one generic `jobs` Postgres table (D12). Claim is `FOR UPDATE SKIP
  LOCKED`; retry is `attempts`/`max_attempts` with backoff via `run_at`; a
  claim whose `claimed_at` exceeds `WORKER_VISIBILITY_TIMEOUT_MS` is
  reclaimable (recovers a worker restart mid-check).
- **Events**: `skeleton_check_events` is append-only by construction — the only
  write path is `@stacks/db`'s `recordEvent` insert helper, no UPDATE/DELETE in
  code. A successful run shows exactly six events (`queued`, `claimed`,
  `inference`, `vector_write`, `vector_readback`, `completed`); a failed run
  shows the trail up to the failing seam with `ok:false`.
- **Vectors**: `skeleton_vectors.embedding` is pgvector's un-dimensioned
  `vector` type (dimension is a property of the *configured* model, not the
  schema) plus a per-row `embedding_provider`/`embedding_model`/
  `embedding_dimensions` stamp. The row id is deterministic —
  `sha256(input_text + provider/model/dimensions)` — so identical input+config
  reuses the same row (`INSERT ... ON CONFLICT DO NOTHING`), making re-runs
  idempotent by construction rather than by dedup logic.
- **Errors**: every DomainError carries a `class` (`unknown_thing` /
  `unsupported_type` / `dependency_down` / `internal_fault`) and an optional
  `seam`; the API boundary maps class→HTTP code, and the worker stamps the
  same class onto `jobs.last_error` / `skeleton_check_runs.outcome`. A
  dependency-down failure (sidecar unreachable/timeout/503) and an
  internal-fault failure (our bug — e.g. a dimension mismatch) are
  distinguishable in the trail, not just in logs.

## Auth

Single-operator, stateless sealed session cookie (`@fastify/secure-session`,
keyed from `SESSION_SECRET`; credential is `OPERATOR_PASSWORD_HASH`, bcrypt —
D13). No session table; revocation is rotating `SESSION_SECRET`. A global
`onRequest` hook guards every route except `/health`, `/ready`,
`POST /api/auth/login`, and `POST /api/auth/logout` — including routes that
don't exist yet, so an unmapped path still 401s rather than 404s for an
unauthenticated caller.

## ML sidecar contract

`GET /health` (liveness, as soon as HTTP is served) / `GET /ready` (200 once
the pinned `ML_EMBEDDING_MODEL` is loaded; 503 `loading` or `failed` before
that) / `POST /v1/embed` (batch-in/batch-out; wrong `model` → 404, empty or
non-string inputs → 415, not-ready → 503). Model loading runs as a background
task at startup so `/health` stays reachable while a large model downloads
into the `hf-cache` named volume — first start pays the download once, warm
starts load from cache.

## Testing posture

One TS runner (Vitest) across every package; `fastify.inject()` contract tests
pin the four error classes with zero network. `pnpm verify` = boundary check +
`tsc --noEmit` + tests across all TS packages, deliberately excluding the
Python sidecar (its own `pytest`/`pyright` run separately, since FR-017 scopes
`pnpm verify` to the TS side). DB-integration tests (queue semantics, the
worker handler, migration lifecycle) are tagged behind
`RUN_DB_INTEGRATION_TESTS` so `pnpm verify` stays runnable without Docker on a
fresh checkout, while still being real integration tests against Postgres when
that flag is set.

## What's next

This slice deliberately has no ingestion, retrieval, or chat — those are the
next specs, building on `packages/ingestion-contract`'s placeholder and the
model-role config machinery this spec introduced.
