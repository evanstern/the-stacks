# Implementation Plan: Retire the uncatalogued WebSocket send path

**Branch**: `task-0099-retire-uncatalogued-send` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/043-retire-uncatalogued-send/spec.md` (TASK-0099), with the operator
rulings of 2026-10-27 (OQ1–OQ4 on the defaults).

## Summary

The gateway's `send` classifier loses its third row. An uncatalogued `eventType` gets
`error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }`, and nothing is written or
broadcast. `appendUncataloguedEvent` is deleted, and so are its writer binding and its
allowed importer in the write-boundary checker. The load bench and the M0 gateway integration
tests switch from raw uncatalogued types to an out-of-character `talk` gate request. Three
frozen contracts get the ruled amendments. No frame shape changes.

## Technical Context

**Language/Version**: TypeScript (Node 22), ESM.

**Primary Dependencies**: `ws` (gateway and bench client), `zod`, `@the-stacks/session-model`.
All are installed already.

**Storage**: Postgres session log (append-only). There is no schema change and no migration.

**Testing**: vitest. The DB suites run with `REQUIRE_DATABASE=1` on the worktree stack. The
write-boundary test needs no database.

**Target Platform**: the one Node server process (`apps/server`).

**Project Type**: pnpm monorepo web service.

**Performance Goals**: the bench round trip now passes through the gate (a projection load
plus a guarded append). The bench records that cost. There is no target to meet.

**Constraints**: frozen frame shapes (FR-007). Contract edits are exactly
`contracts/frozen-amendments.md` (FR-009).

**Scale/Scope**: about 4 source files, 2 test files, 1 test helper and 3 contract files. The
wiki phase covers 7 notes.

## Constitution Check (constitution 2.0.0)

- [x] **I. Agent-operable** — agents and browsers drive table writes through one interface,
      the `send` frame, which now carries gate requests only. The feature removes no
      capability: no agent writes through the raw path, and the DM and the harness use
      the gate API.
- [x] **II. Content contract** — not applicable. The feature adds no codex entity.
- [x] **III. Data planes** — session plane only. There is no new state and no cross-plane
      access.
- [x] **IV. Event sourcing** — strengthened. The last socket write that skipped the gate
      is gone, so "the server MUST pass every proposed change through the gate" holds for
      the socket as well. A refusal appends nothing. Historical uncatalogued rows remain,
      because the log is append-only, and projections still tolerate unknown types.
- [x] **V. Citations** — not applicable. The feature draws no claim from the library.
- [x] **VI. 5e engine boundary** — unchanged. No mechanics are involved.
- [x] **VII. Structured first** — not applicable. The feature generates no artifact.
- [x] **VIII. Operator-owned content** — the feature ships no content.
- [x] **IX. Self-hostable** — no container, service or dependency is added.

**Stack conformance**: within the Architecture Constraints table. There is no departure.

**Post-design re-check**: research.md R1–R8 introduce no violation. The Complexity Tracking
section is empty.

## Project Structure

### Documentation (this feature)

```text
specs/043-retire-uncatalogued-send/
├── spec.md
├── plan.md                         # this file
├── research.md                     # R1–R8
├── quickstart.md                   # verification commands
├── contracts/frozen-amendments.md  # the exact OQ2–OQ4 text edits
├── checklists/requirements.md
└── tasks.md                        # speckit-tasks output
```

There is no `data-model.md`. The feature adds no entity, field or event type.

### Source code — every file this plan touches

```text
apps/server/src/ws/gateway.ts                  # handleSend row 3 → UNKNOWN_EVENT_TYPE refusal; drop appendUncataloguedEvent import; update the doc comment
apps/server/src/session/events.ts              # delete appendUncataloguedEvent (and any import only it used)
apps/server/src/bench/load/users.ts            # talk gate request with a nonce; wait for own event; error frame → ws_refused
apps/server/src/bench/load/concurrency.ts      # comment only, if it names the ping (wsSend stays)
apps/server/test/helpers/import-graph.ts       # drop the writer binding, the ALLOWED entry and the ws/gateway.ts writer-module branch
apps/server/test/ws.integration.test.ts        # T009–T034 → talk requests; new UNKNOWN_EVENT_TYPE refusal test
apps/server/test/bench/*.test.ts               # only if an assertion names load-bench-ping or the old wait (none found at adb4527)
specs/029-proposal-gate/contracts/ws-delivery.md    # OQ2 amendment
specs/029-proposal-gate/contracts/write-boundary.md # OQ3 amendment
specs/006-ws-gateway/contracts/ws-protocol.md       # OQ4 amendment note
```

Wiki phase (re-ground; sources changed or prose names the legacy path):

```text
docs/wiki/websocket-gateway.md   # NEEDS-REVIEW (runbook): two-row classifier; description changes
docs/wiki/ws-protocol.md         # NEEDS-REVIEW (runbook): send classification prose; no frame-shape edit
docs/wiki/proposal-gate.md       # NEEDS-REVIEW (runbook): drop the legacy-path paragraph and allow-list mention
docs/wiki/session-model.md       # source session/events.ts changed: drop appendUncataloguedEvent
docs/wiki/event-log.md           # prose names "legacy uncatalogued writes"
docs/wiki/benchmarks.md          # source bench/load/users.ts changed: WS send is a talk request
docs/wiki/test-suite.md          # source test/helpers/import-graph.ts changed
docs/wiki/CAPSULES.md            # regenerate (websocket-gateway description changes)
docs/wiki/INDEX.md               # state paragraph: "the legacy uncatalogued send path remains until TASK-0099" → retired
```

Files deliberately untouched:

- `apps/server/src/ws/protocol.ts` (frame shapes are frozen).
- `apps/web/**` (it already sends gate requests only).
- `apps/server/test/ws.protocol.test.ts` (parse-only; research R6).
- `packages/session-model/**` (the read side is unchanged).
- The write-boundary fixture tree (its three seeded violations do not involve the removed binding).

**Structure Decision**: an existing monorepo layout. All server changes stay in
`apps/server`. No package boundary moves.

## Migrations and dependencies

- **Migrations**: none.
- **New runtime dependencies**: none. `randomUUID` comes from `node:crypto`, and `ws` is
  installed already.
- **Biome / boundary rules**: unchanged. No `fixtures/boundary-violations/` entry is needed.

## Risks

- **Gate contention in the concurrent tests and the bench.** Several senders on one session
  now go through `expectedLastSeq`. The gate retries on `SeqConflictError`. A `CONFLICT`
  refusal under test load is reported, not fixed (research R4).
- **WebSocket gateway test flake** (runbook). Re-run once, and record the re-run.
- **Hotspot overlap.** `apps/server/src/ws/` and the gate are shared with TASK-0049, which is
  queued behind this card. Merge `origin/main` in before each phase.

## Complexity Tracking

No violations. The section is empty.
