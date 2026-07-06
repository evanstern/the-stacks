# Implementation Plan: v3 Walking Skeleton

**Branch**: `007-v3-skeleton` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-v3-skeleton/spec.md`

## Summary

Stand up the entire v3 greenfield foundation as one thin, provable slice: a pnpm
monorepo under a new `v3/` root (apps: `web`, `api`, `worker`, `ml`; shared packages:
domain types, Drizzle DB schema + migrations, ingestion plugin contract placeholder), a
five-service Docker compose stack (Postgres + pgvector, Fastify API, RR7 SSR web, TS
worker, Python inference sidecar) that starts with one command and coexists with the
running v2 stack, single-operator cookie auth, and an operator-triggerable
**skeleton check** that crosses every seam asynchronously — UI → API → Postgres-table
job queue → worker → ML sidecar embed → pgvector write + similarity read-back → status
view — leaving an append-only event trail per seam and failing legibly (typed
dependency-down outcomes) when a seam is unavailable.

Technical approach: Drizzle ORM + drizzle-kit SQL migrations applied inside the API
startup lifecycle; `FOR UPDATE SKIP LOCKED` job claims (D12); stateless sealed session
cookie relayed by the web layer's server-side fetches so the browser only ever talks to
`web` (FR-019); env-first model-role configuration with embedding identity stamped on
every stored vector (D14); deterministic vector IDs for idempotent re-runs; Vitest
suites + contract tests + type checks behind one `pnpm verify` command.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node.js 22 LTS for web/api/worker and
shared packages; Python 3.12 for the ML sidecar (the only Python in v3, D2)

**Primary Dependencies**: Fastify 5 (API, D3); React Router 7 framework mode SSR +
Tailwind + shadcn/ui (web, D6); Drizzle ORM + drizzle-kit (DB schema/migrations,
pgvector-capable — research decision R2); `postgres`/`pg` driver; `@fastify/secure-session`
+ `bcrypt` (single-operator auth, D13); FastAPI + uvicorn + sentence-transformers (ml
sidecar); pnpm 10 workspaces

**Storage**: PostgreSQL 17 + pgvector (one store for relational data, vectors, queue,
events — D5, D12); named Docker volumes scoped by v3 compose project name; HF model
cache volume for the sidecar

**Testing**: Vitest for core/api/worker unit + integration tests and API contract tests
(via `fastify.inject`); Vitest + Testing Library for the web app; `tsc --noEmit` per
package; pytest + pyright for the sidecar (runs in CI/container, not required by the
single TS verify command); one root `pnpm verify` command (FR-017)

**Target Platform**: Docker compose on the operator's machine (macOS/Linux); prod
compose variant with internal-only DB and a single published web port (config shape
only, per spec assumptions)

**Project Type**: Web application — multi-service monorepo (SSR web + API + worker +
inference sidecar + Postgres)

**Performance Goals**: First start ready < 15 min including one-time model provisioning;
warm start < 3 min (SC-001); skeleton check end-to-end < 60 s (SC-002);
dependency-down failure surfaced < 30 s (SC-003); full verification < 10 min (SC-005)

**Constraints**: Zero collisions with the running v2 stack (distinct compose project
name, port block, volumes — FR-005/SC-004); every published port and env-specific value
env-overridable with safe local defaults, zero secrets and zero hardcoded model IDs in
the repo (FR-004/FR-013/SC-006); no v2 code imported or modified (D1); all provisioning
inside the compose lifecycle (FR-002)

**Scale/Scope**: Single operator, one machine; 4 buildable services + Postgres; 3 shared
packages; one end-to-end slice (no ingestion/retrieval/chat — those are the next specs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principle / Rule | Assessment |
|---|---|---|
| ✅ PASS | I. Lawful Operator-Supplied Content Only | The skeleton check embeds a small fixed synthetic text shipped as a repo fixture; no game content is downloaded, bundled, or implied. |
| ✅ PASS | II. Hallucination Is Contained by Architecture | Not exercised — no chat modes in this slice. Nothing here blurs the Quick Ask/Conversations contracts; the model-role config machinery (D14) this spec introduces is what later specs' containment builds on. |
| ✅ PASS | III. Citations Are Receipts | Not exercised — no retrieval/citations. The plugin contract package ships as an explicit placeholder (FR-015) so ingesters later plug in without touching pipeline core. |
| ✅ PASS | IV. Slow Work Is Asynchronous and Destructive Work Is Guarded | The skeleton check is accepted-then-async off the Postgres queue (FR-009); append-only event trail per seam (FR-010); errors typed by cause and mapped at the API boundary (FR-011, FR-018); deterministic vector IDs make re-runs idempotent (FR-012). No destructive operations in scope. |
| ✅ PASS | V. Operator Control and Observability | Single-operator auth only (D13, FR-006/007) — no partial multi-user surface. Check runs are inspectable via a minimal status view (URL-addressable run detail); full Records rebuild deferred by explicit spec assumption. |
| ✅ PASS | VI. Boring, Bounded Infrastructure | Queue is a Postgres table with locked claims (D12); vectors in pgvector (D5); config is env vars with safe local defaults; one compose command (FR-001). Package boundaries enforce the TS-core/inference-only-sidecar line (D2) and web-consumes-API-only (FR-019). |
| ✅ PASS | VII. Configuration Over Hardcoding | Embedding role is a named env-first configuration (FR-013); provider/model/dimensions stamped on every stored vector (FR-014); no model identifiers in product code — defaults live in `.env.example`. |
| ✅ PASS | Fixed Technical Decisions D1–D14 | Stack choices are exactly D1–D6, D12, D13, D14 as fixed; no decision reopened, no ADR required. Plan-level choices below (layout, ORM, ports, sidecar contract) are the doc-08 open questions explicitly assigned to this spec. |
| ✅ PASS | Development Workflow | TDD posture: contract tests pin error mapping before/with implementation; real suites from the start. Bare-worktree model untouched (v3 lives inside the feature worktree as a new `v3/` root). Wiki impact: a v3 architecture-notes page is owed once the skeleton lands — recorded as a task-phase obligation. |

**Post-Phase-1 re-check**: PASS — design artifacts (data model, contracts, quickstart)
introduce no new violations; the sealed-cookie auth, queue schema, and sidecar contract
all stay within the gates above. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-v3-skeleton/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── api.md           # HTTP API contract incl. error-mapping convention
│   ├── ml-sidecar.md    # Inference sidecar HTTP contract
│   └── environment.md   # Environment-variable contract (ports, roles, secrets)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

v3 lives entirely under a new `v3/` root (research decision R1): v2's `apps/`,
`docker-compose.yml`, and `.env.example` at the repo root remain untouched (D1, FR-005),
and v2 retirement later becomes "delete `v3/`'s siblings and promote".

```text
v3/
├── package.json                 # workspace root: verify/dev scripts
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── .env.example                 # documented env contract, safe local defaults
├── docker-compose.yml           # dev stack: postgres, api, worker, web, ml
├── docker-compose.prod.yml      # prod shape: internal-only DB, one published port
├── apps/
│   ├── api/                     # Fastify 5
│   │   ├── src/
│   │   │   ├── app.ts           # fastify instance, plugins, error mapper
│   │   │   ├── auth/            # login/logout/session, sealed cookie
│   │   │   ├── skeleton-checks/ # accept + status routes
│   │   │   ├── health.ts        # /health, /ready (no auth)
│   │   │   └── migrate.ts       # startup migration runner
│   │   ├── test/                # unit + contract tests (error mapping FR-018)
│   │   └── Dockerfile
│   ├── worker/                  # TS queue consumer
│   │   ├── src/
│   │   │   ├── main.ts          # polling loop, claim via SKIP LOCKED
│   │   │   └── handlers/skeleton-check.ts  # crosses ml + pgvector seams
│   │   ├── test/
│   │   └── Dockerfile
│   ├── web/                     # React Router 7 framework mode (SSR)
│   │   ├── app/
│   │   │   ├── routes/          # login, home, skeleton-check detail
│   │   │   └── lib/api.server.ts # server-side API client, cookie relay
│   │   ├── test/
│   │   └── Dockerfile
│   └── ml/                      # Python inference sidecar (FastAPI)
│       ├── src/ml/
│       │   ├── main.py          # /health, /ready, /v1/embed
│       │   └── models.py        # env-driven model load + warm-up
│       ├── tests/
│       ├── pyproject.toml
│       └── Dockerfile
└── packages/
    ├── core/                    # @stacks/core — domain types, typed errors,
    │   ├── src/                 #   model-role config resolution (env-first)
    │   └── test/
    ├── db/                      # @stacks/db — Drizzle schema, client factory,
    │   ├── src/schema/          #   queue helpers
    │   ├── migrations/          # versioned SQL (drizzle-kit generate)
    │   └── test/
    └── ingestion-contract/      # @stacks/ingestion-contract — placeholder shape
        └── src/                 #   (full schema owned by the ingestion spec)
