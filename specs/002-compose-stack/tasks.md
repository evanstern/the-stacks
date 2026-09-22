---

description: "Task list for 002 — Docker Compose stack: app and Postgres 17 with pgvector"
---

# Tasks: Docker Compose stack — app and Postgres 17 with pgvector

**Input**: Design documents from `specs/002-compose-stack/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated test tasks. This feature's correctness is observable stack
behavior — containers reach healthy, data survives a restart — and it introduces no
container test harness (CI is TASK-0017). The quickstart's seven manual validations are
the verification, and they are tasks below, not optional follow-up.

**Organization**: Grouped by user story. US1 (a stranger can run this) and US2 (data
survives) are both P1 and ship together; US3 (database capabilities) is satisfied by the
image choice in Foundational and verified separately.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included

## Path Conventions

Infrastructure files live at the repository root per plan.md, where `docker compose`
resolves them and where a stranger looks.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The build context and ignore rules every later task depends on.

- [x] T001 Create `.dockerignore` at the repo root excluding `node_modules/`, build output, `.git/`, and `.env` so they never enter the build context
- [x] T002 Extend `.gitignore` so the operator's filled-in `.env` is never tracked, preserving the existing entries from TASK-0010 (FR-006, research D3)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The image and the service definitions everything else builds on. **No user
story can be verified before this phase is done.**

- [x] T003 Write the multi-stage `Dockerfile` at the repo root building the server workspace on Node 22 with pnpm — install the workspace so the server's dependency on `@the-stacks/shared` resolves, and keep build tooling out of the runtime stage (research D5)
- [x] T004 Create `docker-compose.yml` at the repo root declaring exactly two services, `app` and `db`, and no third service (plan.md Complexity Tracking)
- [x] T005 [US3] Configure the `db` service to use a published Postgres 17 image that already includes pgvector, rather than building a custom image (research D4, FR-003)
- [x] T006 [US2] Declare a NAMED volume for the Postgres data directory — not anonymous, not a bind mount (data-model.md; an anonymous volume is discarded on recreate, which is silent data loss)

**Checkpoint**: the stack is defined. Nothing is verified yet.

---

## Phase 3: User Story 1 — A stranger can run this project (P1)

**Goal**: Someone with only Docker, starting from a clean clone, reaches a working install
in three documented steps.

**Independent test**: On a machine with only Docker, clone, copy the example env file, run
one command, and watch both containers reach healthy.

- [x] T007 [US1] Write `.env.example` at the repo root enumerating EVERY variable the stack requires, with placeholder values and no real secret, per `contracts/configuration.md` (FR-005, SC-004, SC-005)
- [x] T008 [US1] Make the database host in the example `DATABASE_URL` the compose service name rather than `localhost`, with a comment saying why — the most common first-run mistake (contracts/configuration.md)
- [x] T009 [US1] Wire both services to read their configuration from environment variables, with no value hardcoded in `docker-compose.yml` that belongs in `.env`
- [x] T010 [US1] Implement the `app` service healthcheck that requests `GET /health` and **parses the response body**, reporting healthy only when the overall status reads `ok` — a status-code-only check would report a database-down container as healthy (research D1, contracts/healthcheck.md, FR-007)
- [x] T011 [US1] Add a healthcheck to the `db` service so its readiness is a real state the app service can depend on, not merely "the container started" (research D2)
- [x] T012 [US1] Make the `app` service wait on the `db` service reaching healthy, AND give the app's own healthcheck a start-up grace period so early failures do not count against it — both halves are required for convergence (FR-008, research D2)
- [x] T013 [US1] Ensure a missing or incomplete `.env` fails at startup naming the missing configuration, rather than surfacing an opaque connection error (FR-010)
- [x] T014 [US1] Write the three-step quickstart into `README.md` — clone, copy and edit the env file, start — because an undocumented working stack fails FR-001 and SC-001
- [x] T015 [US1] Run quickstart validation 1: `docker compose up -d` from a clean state; both services reach healthy within 2 minutes including image build (SC-002)
- [x] T016 [US1] Run quickstart validation 2 — **the one a passing-looking implementation silently fails**: stop the `db` service and confirm the `app` container goes UNHEALTHY despite `/health` still returning `200`; restart `db` and confirm it recovers with no manual intervention
- [x] T017 [US1] Run quickstart validation 6: move `.env` aside, start, and confirm the failure names the missing configuration

**Checkpoint**: a stranger can run the project, and its health is honest.

---

## Phase 4: User Story 2 — An operator's data survives restarts and upgrades (P1)

**Goal**: Ordinary lifecycle operations never cost the operator their data; only a
deliberate teardown does.

**Independent test**: Write a value, fully stop and start the stack, read it back.

- [x] T018 [US2] Run quickstart validation 3: write a row, `docker compose down` (NOT `-v`), `up -d`, and read the row back — expect it present (SC-003, FR-004)
- [x] T019 [US2] Run quickstart validation 4: rebuild the app image and restart; confirm database contents are unaffected (FR-004)
- [x] T020 [US2] Run quickstart validation 7: `docker compose down -v` removes the volume, confirming deliberate deletion is possible and documented — and visibly distinct from the plain `down` in T018 (FR-009)
- [x] T021 [US2] Document the destructive teardown in `README.md`, clearly marked as data-destroying and distinct from an ordinary stop

**Checkpoint**: the operator's content is safe across every ordinary operation.

---

## Phase 5: User Story 3 — The database is ready for what the project will need (P2)

**Goal**: An operator setting up today never has to migrate their datastore when retrieval
arrives.

**Independent test**: Query the running database for its version and the vector extension.

- [x] T022 [P] [US3] Run quickstart validation 5: confirm the database reports major version 17
- [x] T023 [P] [US3] Confirm the `vector` extension is AVAILABLE — not enabled; enabling it in a database is a migration and belongs to TASK-0012 (FR-003)

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T024 Confirm no real secret appears in any tracked file, and that a filled-in `.env` is ignored by git (SC-005, FR-006)
- [x] T025 Confirm the stack still declares exactly two long-lived services — no worker, no proxy, no migration container crept in (FR-002, plan.md Complexity Tracking)
- [x] T026 Capture the literal terminal output of the full quickstart run for the PR body; it stands in for the CI that TASK-0017 has not built yet

---

## Dependencies

- **Phase 1 → Phase 2**: the build context must be correct before the image is built.
- **Phase 2 → everything**: no story is verifiable before the services exist.
- **US1 before US2**: the data-persistence checks require a stack that starts.
- **US3 is independent of US1/US2 once Phase 2 is done** — T005 satisfies it; T022 and
  T023 only verify.
- **T016 depends on the health endpoint existing.** It is spec 003 (TASK-0013) that
  implements `GET /health`. Until that task merges, T016 is verified against the fixed
  contract — a stub or a manually-run server matching `contracts/healthcheck.md`. This is
  the sibling-task seam the sweep runbook sequences deliberately.

## Parallel execution opportunities

- T001 and T002 are different files, fully parallel.
- T022 and T023 are independent read-only queries.
- T014 and T021 both edit `README.md` — **not** parallel, despite both being documentation.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + US1.** That is the distribution promise: a stranger runs the
project. US2's validations then prove the promise is safe to rely on, and US3 confirms it
will not need redoing.

The task to get right is **T010/T016** — the healthcheck that parses the body. Everything
else in this feature fails loudly when wrong; that one fails silently, by reporting health
it has not verified.
