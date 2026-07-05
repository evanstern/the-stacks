# Research: v3 Walking Skeleton

**Branch**: `007-v3-skeleton` | **Date**: 2026-07-05

Resolves the plan-level unknowns from the spec's Assumptions section and the doc-08
open questions assigned to this spec. Decisions here are plan-level (reversible with a
plan amendment); anything that would reopen a D-number requires an ADR instead.

## R1 — Monorepo location: new `v3/` root beside v2

**Decision**: All of v3 lives under a single new `v3/` directory at the repo root:
pnpm workspace root, `apps/{web,api,worker,ml}`, `packages/{core,db,ingestion-contract}`,
and v3's own `docker-compose.yml`, `docker-compose.prod.yml`, and `.env.example`.
v2's root-level `apps/`, compose files, and `.env.example` are not touched.

**Rationale**: v2 already owns `apps/api`, `apps/web`, `apps/worker` and the root
compose files, so reusing root `apps/` names guarantees collision and confusion.
A `v3/` root gives: (a) zero-ambiguity coexistence (FR-005, D1) — nothing in v3 can
accidentally import or shadow v2; (b) a one-directory blast radius for the eventual
v2 retirement (archive/delete root `apps/` + compose, then optionally promote `v3/`
contents); (c) a self-contained pnpm workspace whose lockfile and node_modules never
tangle with v2's Python tooling.

**Alternatives considered**:
- *New names in root `apps/` (e.g., `apps/api-v3`)* — rejected: version suffixes leak
  into package names and imports permanently; retirement requires renames instead of a
  directory promotion; shared root compose files would need careful merging.
- *Separate repository* — rejected by D1 (settled): in-repo keeps specs, wiki,
  fixtures, and history adjacent.

## R2 — ORM/migrations: Drizzle ORM + drizzle-kit

**Decision**: Drizzle ORM with the `pg` (node-postgres) driver for the TS core;
drizzle-kit generates versioned SQL migration files committed under
`packages/db/migrations/`; migrations are applied programmatically with Drizzle's
migrator at startup (see R10). pgvector via Drizzle's built-in `vector` column type
and distance operators.

**Rationale**: pgvector support was the hard requirement, and Drizzle has it
first-class (native `vector` column type plus `cosineDistance`/`l2Distance` SQL
helpers) — no plugin or raw-SQL escape hatch needed for the core path. Beyond that:
schema is plain TypeScript in a shared package (`@stacks/db`) that api and worker both
import (FR-015); migrations are inspectable SQL files, satisfying "versioned migrations,
application recorded" (FR-016) via Drizzle's migrations journal table; no codegen build
step or runtime engine binary; SQL-adjacent query builder fits the `FOR UPDATE SKIP
LOCKED` queue (D12), which Drizzle expresses directly (`.for('update', { skipLocked:
true })`).

**Alternatives considered**:
- *Prisma* — rejected: pgvector needs the `Unsupported("vector")` type with raw-SQL
  workarounds; codegen client + query-engine adds moving parts; weakest fit for the
  locked-claim queue SQL.
- *Kysely* — solid query builder, but no schema definition layer or migration
  generator; we'd hand-write both schema types and SQL. Drizzle gives the same
  SQL-closeness plus schema-as-source-of-truth.
- *Raw SQL + node-pg-migrate* — maximally boring, but loses shared, typed schema
  definitions across api/worker, which FR-015 makes load-bearing.

## R3 — Coexistence: compose project name and port block

**Decision**: v3 compose sets `name: the-stacks-v3` (overridable via
`COMPOSE_PROJECT_NAME`); every published port is `${VAR:-default}` with defaults in a
block v2 doesn't use:

| Service | Env var | Default | v2 occupies |
|---|---|---|---|
| web (SSR) | `V3_WEB_PORT` | 4400 | 5174 |
| api | `V3_API_PORT` | 4401 | 8001 |
| ml sidecar | `V3_ML_PORT` | 4402 | — |
| postgres | `V3_POSTGRES_PORT` | 5442 | 5433 |

All dev-published ports bind `127.0.0.1`. Volumes take the compose project prefix
(`the-stacks-v3_*`), disjoint from v2's `rag-retrieval-api-operations-*` volumes. In
the prod compose variant only `V3_WEB_PORT` is published; api, ml, and postgres are
internal-only.

**Rationale**: v2's compose project is `rag-retrieval-api-operations` publishing 5433,
6334, 5050, 8001, 5174 — the 44xx/5442 block collides with none of them nor with
common dev defaults (3000, 5173, 5432, 8000). No literal host ports in compose
satisfies FR-004 and is the prerequisite doc-07's worktree port-block tooling needs.

