# Implementation Plan: Invitation redeem conflict

**Branch**: `task-0032-invite-conflict` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-invite-conflict/spec.md`

## Summary

`redeemInvitation` throws a 500 on a taken username because its private `isUniqueViolation`
checks only `err.code`, and drizzle-orm wraps the pg error in a `DrizzleQueryError` with the
driver error on `err.cause`. `library/store.ts` already carries a corrected private copy
(commit 83ebc51). Move the corrected detector into `apps/server/src/db.ts` as one exported
`isUniqueViolation`, delete both private copies, and import the shared one from both callers.
Prove the fix with a failing-first integration test against a real database and a small unit
check of the helper. **No new runtime dependency.**

## Technical Context

**Language/Version**: TypeScript 5.x on Node 24 (existing server package)

**Primary Dependencies**: `drizzle-orm` 0.45.3, `pg` 8.23, `vitest` — all installed. **No new
runtime dependency.**

**Storage**: Postgres 17 (existing). No schema or migration change.

**Testing**: vitest. The integration case joins `apps/server/test/auth.integration.test.ts`,
which uses the loud-skip harness (`TEST_DATABASE_URL || DATABASE_URL`, `probeReachable`,
`REQUIRE_DATABASE=1` turns a skip into a failure). It MUST run with `REQUIRE_DATABASE=1`
against this task's own stack: `pnpm env:up` in the worktree before the run, `pnpm env:down`
after. The helper's unit check joins `apps/server/test/db.test.ts` (no database).

**Target Platform**: the existing two-container compose stack

**Project Type**: web service (server package only; no client change)

**Performance Goals**: none; a predicate over a thrown value

**Constraints**: the helper must never throw on any input (`null`, primitives, objects without
`code` or `cause`)

**Scale/Scope**: 1 helper, 2 callers, 3 call sites

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents and humans both redeem through
      `POST /auth/invitations/redeem` → `redeemInvitation`; the fix makes the same 409
      conflict error reach both. No human-only path.
- [x] **II. Content contract** — not applicable: no codex entity.
- [x] **III. Data planes** — no new state. The helper lives in `apps/server/src/db.ts`,
      outside every plane directory; `library/store.ts` already imports `../db.js`, so the
      library boundary rule (no `codex`/`session` imports) is untouched. Boundary check
      stays at its current fixture count.
- [x] **IV. Event sourcing** — not applicable: no play state.
- [x] **V. Citations** — not applicable: no library-derived claim and no retrieval change.
- [x] **VI. System-agnostic** — not applicable: no mechanics.
- [x] **VII. Structured first** — not applicable: nothing generated.
- [x] **VIII. Operator-owned content** — tests use synthetic usernames and the existing
      synthetic fixtures only.
- [x] **IX. Self-hostable** — no new container, service, or dependency.

**Stack conformance** — TypeScript, Postgres, Drizzle only. No departure.

Post-design re-check: unchanged, all gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/014-invite-conflict/
├── plan.md                     # This file
├── research.md                 # Phase 0 decisions R1–R4
├── contracts/
│   └── unique-violation.md     # isUniqueViolation contract + redeem conflict behavior
├── quickstart.md               # How to prove it on this worktree's stack
├── checklists/requirements.md
└── tasks.md                    # speckit-tasks output
```

No `data-model.md`: the feature adds no entity, table, or field.

### Source Code (repository root)

```text
apps/server/
├── src/
│   ├── db.ts                   # CHANGED: export isUniqueViolation (the one copy)
│   ├── auth/invitations.ts     # CHANGED: delete private copy + constant; import from ../db.js
│   └── library/store.ts        # CHANGED: delete private copy + constant; import from ../db.js
└── test/
    ├── db.test.ts              # CHANGED: unit check of isUniqueViolation (no DB)
    └── auth.integration.test.ts # CHANGED: taken-username redeem → conflict / 409
docs/wiki/
├── invitations.md              # REVIEW + re-pin
├── library-schema.md           # REVIEW + re-pin
├── database-access.md          # REVIEW + re-pin (db.ts is its source)
└── test-suite.md               # REVIEW + re-pin (both test files are its sources; counts change)
```

**Structure Decision**: the helper lives in `apps/server/src/db.ts`, the one module that owns
the pg driver and the Drizzle client (research R1). Callers, exhaustively:

| Caller | Call sites |
|---|---|
| `apps/server/src/auth/invitations.ts` | `redeemInvitation` catch block (1) |
| `apps/server/src/library/store.ts` | `storeParsedBook` catch block, `attachEmbeddings` catch block (2) |

## Design decisions (summary; detail in research.md)

- **(a) Location** (R1): `db.ts`, not a new file. Fewest files; the driver's error shape
  belongs beside the driver. `check:host-scripts` already imports `db.ts`, so the helper is
  covered by that check with no extension to it.
- **(b) Behavior** (R2): copy the corrected store.ts logic unchanged — `err.code` or
  `err.cause.code` equals `23505`. One level of `cause` is what drizzle produces; a deeper
  walk is not needed (`ponytail:` comment names the ceiling).
- **(c) Test shape** (R3): write the integration case first and watch it fail with a 500 /
  thrown error, then fix. Cover both `redeemInvitation` directly and the HTTP route, plus a
  different-letter-case username, plus a retry with a free username.
- **(d) Dependencies**: none new.

## Complexity Tracking

No constitution violations. One deliberate simplification, marked in code with a `ponytail:`
comment: the helper inspects one level of `cause`, not an arbitrary chain.