```

**Structure Decision**: Multi-service pnpm monorepo under `v3/` — apps consume shared
packages (`@stacks/core`, `@stacks/db`, `@stacks/ingestion-contract`); `web` has no
dependency on `@stacks/db` and reaches the system only through the API contract
(FR-019); `ml` shares nothing with the TS workspace (HTTP contract only, D2).

## Complexity Tracking

No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0: Research

All NEEDS CLARIFICATION items and the doc-08 open questions assigned to this spec are
resolved in [research.md](./research.md): R1 `v3/` root layout, R2 Drizzle ORM +
drizzle-kit, R3 port block & compose project naming vs v2, R4 ML sidecar HTTP contract,
R5 sealed-cookie auth mechanics, R6 queue design, R7 testing stack, R8 untyped
`vector` column strategy, R9 web→API cookie-relay pattern, R10 migration runner
placement.

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) — entities, tables, state machines, validation rules
- [contracts/api.md](./contracts/api.md) — HTTP API incl. error-mapping convention (FR-018)
- [contracts/ml-sidecar.md](./contracts/ml-sidecar.md) — embed/health/ready contract, batching, warm-up
- [contracts/environment.md](./contracts/environment.md) — full env-var contract (FR-004, FR-013)
- [quickstart.md](./quickstart.md) — runnable validation for every acceptance scenario
