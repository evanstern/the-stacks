# Implementation Plan: Docker Compose stack — app and Postgres 17 with pgvector

**Branch**: `task-0011-compose-stack` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-compose-stack/spec.md`

## Summary

Deliver the two-container stack that IS the distribution model: one application container
and one Postgres 17 container with pgvector, joined by a named volume that outlives both.
The product requirement is that a stranger with only Docker reaches a working install from
a clean clone — so the deliverable is judged by whether someone else can run it, not by
whether it runs here.

## Technical Context

**Language/Version**: Node 22 in the application image, matching TASK-0010's `.nvmrc` and
`engines` pins; pnpm as pinned by `packageManager`

**Primary Dependencies**: Docker and Compose (the distribution mechanism); the `pgvector`
Postgres 17 image for the database service

**Storage**: Postgres 17 with pgvector, on a named Docker volume. Schema is TASK-0012 —
this feature creates no tables

**Testing**: Manual validation against the quickstart, since the stack's correctness is
its observable behavior (containers reach healthy, data survives a restart). No automated
container test harness is introduced; CI is TASK-0017

**Target Platform**: Linux containers on any Docker host — the self-hoster's machine

**Project Type**: Infrastructure for the existing monorepo

**Performance Goals**: Both services healthy within 2 minutes of a cold start including
image build (SC-002)

**Constraints**: Exactly two long-lived services (ratified topology). The application
must not crash-loop permanently when the database is slower to accept connections

**Scale/Scope**: Single-tenant, single-host, one operator plus invited players

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every stack operation (start, inspect, stop, teardown) is a
      documented non-interactive command, so an agent brings an environment up exactly as
      a human does. No prompt-driven or GUI-only step. Satisfies CR-001.
- [x] **II. Content contract** — not applicable: this feature creates no codex entity. It
      provides the runtime those entities will later live in.
- [x] **III. Data planes** — no plane is populated here. The volume will hold all three
      eventually; this feature establishes the storage, not its contents or their
      boundaries.
- [x] **IV. Event sourcing** — not applicable: no session state. The event log is
      TASK-0012, and this feature creates no tables at all.
- [x] **V. Citations** — not applicable: no library-derived claim.
- [x] **VI. System-agnostic** — the stack is a runtime and a datastore; it encodes no game
      mechanics and no 5e assumption. Satisfies CR-004.
- [x] **VII. Structured first** — not applicable: no generated artifact.
- [x] **VIII. Operator-owned content** — NON-NEGOTIABLE and directly load-bearing here.
      The image ships no rulebook content, and the named volume keeps everything the
      operator imports on the operator's own machine. Satisfies CR-005.
- [x] **IX. Self-hostable** — this feature IS Principle IX. Two containers and a volume,
      exactly as the principle states; model access stays BYO key and enters through
      configuration, never as a bundled service.

**Stack conformance** — Postgres 17 with pgvector, one Node process, two containers plus a
volume: every one a ratified Architecture Constraints row. **No third service is added.**
The worker split is explicitly deferred until ingestion or image jobs measurably starve
the event loop, which cannot be true in M0.

**Post-Phase-1 re-check**: the design below adds no service, no language, and no datastore
beyond the table. Gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/002-compose-stack/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — configuration + healthcheck contracts
├── checklists/          # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
docker-compose.yml       # The two services, the named volume, the healthchecks
Dockerfile               # Multi-stage build of the application image
.dockerignore            # Keeps node_modules and build output out of the build context
.env.example             # Every variable the stack requires, with safe placeholder values
.gitignore               # Extended so the operator's filled-in .env is never tracked
README.md                # The three documented steps of SC-001
```

**Structure Decision**: These files live at the repository root because that is where a
stranger looks for them, and where `docker compose` resolves by default. A multi-stage
Dockerfile keeps the runtime image free of build tooling — relevant beyond tidiness, since
this image is what self-hosters download. The README quickstart is part of the deliverable
rather than a follow-up: FR-001 and SC-001 are about a stranger succeeding, and an
undocumented working stack fails that test.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
>
> Worth stating explicitly, since it is the obvious place a third container would be
> argued for: this feature runs migrations nowhere and adds no worker or proxy service.
> The two-container topology is ratified, and any departure would need an amendment plus
> a row here, not a plan-level decision.
