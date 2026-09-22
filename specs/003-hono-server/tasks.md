---

description: "Task list for 003 — Hono HTTP server with health and one typed REST route"
---

# Tasks: Hono HTTP server with health and one typed REST route

**Input**: Design documents from `specs/003-hono-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED — the feature spec requires them explicitly (FR-008, and board task
TASK-0013 AC#5). They are not optional here.

**Organization**: Grouped by user story so each is independently implementable and
testable. US1 (health) is a shippable slice on its own; US2 (typed route) builds on the
same app but delivers separately.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths included

## Path Conventions

Monorepo per plan.md: server code in `apps/server/`, shared schemas in
`packages/shared/`. Paths are repo-root-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and the test runner this feature is the first to need.

- [x] T001 Add Hono, Zod, and a Postgres driver to `apps/server/package.json`; add Zod to `packages/shared/package.json`
- [x] T002 Add a test runner to `apps/server/package.json` and wire its `test` script so `pnpm test` runs real tests instead of TASK-0010's no-op placeholder
- [x] T003 [P] Add environment-variable configuration reading for the database connection in `apps/server/src/config.ts`

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The app-construction seam and error handling every route depends on. **No
user story can be completed before this phase is done.**

- [x] T004 Create the composable app factory in `apps/server/src/app.ts` — builds and returns the configured app WITHOUT binding a port, so tests exercise it in-process (research D3)
- [x] T005 Create the process entrypoint in `apps/server/src/index.ts` that binds the port and starts the app, replacing TASK-0010's placeholder export
- [x] T006 Implement the structured error shape and the error handler in `apps/server/src/errors.ts` per `contracts/errors.md` — the three `kind` values, `issues` only for validation, and a fixed generic message for `internal` that discloses nothing (FR-006, FR-007)
- [x] T007 Register the unknown-path handler so a missing route returns `kind: "not_found"` in the same structured shape rather than a framework default page (spec edge case 3)

**Checkpoint**: the app builds, starts, and returns structured errors. No feature routes yet.

---

## Phase 3: User Story 1 — The operator can tell whether their install is healthy (P1)

**Goal**: An operator or an orchestrator can determine, in one request, whether the
process is serving AND whether its database is reachable.

**Independent test**: Start against a reachable database → reports healthy. Stop the
database → reports the database unreachable, promptly, without hanging or claiming health.

- [x] T008 [US1] Implement the bounded database liveness probe in `apps/server/src/db.ts` — an explicit timeout, where a timeout returns unreachable rather than throwing or hanging (research D1, SC-002)
- [x] T009 [US1] Implement `GET /health` in `apps/server/src/routes/health.ts` per `contracts/health.md` — always `200`, with `status`, `process.uptimeSeconds`, and `database.reachable`
- [x] T010 [US1] Ensure `status` is derived, never independently set: `"ok"` only when every dependency fact is true (data-model.md validation rule)
- [x] T011 [P] [US1] Test in `apps/server/test/health.test.ts`: database reachable → `status: "ok"`, `database.reachable: true`, positive uptime
- [x] T012 [P] [US1] Test in `apps/server/test/health.test.ts`: database unreachable → still `200`, `status: "degraded"`, `database.reachable: false`
- [x] T013 [US1] Test that health answers within the 5-second bound when the database is unreachable or hung — the assertion that catches the hang, not merely the wrong body (SC-002, edge case 1)

**Checkpoint**: US1 is independently shippable. TASK-0011's compose healthcheck now has a
live endpoint matching the contract it was written against.

---

## Phase 4: User Story 2 — A client gets predictable, validated answers (P2)

**Goal**: A consumer — human or agent — sends a request and receives either a response
matching the declared shape, or a structured error naming what was wrong.

**Independent test**: Valid request → declared response shape. Malformed request →
structured validation error naming the offending input, no stack trace, no partial success.

- [ ] T014 [P] [US2] Define the route's input and output Zod schemas in `packages/shared/src/` — in the shared package so TASK-0016's client imports the same object rather than a copy (research D4, constitution II)
- [ ] T015 [US2] Export the new schemas from `packages/shared/src/index.ts`, keeping the existing `SHARED_VERSION` export intact
- [ ] T016 [US2] Implement `POST /api/echo` in `apps/server/src/routes/echo.ts` per `contracts/echo-route.md`, importing the schemas from `@the-stacks/shared`
- [ ] T017 [US2] Validate input BEFORE any handler logic runs, so unvalidated data never reaches the handler (FR-005)
- [ ] T018 [US2] Validate the response against the output schema before sending, so a handler bug cannot emit a shape-violating response (FR-004)
- [ ] T019 [P] [US2] Test in `apps/server/test/echo.test.ts`: valid input → `200` and a body matching the declared output shape
- [ ] T020 [P] [US2] Test in `apps/server/test/echo.test.ts`: missing field, wrong type, and over-length string each → `400`, `kind: "validation"`, and an `issues` entry naming the offending path
- [ ] T021 [P] [US2] Test that an internal failure returns `kind: "internal"` with no stack trace and no varying detail (FR-006)
- [ ] T022 [US2] Test that an unknown path returns `kind: "not_found"` in the same structured shape

**Checkpoint**: both stories complete. The validation seam every later route inherits now
exists and is proven.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T023 Run the full quickstart manual validation (all five scenarios in `quickstart.md`), including stopping the database to confirm the bound holds
- [ ] T024 Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` and capture the literal terminal output for the PR body — it stands in for the CI that TASK-0017 has not built yet
- [ ] T025 Confirm no server code imports across a plane boundary and no game-system assumption leaked into the route or error shape (constitution III, VI; CR-004)

---

## Dependencies

- **Phase 1 → Phase 2**: dependencies and the test runner must exist first.
- **Phase 2 → everything**: the app factory and error handling block both stories.
- **US1 and US2 are independent of each other** once Phase 2 is done. Neither imports the
  other; they share only the app factory and the error shape.
- **US1 before US2 by priority**, not by technical dependency — US1 is the P1 slice and
  unblocks TASK-0011's healthcheck, which is the sibling task waiting on this one.

## Parallel execution opportunities

- T011, T012 (health tests, same file but independent cases) alongside T013.
- T014 (shared schemas) is parallel with any remaining US1 work — different package.
- T019, T020, T021 (route tests) run in parallel with each other.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + US1.** That is a shippable increment: an operator can verify
an install, and TASK-0011 is unblocked. US2 then adds the validation seam that every
later route inherits. Ship in that order even though both land in one PR — if something
has to be cut, US1 is what must survive.
