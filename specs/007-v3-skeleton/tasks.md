# Tasks: v3 Walking Skeleton

**Input**: Design documents from `/specs/007-v3-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the constitution mandates TDD ("write or update the failing test
first"), and FR-018 explicitly requires contract tests. Test tasks precede their
implementation tasks within every phase.

**Organization**: Grouped by user story from spec.md — US1 one-command startup &
sign-in (P1), US2 end-to-end seam verification (P2), US3 developer foundation (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1/US2/US3 — user story phases only
- All paths are repo-relative; all v3 code lives under `v3/` (research R1)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The pnpm monorepo scaffold every subsequent task lands in (plan.md
Project Structure)

- [X] T001 Create v3 workspace root: `v3/package.json` (name, `verify`/`dev` script stubs), `v3/pnpm-workspace.yaml` (apps/*, packages/*), `v3/tsconfig.base.json` (strict, NodeNext), `v3/.gitignore`
- [X] T002 [P] Scaffold shared packages `v3/packages/core`, `v3/packages/db`, `v3/packages/ingestion-contract`: each with `package.json` (`@stacks/core|db|ingestion-contract`, `typecheck`/`test` scripts), `tsconfig.json` extending base, `vitest.config.ts`, empty `src/index.ts`
- [X] T003 [P] Scaffold TS apps `v3/apps/api` (deps: fastify, @fastify/secure-session, bcrypt, @stacks/core, @stacks/db) and `v3/apps/worker` (deps: @stacks/core, @stacks/db): `package.json`, `tsconfig.json`, `vitest.config.ts`, empty `src/`
- [X] T004 [P] Scaffold React Router 7 framework-mode SSR app in `v3/apps/web` with Tailwind + shadcn/ui and Vitest + Testing Library (jsdom) configured; no dependency on @stacks/db (FR-019)
- [X] T005 [P] Scaffold Python sidecar in `v3/apps/ml`: `pyproject.toml` (fastapi, uvicorn, sentence-transformers, pytest, pyright), `src/ml/__init__.py`, `tests/`
- [X] T006 Write `v3/.env.example` implementing the full variable contract in `specs/007-v3-skeleton/contracts/environment.md` — every variable, safe local defaults, comments documenting the two required secrets and the bcrypt-hash generation command (FR-004, SC-006)

**Checkpoint**: `pnpm install` succeeds at `v3/`; workspace graph resolves

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Typed errors, model-role config, DB schema + migrations, queue, and the
Fastify app skeleton — everything all three stories build on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Write failing unit tests for typed domain errors (four classes, seam field) and env-first model-role resolution (happy path; missing/malformed var fails fast naming the variable) in `v3/packages/core/test/errors.test.ts` and `v3/packages/core/test/model-roles.test.ts`
- [X] T008 Implement `DomainError` + `ErrorClass` in `v3/packages/core/src/errors.ts` and `resolveModelRole('embedding')` from env in `v3/packages/core/src/model-roles.ts` per data-model.md value objects; export from `src/index.ts` (FR-013, FR-011 groundwork)
- [X] T009 Define Drizzle schema for `jobs`, `skeleton_check_runs`, `skeleton_check_events`, `skeleton_vectors` in `v3/packages/db/src/schema/{jobs,skeleton-checks,skeleton-vectors}.ts` exactly per data-model.md (columns, checks, indexes; un-dimensioned `vector` column per research R8)
- [X] T010 Generate migration 0001 via drizzle-kit into `v3/packages/db/migrations/` prepending `CREATE EXTENSION IF NOT EXISTS vector`; configure `v3/packages/db/drizzle.config.ts` (FR-016, research R10)
- [X] T011 [P] Implement DB client factory and programmatic migrator in `v3/packages/db/src/client.ts` and `v3/packages/db/src/migrate.ts` (Drizzle over `pg`, journal-recorded applications)
- [X] T012 [P] Write failing integration tests for queue semantics in `v3/packages/db/test/queue.test.ts`: enqueue, SKIP LOCKED claim, complete, retryable-fail requeues with backoff `run_at`, attempts exhaust → failed, visibility-timeout reclaim (research R6; runs against Dockerized Postgres)
- [X] T013 Implement queue helpers (`enqueue`, `claimNext`, `complete`, `fail`, `reclaimStale`) plus append-only event-insert helper in `v3/packages/db/src/queue.ts` and `v3/packages/db/src/events.ts` (D12, FR-010)
- [X] T014 Implement Fastify app factory in `v3/apps/api/src/app.ts` with the DomainError→HTTP error mapper (404/415/503/500 envelope per contracts/api.md) and unauthenticated `GET /health` + `GET /ready` in `v3/apps/api/src/health.ts` (FR-003)
- [X] T015 Implement API boot sequence in `v3/apps/api/src/main.ts`: validate required env fast-fail, run migrations before listen, `/ready` implies schema-current (FR-002, research R10; uses T008 config + T011 migrator)

**Checkpoint**: `pnpm -r typecheck && pnpm -r test` green (core + db + api foundations); user stories can start

---

## Phase 3: User Story 1 — One-Command Startup and Sign-In (Priority: P1) 🎯 MVP

**Goal**: Fresh clone + populated `.env` + one compose command → five healthy services,
schema applied, operator signs in and lands on an authenticated home surface

**Independent Test**: quickstart.md Scenario 1 — `docker compose up -d --build --wait`
from `v3/`, curl the three ready endpoints, sign in via browser, wrong password
refused, restart is fast with data intact

### Tests for User Story 1 (write first, ensure they FAIL)

- [X] T016 [P] [US1] Contract tests for auth in `v3/apps/api/test/auth.contract.test.ts` (fastify.inject): login sets sealed HttpOnly cookie; wrong password → 401 fixed non-revealing body + no cookie; `GET /api/auth/session` 200 with / 401 without valid cookie; tampered cookie → 401; logout clears; health/ready reachable unauthenticated (FR-006, FR-007)
- [X] T017 [P] [US1] Sidecar lifecycle tests in `v3/apps/ml/tests/test_readiness.py`: `/health` 200 pre-load, `/ready` 503 `{"status":"loading"}` → 200 with model+dimensions post-load, load failure → 503 `{"status":"failed"}` (contracts/ml-sidecar.md, FR-003)
- [X] T018 [P] [US1] Web auth-flow tests in `v3/apps/web/test/auth.test.tsx`: login form submit → redirect home; unauthenticated route access → redirect to login; failed login renders non-revealing message

### Implementation for User Story 1

- [X] T019 [US1] Implement auth in `v3/apps/api/src/auth/`: @fastify/secure-session keyed from `SESSION_SECRET`, `POST /api/auth/login` (bcrypt compare vs `OPERATOR_PASSWORD_HASH`), `POST /api/auth/logout`, `GET /api/auth/session`, and a global preHandler guard exempting only health/ready (research R5, D13)
- [X] T020 [P] [US1] Implement sidecar startup lifespan in `v3/apps/ml/src/ml/models.py` + `v3/apps/ml/src/ml/main.py`: load `ML_EMBEDDING_MODEL` from env into HF cache dir, `/health` + `/ready` per contract; no embed endpoint yet
- [X] T021 [P] [US1] Implement worker main loop in `v3/apps/worker/src/main.ts`: poll every `WORKER_POLL_MS`, claim via queue helpers, dispatch to a (currently empty) handler registry, reclaim stale claims, structured logs; graceful shutdown
- [X] T022 [P] [US1] Implement server-side API client with cookie relay in `v3/apps/web/app/lib/api.server.ts` (`API_INTERNAL_URL`, forwards request cookie, relays Set-Cookie — research R9) and login/logout/home routes in `v3/apps/web/app/routes/` with an auth-gating root loader
- [X] T023 [P] [US1] Write Dockerfiles: `v3/apps/api/Dockerfile`, `v3/apps/worker/Dockerfile` (workspace-aware pnpm builds), `v3/apps/web/Dockerfile` (RR7 build + node server), `v3/apps/ml/Dockerfile` (python 3.12-slim, HF cache dir env)
- [X] T024 [US1] Write `v3/docker-compose.yml`: five services with healthchecks (`postgres` pg_isready; `api` /ready; `ml` /ready; `web` /; `worker` process check), `depends_on` service_healthy chain (api→postgres, worker→api+ml, web→api), all published ports as `127.0.0.1:${VAR:-default}` per contracts/environment.md, named volumes (postgres-data, hf-cache), project name `the-stacks-v3` (FR-001, FR-005, research R3)
- [X] T025 [US1] Write `v3/docker-compose.prod.yml`: only `V3_WEB_PORT` published, api/ml/postgres internal, `SESSION_COOKIE_SECURE=true` (config shape only, per spec assumptions)
- [X] T026 [US1] Validate quickstart.md Scenario 1 end-to-end (fresh `docker compose up -d --build --wait`, sign-in, wrong-password refusal, restart speed + data intact); fix until green and record timings vs SC-001

**Checkpoint**: MVP — the whole v3 stack starts with one command and the operator can sign in

---

## Phase 4: User Story 2 — End-to-End Seam Verification (Priority: P2)

**Goal**: Authenticated operator triggers the skeleton check; it runs async through
queue → worker → sidecar embed → pgvector write + similarity read-back, leaving one
timed, append-only event per seam, failing legibly when a seam is down, idempotent on
re-runs

**Independent Test**: quickstart.md Scenarios 2–4 — trigger from UI, watch
accepted→running→succeeded < 60 s, six events with timings, dependency-down drill with
`docker compose stop ml`, duplicate-free re-runs

### Tests for User Story 2 (write first, ensure they FAIL)

- [X] T027 [P] [US2] Unit test for deterministic vector identity in `v3/packages/core/test/skeleton-check.test.ts`: id = sha256(input + provider/model/dimensions), stable across calls, changes when any component changes (FR-012)
- [X] T028 [P] [US2] Contract tests for check routes in `v3/apps/api/test/skeleton-checks.contract.test.ts`: POST → 202 with run id+status accepted; GET unknown id → 404 `unknown_thing`; GET list newest-first; GET detail shape incl. events array and success-only/failure-only fields (contracts/api.md)
- [X] T029 [P] [US2] Sidecar embed tests in `v3/apps/ml/tests/test_embed.py`: happy batch (dims × inputs alignment), model mismatch → 404, empty/oversized/non-string inputs → 415, pre-ready → 503 (contracts/ml-sidecar.md)
- [X] T030 [P] [US2] Worker handler integration tests in `v3/apps/worker/test/skeleton-check.test.ts` (Dockerized Postgres + stubbed ml HTTP): success path writes all six events with durations and stamps provider/model/dimensions on the vector; connection-refused/timeout/503 → run failed with `{class:'dependency_down', seam:'inference'}` and requeue-then-succeed on sidecar return; dimension mismatch → `internal_fault` with nothing written; second run reuses vector id via ON CONFLICT DO NOTHING (FR-010, FR-011, FR-012, FR-014)

### Implementation for User Story 2

- [X] T031 [P] [US2] Implement skeleton-check domain in `v3/packages/core/src/skeleton-check.ts`: fixed synthetic input fixture, deterministic vector-id derivation, seam name constants, run/outcome types shared by api + worker (FR-015)
- [X] T032 [P] [US2] Implement `POST /v1/embed` in `v3/apps/ml/src/ml/main.py`: batch validation (`EMBED_MAX_BATCH`), loaded-model assertion, typed error envelope, `duration_ms` (contracts/ml-sidecar.md)
- [X] T033 [US2] Implement API check routes in `v3/apps/api/src/skeleton-checks/routes.ts`: POST creates run + enqueues job in one transaction, emits `queued` event, returns 202; GET list + GET detail with events, outcome, vector block per contracts/api.md (FR-008, FR-009)
- [X] T034 [US2] Implement worker handler in `v3/apps/worker/src/handlers/skeleton-check.ts` + ml HTTP client in `v3/apps/worker/src/ml-client.ts`: claim → `claimed` event → embed (`ML_REQUEST_TIMEOUT_MS`, dependency-down vs internal-fault mapping) → `inference` event → vector upsert with identity stamp → `vector_write` event (`deduplicated` flag) → similarity read-back filtered on model identity → `vector_readback` event with distance → run succeeded + `completed` event; failures mark the failing seam `ok:false`, set typed run outcome, and requeue when retryable (FR-010…FR-014)
- [X] T035 [US2] Implement web check UI in `v3/apps/web/app/routes/`: home "Run skeleton check" action + runs list, run detail route rendering status, outcome, vector identity block, and the per-seam event trail with timings; status polling via revalidation until terminal (FR-008, FR-010; spec's minimal status view)
- [X] T036 [P] [US2] Web tests for the check UI in `v3/apps/web/test/skeleton-checks.test.tsx`: trigger renders accepted state without blocking; detail renders six-event trail; failed run renders dependency-down outcome naming the seam
- [X] T037 [US2] Validate quickstart.md Scenarios 2–4 against the running stack (full seam crossing < 60 s, `stop ml` drill fails legibly < 30 s then recovers, idempotent re-run shares vector id); fix until green (SC-002, SC-003, SC-007) — seam crossing succeeded in ~1s (curl-triggered, six events present); `stop ml` drill failed in <1s with `dependency_down`/`inference`; recovery after `start ml` succeeded reusing the same deterministic vector id across 3 separate runs

**Checkpoint**: A request provably crosses every architectural seam with an inspectable trail

---

## Phase 5: User Story 3 — Developer Foundation: Boundaries, Migrations, and Tests (Priority: P3)

**Goal**: One command runs the full verification suite green; migrations apply
automatically and are recorded; shared packages are the single source of definitions;
the error-mapping convention is pinned per class

**Independent Test**: quickstart.md Scenario 5 — `pnpm verify` green on fresh checkout
< 10 min; a trivial new migration applies on next startup and is journaled

### Tests for User Story 3 (write first, ensure they FAIL)

- [X] T038 [P] [US3] Error-mapping contract tests pinning all four classes in `v3/apps/api/test/error-mapping.contract.test.ts`: `unknown_thing`→404, `unsupported_type`→415 (e.g. non-JSON content type on POST), `dependency_down`→503 (DB pool stubbed down on /ready), `internal_fault`→500 with scrubbed message — at least one test per class (FR-018)
- [X] T039 [P] [US3] Migration-lifecycle integration test in `v3/apps/api/test/migrations.test.ts`: boot against empty Dockerized Postgres applies 0001 and records it in the journal; adding a trivial second migration file applies incrementally on next boot (FR-016)

### Implementation for User Story 3

- [X] T040 [US3] Make the four error-mapping tests pass in `v3/apps/api/src/app.ts` (content-type guard, readiness dependency probe, catch-all internal-fault scrubbing) — already satisfied by the T014 implementation; no changes needed
- [X] T041 [P] [US3] Implement ingestion plugin contract placeholder in `v3/packages/ingestion-contract/src/index.ts`: named exported interface (identify/parse shape) + version constant, explicitly documented as placeholder owned by the ingestion spec, with a type-level test in `v3/packages/ingestion-contract/test/contract.test.ts` (FR-015)
- [X] T042 [P] [US3] Write boundary-check script `v3/scripts/check-boundaries.mjs` failing on: `apps/web` depending on `@stacks/db` or importing from `apps/*`; any v3 file importing from v2 paths (`../apps`, repo-root `apps/`); model identifiers hardcoded outside `.env.example`/compose (grep per quickstart Scenario 7) (FR-019, FR-005, SC-006)
- [X] T043 [US3] Wire root `pnpm verify` in `v3/package.json`: boundary script + `pnpm -r run typecheck` + `pnpm -r run test` (core, db, api, worker, web), documented in `v3/README.md`; ensure fresh-checkout green (FR-017, SC-005)
- [X] T044 [US3] Validate quickstart.md Scenario 5: fresh checkout `pnpm install && pnpm verify` green < 10 min; trivial-migration drill applies and journals on restart; record evidence — `pnpm verify` measured at 10.4s; migration drill covered by T039's automated test

**Checkpoint**: All three stories independently verified; foundation ready for the next specs

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coexistence proof, repo hygiene, and the documentation obligations the
constitution attaches to this spec

- [X] T045 [P] Validate quickstart.md Scenario 6 (v2 coexistence): both stacks up simultaneously, disjoint ports/containers/volumes, v2 smoke checks still pass; record evidence (FR-005, SC-004) — 10/10 containers healthy simultaneously, zero collisions; `make smoke` blocked by a pre-existing v2 macOS/mktemp portability gap (see evidence.md), unrelated to v3
- [X] T046 [P] Validate quickstart.md Scenario 7 (zero secrets, zero hardcoded model ids) across `v3/`; fix any hits (SC-006)
- [X] T047 [P] Update root `README.md` and `AGENTS.md`: document the v3 stack under `v3/` (start command, ports, verify command) alongside the still-running v2 reference (constitution sync-impact note assigns this to the skeleton spec)
- [X] T048 Write wiki page `docs/wiki/V3-Walking-Skeleton.md` (monorepo layout, compose topology, queue/event/vector doctrine, auth, sidecar contract — the settled plan decisions R1–R10) and link it from `docs/wiki/Home.md` (constitution Development Workflow: wiki-impact decision)
- [X] T049 Full quickstart.md pass end-to-end on a fresh clone as final acceptance; capture timings vs SC-001…SC-007 in the feature's evidence — see `specs/007-v3-skeleton/evidence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational; its end-to-end validation (T037) additionally needs the US1 compose stack (T023–T026) — code tasks T027–T036 need only Foundational
- **US3 (Phase 5)**: depends on Foundational; T043/T044 (`pnpm verify` green) implicitly cover whatever suites exist at run time, so late US3 execution is simplest, but T038–T042 can run any time after Phase 2
- **Polish (Phase 6)**: T045/T049 need US1+US2 complete; T046–T048 need only stable design

### Within Each User Story

- Test tasks first, failing, then implementation (constitution TDD)
- Domain/shared code → services → routes/UI → compose/validation
- Each story ends with its quickstart validation task as the independent checkpoint

### Parallel Opportunities

- Phase 1: T002–T005 in parallel after T001; T006 anytime after T001
- Phase 2: T007 ∥ T009; then T008, T011, T012 in parallel; T013 after T012
- US1: T016–T018 in parallel; then T020–T023 in parallel (api T019 after T016)
- US2: T027–T030 in parallel; then T031, T032, T036 in parallel; T033→T034→T035 sequence on shared route/handler files
- US3: T038, T039, T041, T042 all parallel
- Polish: T045–T047 parallel

---

## Parallel Example: User Story 2

```bash
# All US2 tests together (must fail before implementation):
Task: "Unit test deterministic vector identity in v3/packages/core/test/skeleton-check.test.ts"
Task: "Contract tests for check routes in v3/apps/api/test/skeleton-checks.contract.test.ts"
Task: "Sidecar embed tests in v3/apps/ml/tests/test_embed.py"
Task: "Worker handler integration tests in v3/apps/worker/test/skeleton-check.test.ts"

# Then independent implementations:
Task: "Skeleton-check domain in v3/packages/core/src/skeleton-check.ts"
Task: "POST /v1/embed in v3/apps/ml/src/ml/main.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (the hard gate)
2. Phase 3 US1 → **STOP and VALIDATE**: one command, five healthy services, sign-in works
3. That alone proves Principle VI's "whole system starts with one compose command"

### Incremental Delivery

1. US1 → demo: the stack exists and you can get in (MVP)
2. US2 → demo: a request crosses every seam with a visible trail — the skeleton "walks"
3. US3 → demo: `pnpm verify` green — the foundation is cheap to build on
4. Polish → coexistence + docs obligations closed out

### Notes

- Integration tests needing Postgres (T012, T030, T039) run against Dockerized Postgres; keep them runnable on a fresh checkout with Docker available so `pnpm verify` stays honest
- Commit after each task or logical group; each checkpoint is a safe pause point
- v2 files (root `apps/`, root compose, root `.env.example`) are never touched except the documentation updates in T047 (FR-005, D1)
