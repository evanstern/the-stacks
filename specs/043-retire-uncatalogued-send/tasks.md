---
description: "Task list for retiring the uncatalogued WebSocket send path (TASK-0099)"
---

# Tasks: Retire the uncatalogued WebSocket send path

**Input**: `specs/043-retire-uncatalogued-send/` — spec.md (with the operator rulings of
2026-10-27), plan.md, research.md, quickstart.md, contracts/frozen-amendments.md.

**Tests**: required. The spec names the refusal test (FR-006). Every card AC is proven by a
named test.

**Dispatch unit**: each phase is one Sonnet implementer dispatch. Run Phase 1, then Phase 2.
Phase 1 holds the gateway change and the sender migration together: removing the path breaks
the M0 tests and the bench in the same commit range.

**Before each phase**: merge `origin/main` into the branch. Re-read this spec dir and the
branch's commits.

**Gate for every phase** (run before the phase's last commit): `pnpm ci:check`. Phase 1 also
runs the DB suites below.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate both databases
by hand. Restart the app. Export only `TEST_DATABASE_URL` from the worktree `.env`. Run the
suites with `REQUIRE_DATABASE=1`. Leave the stack up.

**Known flake**: WebSocket gateway integration tests flake. Re-run once on a failure in a WS
test the phase did not change. Record each re-run in the phase's commit message.

**Commits**: one or more per phase, each message led by `TASK-0099:`.

**Frozen contracts**: the operator ruled (spec.md "Operator rulings"). Apply
`contracts/frozen-amendments.md` exactly. Change no frame shape and no other contract text.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 The WebSocket send path refuses every uncatalogued event type. | T001, T009 (refusal test), T010 |
| #2 `appendUncataloguedEvent` and its write-boundary allow-list entry are removed. | T002, T003, T004, T005 |
| #3 The load bench and any remaining M0 sender use a catalogued type or are retired, and their tests pass. | T006, T007, T008, T010 |

---

## Phase 1: Retire the path and migrate its senders (US1, US2, US3; FR-001–FR-007, FR-009)

**Goal**: an uncatalogued `send` is refused with `UNKNOWN_EVENT_TYPE`. The legacy writer and
its allow-list entry are gone. The bench and the M0 tests send `talk` gate requests. The
three frozen contracts carry the ruled amendments.

**Independent test**: quickstart.md checks 1–6 pass.

### The gateway and the writer (US1, US2)

- [x] T001 [US1] In `apps/server/src/ws/gateway.ts` `handleSend`, replace the uncatalogued
  append block with `sendError(conn, "validation", \`The event type ${frame.eventType} is not catalogued.\`, "UNKNOWN_EVENT_TYPE")`
  and `return` (research R1). Remove the `appendUncataloguedEvent` import. Rewrite the
  `handleSend` doc comment: "a gate request kind goes to the gate; any other type is refused
  (`CATALOG_TYPE_REQUIRES_GATE` when catalogued, `UNKNOWN_EVENT_TYPE` otherwise)". Remove the
  FR-004/FR-005 comments that described the deleted append. Keep `publish` unchanged.
- [x] T002 [US2] In `apps/server/src/session/events.ts`, delete `appendUncataloguedEvent` and
  its doc comment. Remove any import that only it used (check `AppendInput`). Keep `append`
  if `appendSessionEvent` or `appendSessionEvents` still use it.
- [x] T003 [US2] In `apps/server/test/helpers/import-graph.ts`, delete
  `appendUncataloguedEvent` from `WRITER_BINDINGS` and from `ALLOWED`. Delete the
  `file === "ws/gateway.ts"` branch of `isWriterModule` (research R2). Update any comment
  that names the legacy writer.
- [x] T004 [US2] Run `git grep -n appendUncataloguedEvent -- apps packages`. Expect no
  output. Run `apps/server/test/write-boundary.test.ts`. Expect zero violations on `src/` and
  exactly the three seeded violations on the fixture tree.
- [x] T005 [P] [US2] Apply `contracts/frozen-amendments.md` sections 1–3 to
  `specs/029-proposal-gate/contracts/ws-delivery.md`,
  `specs/029-proposal-gate/contracts/write-boundary.md` and
  `specs/006-ws-gateway/contracts/ws-protocol.md`. Change no other text.

### The senders (US3)

- [x] T006 [US3] In `apps/server/src/bench/load/users.ts`, replace the `load-bench-ping` send
  with the `talk` gate request of research R3. Generate the nonce with `randomUUID` from
  `node:crypto`. Confirm the payload against `GateRequestSchema`'s `talk` member in
  `packages/session-model/src/gate/proposals.ts`.
- [x] T007 [US3] In the same file, make the wait resolve on the `event` frame whose
  `event.type` is `talk` and whose `event.payload.text` equals the sent text. Make it end
  early on an `error` frame and record `ws_refused`. Keep `timeout` for a timeout. Keep
  `ERROR_KINDS`, the results format and the profile schema unchanged. Update the file's doc
  comment and any `concurrency.ts` comment that names the ping.
- [x] T008 [US3] In `apps/server/test/ws.integration.test.ts`, convert every raw send of
  `chat`, `ambient`, `tick` and `whisper` (T009–T034) to a `talk` gate request (research R4).
  Use a frame-level `visibility` of the recipient's user id for the restricted cases. Update
  each `event.type` and payload assertion to match. Keep each test's sender count and the
  property it proves. Leave `apps/server/test/ws.protocol.test.ts` unchanged (research R6).

### The refusal test (US1)

- [x] T009 [US1] Add to the spec 029 block of `apps/server/test/ws.integration.test.ts` the
  test of research R5. Two subscribers share one session. The sender sends
  `eventType: "chat"` and receives `error` with `kind: "validation"` and
  `code: "UNKNOWN_EVENT_TYPE"`. The other subscriber receives nothing. The log for the
  session has no row. A following `talk` from the sender arrives at both subscribers.

### Verification

- [x] T010 Run `ws.integration.test.ts`, `gate.integration.test.ts`,
  `gate.restart.integration.test.ts`, `ws.presence.integration.test.ts` and
  `test/bench/*.test.ts` with `REQUIRE_DATABASE=1` on the worktree stack. Run the load bench
  `concurrency-smoke` case (quickstart check 5). Expect `pass`, zero errors and a non-null
  round-trip p95. Record the results in the commit message. Report any `CONFLICT` refusal
  under concurrency; do not widen the gate retry.
- [x] T011 Run `pnpm ci:check`. Expect green.

**Checkpoint**: card ACs #1, #2 and #3 are true in code.

---

## Phase 2: Wiki (re-ground)

**Goal**: the corpus describes the two-row classifier and the bench's `talk` send. Every note
whose sources changed is re-pinned honestly. The runbook NEEDS-REVIEW notes for TASK-0099 are
`websocket-gateway`, `ws-protocol` and `proposal-gate`.

**Independent test**: the freshness gate prints `OK`. The spec-bridge gate exits 0.

- [x] T012 Review `docs/wiki/websocket-gateway.md` against the Phase 1 diff. Rewrite the send
  classification as two rows: gate request kind → gate; any other type → refused
  (`CATALOG_TYPE_REQUIRES_GATE` when catalogued, `UNKNOWN_EVENT_TYPE` when not). Drop the
  "TASK-0099 retires this path" line. Update `description:`. Re-pin `verified_against`.
- [x] T013 [P] Review `docs/wiki/ws-protocol.md`. Update the `send` classification prose and
  the `error` frame's `code` examples to name `UNKNOWN_EVENT_TYPE`. Note the spec 043
  amendment beside the decision-0024 amendment in Connections. Do not change any frame shape.
  Re-pin.
- [x] T014 [P] Review `docs/wiki/proposal-gate.md`. Remove the legacy-path paragraph and the
  `appendUncataloguedEvent` allow-list mention. State that `ws/gateway.ts` is no longer an
  allowed writer. Re-pin.
- [x] T015 [P] Update `docs/wiki/session-model.md` (drop `appendUncataloguedEvent` from the
  server append seam), `docs/wiki/event-log.md` (drop "legacy uncatalogued writes only"),
  `docs/wiki/benchmarks.md` (the WebSocket send is a `talk` gate request; the round trip is
  matched to its own event; an error frame counts as `ws_refused`) and
  `docs/wiki/test-suite.md` (the import-graph allow-list). Re-pin each note whose sources
  changed.
- [x] T016 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. In
  `docs/wiki/INDEX.md`, replace "the legacy uncatalogued `send` path remains until TASK-0099"
  with a statement that the path is retired (TASK-0099, specs/043), and update the
  `websocket-gateway` entry's line.
- [x] T017 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`.
  Expect `OK`. Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`.
  Expect exit 0. Run `pnpm ci:check`.

**Checkpoint**: the wiki matches the code. The PR may open once the runbook's per-task
artifacts check true.

---

## Dependencies & Execution Order

- Phase 1 before Phase 2. Phase 2 reads Phase 1's diff.
- Within Phase 1: T001–T003 come before T004. T006 comes before T007. T008 and T009 follow
  T001. T010 and T011 come last. T005 is independent of the code tasks.
- Within Phase 2: T012 comes before T016, which needs the new description. T013–T015 run in
  parallel. T017 comes last.

## Parallel examples

- Phase 1: T005 (contract text) alongside T006–T007 (bench), once T001 has landed.
- Phase 2: T013, T014 and T015 touch different notes.

## Implementation strategy

There is one deliverable PR. Phase 1 makes all three card ACs true. Phase 2 re-grounds the
corpus. No phase ships alone.

## Notes

- There is no migration and no new dependency (plan.md).
- `apps/web` is untouched (research R8).
- Historical uncatalogued rows stay in every log. Replay delivers them, and projections skip
  them.