**Alternatives considered**: keeping v2-adjacent numbers (8002, 5175…) — rejected:
adjacent numbers invite off-by-one confusion about which stack is which; a visually
distinct block makes `docker ps` legible.

## R4 — ML sidecar contract: FastAPI, env-pinned model, explicit readiness

**Decision**: Python 3.12 + FastAPI + uvicorn + sentence-transformers. Contract (full
detail in [contracts/ml-sidecar.md](./contracts/ml-sidecar.md)):

- `GET /health` — liveness, 200 as soon as the process serves HTTP.
- `GET /ready` — 200 only after the configured model is downloaded and loaded into
  memory (warm-up happens in startup lifespan); 503 with `{"status":"loading"}` before.
- `POST /v1/embed` — `{"model": str, "inputs": [str, ...]}` →
  `{"model", "dimensions", "embeddings": [[float]], "duration_ms"}`. Synchronous,
  batch-in/batch-out, `EMBED_MAX_BATCH` (default 64) inputs per call; requesting a
  model other than the loaded one → 404 typed error (guards vector-space mixing at the
  seam).

The model identity comes from env (`ML_EMBEDDING_MODEL`), never code; the HF cache is a
named volume so first start downloads once and warm starts satisfy SC-001's < 3 min.
No DB access, no state (D2).

**Rationale**: doc 03 fixes "FastAPI or equivalent" and inference-only; the open
questions were endpoints, batching, warm-up, and health/readiness — answered above.
Explicit `/ready` vs `/health` split lets compose `depends_on: service_healthy` gate
the worker while still distinguishing *starting* from *failed* (FR-003). Batch-list
input is the shape ingestion will need later, so the skeleton pins it now.

**Alternatives considered**: async job-style embed API — rejected: queueing already
lives in the TS core (D12); the sidecar staying synchronous keeps it boring and
stateless. Model named per-request with lazy multi-model loading — rejected for the
skeleton: one env-pinned model is enough, and lazy loads make readiness dishonest.

## R5 — Auth: bcrypt-verified login, stateless sealed session cookie

**Decision**: Operator credential = `OPERATOR_PASSWORD_HASH` (bcrypt) in env; login
compares with `bcrypt.compare`. Session = `@fastify/secure-session` sealed (encrypted,
tamper-proof) HTTP-only cookie, key derived from `SESSION_SECRET`, `SameSite=Lax`,
`Secure` controlled by `SESSION_COOKIE_SECURE` (default false locally), maxAge 30 days.
No session table. Failed login → 401 with a fixed non-revealing message. Health/ready
endpoints are the only unauthenticated surfaces (FR-007).

**Rationale**: D13 says "signed HTTP-only cookie sessions"; a sealed stateless cookie
is the most boring implementation that satisfies "persistent session bound to the
browser" for exactly one operator — nothing to store, nothing to migrate, tampering
fails decryption and reads as no-session. bcrypt matches v2 precedent
(`ADMIN_PASSWORD_HASH`), so the operator's existing hash tooling carries over.

**Alternatives considered**: DB-backed sessions — rejected: adds a table and cleanup
for zero benefit at single-operator scale (revocation = rotate `SESSION_SECRET`).
argon2id — fine algorithm, but bcrypt keeps parity with v2 operator habits and has no
native-build friction in Alpine images.

## R6 — Queue: `jobs` table with `FOR UPDATE SKIP LOCKED` claims

**Decision**: One `jobs` table (schema in [data-model.md](./data-model.md)); worker
polls every `WORKER_POLL_MS` (default 2000): claim = `UPDATE ... WHERE id IN (SELECT
... WHERE status='queued' AND run_at <= now() ORDER BY created_at FOR UPDATE SKIP
LOCKED LIMIT 1)` setting `status='claimed'`, `claimed_by`, `claimed_at`. Retry policy:
`attempts`/`max_attempts` (default 3) with exponential backoff via `run_at`; a
dependency-down failure requeues (until attempts exhaust), an internal fault fails the
job. A claimed job whose `claimed_at` exceeds a visibility timeout (default 60 s) is
reclaimable — this is what makes "restart mid-check" recover instead of vanish
(edge case in spec).

**Rationale**: D12 verbatim — v2 proved the pattern; SKIP LOCKED gives safe concurrent
claims with zero broker. Typed failure classes map directly onto FR-011's
dependency-down-vs-internal-fault distinction and the retry-succeeds requirement.

**Alternatives considered**: LISTEN/NOTIFY to cut poll latency — deferred: polling at
2 s is well inside SC-002's 60 s budget; NOTIFY adds connection-lifecycle complexity
the skeleton doesn't need (can be layered on later without schema change).

