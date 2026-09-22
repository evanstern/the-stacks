# Implementation Plan: Hono HTTP server with health and one typed REST route

**Branch**: `task-0013-hono-server` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-hono-server/spec.md`

## Summary

Bring up the single Node process that hosts the API. Scope is one health endpoint plus
one typed REST route — deliberately minimal, because this task's product is the *seam*,
not the surface: every later route inherits the validation discipline and error shape
established here. The health endpoint additionally publishes the contract TASK-0011's
compose healthcheck is written against.

## Technical Context

**Language/Version**: TypeScript on Node 22 (pinned by TASK-0010's `engines` and `.nvmrc`)

**Primary Dependencies**: Hono (HTTP), Zod (validation), Drizzle (database client) — all
ratified rows in the constitution's Architecture Constraints table, not choices made here

**Storage**: Postgres 17. This feature opens a connection and answers a trivial liveness
query; schema, migrations, and the event log are TASK-0012

**Testing**: A test runner for the server workspace. TASK-0010 defined the `test` pipeline
task as a no-op placeholder; this feature is the first to put real tests behind it

**Target Platform**: Linux container (the `app` service TASK-0011 builds), and the
developer's host via the same workspace scripts

**Project Type**: Web service inside the existing pnpm/Turborepo monorepo

**Performance Goals**: Health answers within 5 seconds in every case including a dead
database (SC-002) — a bound for orchestration correctness, not a throughput target

**Constraints**: The health endpoint must not block on a hung database connection. No
authentication exists yet (TASK-0014)

**Scale/Scope**: Two endpoints. Single-tenant self-hosted install

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — the typed route is driven through its declared Zod
      input/output schema, which is the same interface a human client uses. An agent
      reads the schema and constructs a valid call; there is no form-only or
      session-only path. Satisfies CR-001.
- [x] **II. Content contract** — not applicable, and not evaded: this feature creates no
      codex entity. The identity/portrayal/hooks obligation binds entity types, which
      arrive in M2. No entity is introduced here to sidestep it.
- [x] **III. Data planes** — this feature introduces no persistent state in any plane. It
      opens a connection and answers a liveness query. No cross-plane import exists to
      violate, and none is added.
- [x] **IV. Event sourcing** — not applicable: no play state changes here. The event log
      is TASK-0012 and the append path is TASK-0015. This feature must not write any
      session state, and does not.
- [x] **V. Citations** — not applicable: no library-derived claim. No retrieval.
- [x] **VI. System-agnostic** — transport and validation scaffolding only. No 5e
      assumption in the route, the error shape, or the health report. Satisfies CR-004.
- [x] **VII. Structured first** — the error shape and health report are declared,
      validated structures, not free-form strings a client must parse.
- [x] **VIII. Operator-owned content** — ships no rulebook content whatsoever.
      NON-NEGOTIABLE, and trivially satisfied.
- [x] **IX. Self-hostable** — this feature is what makes `docker compose up` verifiable:
      the health endpoint is how an operator and an orchestrator both confirm the install
      works. Adds no container; runs inside the single `app` process per A2.

**Stack conformance** — Hono, Zod, Drizzle, one Node process, TypeScript. Every
dependency is a ratified Architecture Constraints row. No departure, so no amendment.

**Post-Phase-1 re-check**: the design below adds no dependency and no new state beyond
what the table already binds. Gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/003-hono-server/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — the health + route contracts
├── checklists/          # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
apps/server/
├── src/
│   ├── index.ts         # Entrypoint: builds the app, starts the server (replaces
│   │                    #   TASK-0010's placeholder export)
│   ├── app.ts           # Route composition + error handling, exported without
│   │                    #   listening so tests exercise it in-process
│   ├── db.ts            # Connection + the bounded liveness probe
│   └── routes/
│       ├── health.ts    # GET /health
│       └── <route>.ts   # The one typed REST route
└── test/                # Health (db up + db down) and route (valid + invalid)

packages/shared/
└── src/                 # Zod schemas shared across the API boundary — the
                         #   single-source rule (constitution II) in practice
```

**Structure Decision**: The server lives in the existing `apps/server` workspace that
TASK-0010 created; this feature replaces its placeholder export with a real entrypoint.
Route schemas go in `packages/shared` rather than inside the server, because the
single-source obligation (constitution II) means the web client in TASK-0016 must consume
the same schema object rather than a copy. Splitting `app.ts` from `index.ts` is what lets
tests exercise routes in-process without binding a port — the alternative, starting a real
server per test, is slower and flakier for no gain.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
