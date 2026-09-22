# Implementation Plan: Session auth for operator and invited players

**Branch**: `task-0014-session-auth` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-session-auth/spec.md`

## Summary

Self-rolled session auth for a single-tenant self-hosted install: `users`, `auth_sessions`,
and `invitations` tables with a migration; sign-in, sign-out, and `me` over HTTP with a
`HttpOnly` cookie; an operator provisioning command; an operator-only invite that redeems
exactly once; and — the piece another task waits on — **one `validateSession` seam callable
from both the HTTP middleware and the WebSocket upgrade handler**
([contracts/validate-session.md](./contracts/validate-session.md)).

Technical approach per [research.md](./research.md): passwords hashed with **stdlib
`scrypt`** at N=2^15 with an explicit `maxmem` (D1 — the default throws, measured); session
tokens random and **stored only as SHA-256** so a database leak cannot impersonate anyone
(D2); a **30-day absolute lifetime that validation never extends** (D3), because a polling
WebSocket would otherwise keep a session alive forever; `HttpOnly`/`SameSite=Lax` with
**conditional** `Secure` (D4); invitation single-use enforced by a **conditional UPDATE**
rather than read-then-write (D5); and provisioning as a command that **refuses to clobber**
an existing operator (D6).

## Technical Context

**Language/Version**: TypeScript 5.x on Node 22 (Architecture Constraints table)

**Primary Dependencies**: **none new.** Hono and Zod are present; hashing and token
generation come from `node:crypto`. Avoiding a native `argon2`/`bcrypt` dependency is a
deliberate deployability decision (research D1), not an oversight.

**Storage**: Postgres 17 via Drizzle, reusing spec 004's migration workflow

**Testing**: Vitest, with integration tests against a real Postgres via `TEST_DATABASE_URL`

**Target Platform**: Linux server container, self-hosted (constitution IX)

**Project Type**: Web service — one Node process (Architecture A2)

**Performance Goals**: Sign-in hashing ~63 ms (measured, D1) — unnoticeable to a person,
expensive to an attacker. Session validation is a single indexed lookup on `token_hash`, on
the hottest path in the system, with no write.

**Constraints**: One validation path for both transports (FR-007). No default credential
anywhere (FR-011). No silent password truncation (FR-016).

**Scale/Scope**: One operator plus a table's worth of players. Three tables, one migration,
five HTTP endpoints, one provisioning command, the validation seam, and tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every capability is an HTTP endpoint taking and returning
      JSON ([contracts/http-auth.md](./contracts/http-auth.md)); an agent signs in and acts
      through exactly the endpoints a human's browser uses. Nothing requires a rendered
      page, and provisioning is a command rather than a UI wizard partly for this reason
      (CR-001).
- [x] **II. Content contract** — no codex entity is created. `users` are accounts, not
      portrayable entities; NPC content contracts arrive in M2. Not applicable, not waived.
- [x] **III. Data planes** — `users`, `auth_sessions`, and `invitations` are **session
      plane**. No library or codex state is read or written (CR-002).
- [x] **IV. Event sourcing / server authority** — identity is decided server-side and a
      client cannot assert who it is (CR-003). This feature appends no events itself; it
      supplies the `userId` that TASK-0015 writes as the event log's `actor`, which is why
      spec 004 left `actor` opaque.
- [x] **V. Citations** — no library-derived claim. Not applicable.
- [x] **VI. System-agnostic** — no game mechanics. Roles are `operator`/`player`, which are
      deployment roles, not character or system concepts. A Fate table uses this unchanged.
- [x] **VII. Structured first** — no generated artifact or asset. Not applicable.
- [x] **VIII. Operator-owned content** — ships no rulebook content, and ships **no default
      credential** (FR-011), which is this principle's spirit applied to the install itself:
      the operator owns their system from the first boot. NON-NEGOTIABLE and clean.
- [x] **IX. Self-hostable** — works from `docker compose up` with **no external identity
      provider** (constitution's auth row) and **no new dependency at all**. The stdlib
      hash choice exists precisely so a self-hoster's install cannot fail on a native build.

**Stack conformance** — TypeScript, one Node process, Hono, Postgres, Drizzle, Zod. Nothing
added. The constraints table's auth row ("Self-rolled session auth. Operator plus invited
players. No external IdP") is implemented literally.

**Post-Phase-1 re-check**: re-evaluated after data-model, contracts, and quickstart. No gate
changed. Two design details are worth naming against principles: storing only the token's
hash (D2) strengthens IV's server-authority claim — a leaked database yields no usable
credential — and the `auth_sessions` name (rather than `sessions`) keeps III's plane
boundary legible now that two different "sessions" exist in one system.

## Project Structure

### Documentation (this feature)

```text
specs/005-session-auth/
├── plan.md                      # This file
├── spec.md                      # Feature specification
├── research.md                  # D1 scrypt, D2 token hashing, D3 lifetime, D4 cookies, D5 invite race, D6 provisioning
├── data-model.md                # users, auth_sessions, invitations
├── quickstart.md                # Runnable validation
├── contracts/
│   ├── validate-session.md      # THE FIXED SEAM — TASK-0015 codes against this
│   └── http-auth.md             # The five endpoints (internal to this task)
├── checklists/requirements.md
└── tasks.md                     # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/server/
├── drizzle/                       # EXISTING — gains this feature's migration
├── src/
│   ├── schema/
│   │   ├── events.ts              # EXISTING — untouched
│   │   └── auth.ts                # NEW — users, auth_sessions, invitations
│   ├── auth/
│   │   ├── password.ts            # NEW — scrypt hash/verify (research D1)
│   │   ├── session.ts             # NEW — createSession, validateSession, endSession
│   │   ├── invitations.ts         # NEW — issue + redeem (research D5)
│   │   └── middleware.ts          # NEW — HTTP middleware over validateSession
│   ├── routes/
│   │   └── auth.ts                # NEW — the five endpoints
│   └── app.ts                     # EXISTING — mounts the auth routes
├── scripts/
│   ├── migrate.ts                 # EXISTING — untouched
│   └── create-operator.ts         # NEW — provisioning command (research D6)
└── test/
    ├── auth.password.test.ts      # NEW — hash/verify, no database
    └── auth.integration.test.ts   # NEW — sign-in, refusal, expiry, invite single-use
```

**Structure Decision**: The monorepo layout is used unchanged. Auth logic lives in
`src/auth/` as plain functions with routes as a thin layer over them — `validateSession` in
particular must be callable **without** a `Request`, since the WebSocket upgrade handler has
no Hono context (contracts/validate-session.md). Putting the logic in the route handler
would make the seam uncallable and force TASK-0015 to duplicate it, which is the exact
divergence FR-007 exists to prevent. Nothing is added to `packages/shared`: the auth types
are server-internal until the SPA needs them in TASK-0016.

## Complexity Tracking

> No Constitution Check violations. This section is empty by design.

All nine gates pass. The feature adds three tables and **zero dependencies** — the stdlib
hash choice (research D1) is what keeps the dependency count at zero rather than adding a
native module the constraints table does not carry.