## R7 — Testing stack: Vitest everywhere in TS, one `pnpm verify`

**Decision**: Vitest as the single TS test runner — unit/integration in
`packages/core`, `packages/db`, `apps/worker`; contract tests in `apps/api` using
`fastify.inject()` (no network) with one test per error class (FR-018); web tests with
Vitest + Testing Library (jsdom) for routes/components. Type checks are `tsc --noEmit`
per package. Root command: `pnpm verify` = `pnpm -r run typecheck && pnpm -r run test`
(FR-017). Sidecar gets pytest + pyright, run in its container/CI — deliberately outside
`pnpm verify`, which FR-017 scopes to core + web + type checks. DB-integration tests
that need Postgres run against the compose Postgres (or Testcontainers) and are tagged
so `pnpm verify` stays runnable on a fresh checkout with Docker available.

**Rationale**: One runner across every TS package keeps the "real suites from the
start" posture (doc 07) cheap; `fastify.inject` makes contract tests fast and
deterministic; Vitest is the native pairing for both Fastify+TS and RR7/Vite.

**Alternatives considered**: Jest — rejected: second-class ESM/TS story vs Vitest in a
Vite-based monorepo. Playwright e2e — out of scope for the skeleton; quickstart.md's
manual scenarios plus the smoke tradition cover end-to-end until a later spec adds it.

## R8 — Vector storage: untyped `vector` column + per-row identity stamp

**Decision**: `skeleton_vectors.embedding` uses pgvector's un-dimensioned `vector`
type; every row also stores `embedding_provider`, `embedding_model`,
`embedding_dimensions` (FR-014). Similarity read-back filters on the current
configuration's model identity before ordering by cosine distance. No vector index
(exact scan) for the skeleton.

**Rationale**: Dimension is a property of the *configured model* (env, changeable —
D14), so baking it into DDL would turn a config change into a migration and make the
"embedding role changes between runs" edge case a startup failure instead of a
detectable data condition. Per-row stamping makes vector-space mixing structurally
detectable exactly as Principle VII demands. At skeleton scale (a handful of rows) an
exact scan is correct and index choice (HNSW/IVFFlat) belongs to the retrieval spec's
eval program.

**Alternatives considered**: `vector(1536)`-style fixed dimension — rejected as above;
also would hardcode a model-shaped constant into a migration file, brushing against
SC-006's spirit.

## R9 — Web→API boundary: server-side fetch with cookie relay

**Decision**: The browser talks only to `web`. RR7 loaders/actions call the API over
the compose network (`API_INTERNAL_URL`, default `http://api:4401`) via a small
server-only client (`app/lib/api.server.ts`) that relays the session cookie from the
incoming request to the API and relays `Set-Cookie` back on login/logout. The API is
the sole authority for session validation; `web` treats the cookie as opaque. Dev
compose still publishes the API port for operator inspection; prod does not.

**Rationale**: FR-019 requires the web layer to consume capabilities only through the
API contract, and the prod shape (one published port) means the browser can't reach
the API anyway — so the cookie must ride the web origin and be validated
server-to-server. Cookie relay keeps auth authority in exactly one place and needs no
shared secrets in `web`.

**Alternatives considered**: browser→API direct calls with CORS (v2's shape) —
rejected: breaks the one-published-port prod contract and spreads auth across origins.
Duplicating session unsealing in `web` — rejected: two services holding
`SESSION_SECRET` for no functional gain.

## R10 — Migration runner: API startup, before listen

**Decision**: The API applies pending migrations (Drizzle migrator over
`packages/db/migrations/`) during boot, before binding its port; `/ready` therefore
implies schema-current. Worker and web `depends_on` the API's healthcheck, so the
whole stack serializes behind migration success. Migration 0001 includes
`CREATE EXTENSION IF NOT EXISTS vector`. Applications are recorded in Drizzle's
migrations journal table (FR-016 "application is recorded").

**Rationale**: FR-002 puts schema preparation inside the startup lifecycle. At
single-operator scale there is exactly one API instance, so in-process migration has
no concurrency hazard and avoids a fifth one-shot compose service. Failure mode is
honest: migration error → API never ready → compose reports failed, satisfying
FR-003's starting/ready/failed distinction.

**Alternatives considered**: dedicated one-shot `migrate` compose service — the
standard multi-instance answer, but adds a service and an ordering edge for zero
benefit here; can be introduced later without schema or code changes if v3 ever runs
replicated. Worker also running migrations — rejected: two writers race.
