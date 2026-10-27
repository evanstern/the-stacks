# Feature Specification: Retire the uncatalogued WebSocket send path

**Feature Branch**: `task-0099-retire-uncatalogued-send`

**Created**: 2026-10-27

**Status**: Ready for planning. The operator ruled on every open question on 2026-10-27
(see Operator rulings).

**Input**: Board card TASK-0099. "The WebSocket send path accepts only catalogued
session-model requests, which go through the proposal gate. The inert legacy append for
uncatalogued event types (the M0 chat event, the bench ping) is removed."

**Board task**: TASK-0099 (milestone m-3; depends on TASK-0045, TASK-0047).

**Grounding**: `docs/wiki/websocket-gateway.md`, `docs/wiki/ws-protocol.md`,
`docs/wiki/proposal-gate.md`, `docs/wiki/presence.md`;
`specs/029-proposal-gate/contracts/write-boundary.md`, `ws-delivery.md`, `research.md` R8,
`spec.md` Open Question 2; `specs/006-ws-gateway/contracts/ws-protocol.md`;
`specs/021-load-bench/research.md` R8.

## Background

Spec 029 (TASK-0045) put the proposal gate between producers and the session log. The
WebSocket `send` frame is now classified by `eventType`:

1. A gate request kind goes to the gate.
2. Any other catalogued type is refused (`forbidden`, `CATALOG_TYPE_REQUIRES_GATE`).
3. Anything else is appended raw by `appendUncataloguedEvent` and broadcast.

Row 3 was kept so that M0 senders kept working while the gate landed (029 research R8). It
is inert: every projection skips unknown types. 029 named its retirement as a follow-up and
decision-0020 required the card. TASK-0047 has since replaced the M0 chat composer: the web
client now sends only gate request kinds (`apps/web/app/play/frames.ts`).

### Inventory of uncatalogued senders (at `origin/main` adb4527)

| Sender | Where | Uncatalogued types sent |
|---|---|---|
| Load bench, simulated users with `wsSend: true` | `apps/server/src/bench/load/users.ts` (used by `concurrency.ts` smoke and the `commit` and `demand` profiles) | `load-bench-ping` |
| M0 WebSocket integration tests T009–T034 | `apps/server/test/ws.integration.test.ts` | `chat`, `ambient`, `tick`, `whisper` |
| Protocol parse tests | `apps/server/test/ws.protocol.test.ts` | `chat` (parse only; never reaches the gateway) |
| Web client | `apps/web/app/ws/useSession.ts`, `apps/web/app/play/frames.ts` | none — gate request kinds only |
| Scripts, playtest harness, DM runtime | `scripts/`, `apps/server/src/playtest/`, `apps/server/src/dm/` | none — the harness and DM write through the gate API, not the socket |

The only writer of the legacy path is `ws/gateway.ts`, through `appendUncataloguedEvent`
in `apps/server/src/session/events.ts`. The write-boundary checker
(`apps/server/test/helpers/import-graph.ts`) lists it as a writer binding and allows it in
`ws/gateway.ts` only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The socket writes only through the gate (Priority: P1)

A client (a browser, a script, a misbehaving tool) sends a `send` frame whose `eventType`
is not in the session-model catalog. Today the server appends it to the session log and
broadcasts it to the table. After this feature the server refuses it, writes nothing, and
broadcasts nothing. Every row a socket client causes is a gate-vetted, catalogued row.

**Why this priority**: This is the card's outcome (AC #1). It closes the last raw write
path from the socket and makes the write boundary absolute: the log's only writers are
the gate and the session append seam beneath it.

**Independent Test**: Open an authenticated socket, subscribe to a session, send an
uncatalogued `eventType`. The sender receives an `error` frame. No other subscriber
receives anything. The log for the session gains no row.

**Acceptance Scenarios**:

1. **Given** an authenticated, subscribed connection, **When** it sends `eventType: "chat"`
   with an object payload, **Then** it receives one `error` frame, the connection stays
   open, and the session log has no new row.
2. **Given** two subscribers on one session, **When** one sends an uncatalogued type,
   **Then** the other receives no frame for it.
3. **Given** an authenticated connection, **When** it sends a gate request kind (`talk`),
   **Then** handling is unchanged from spec 029: the gate appends and every entitled
   subscriber receives the `event` frame.
4. **Given** an authenticated connection, **When** it sends a catalogued type that is not
   a gate request kind (`dice.rolled`), **Then** handling is unchanged from spec 029:
   `forbidden` with code `CATALOG_TYPE_REQUIRES_GATE`, nothing written.

---

### User Story 2 - The legacy writer is gone from the code and the boundary proof (Priority: P1)

A maintainer reads the write-boundary test and the session append seam. There is no
`appendUncataloguedEvent`, and the boundary test no longer admits `ws/gateway.ts` as a
writer. If any module later imports a log writer outside `session/` and `gate/`, the test
fails.

**Why this priority**: AC #2. Leaving the function or the allow-list entry behind would
keep a dormant writer that a later change could reconnect without tripping the test.

**Independent Test**: Search the server source for `appendUncataloguedEvent` (zero hits).
Run the write-boundary test: zero violations on `src/`, exactly the three seeded
violations on the fixture tree. A temporary import of `append` into `ws/gateway.ts` makes
the test fail.

**Acceptance Scenarios**:

1. **Given** the merged change, **When** the write-boundary test runs on `src/`,
   **Then** it reports zero violations, with no writer allowed outside `session/events.ts`
   (for `append`/`appendBatch`) and `gate/**` (for the session append functions).
2. **Given** the merged change, **When** `ws/gateway.ts`'s transitive import closure is
   computed, **Then** it is no longer treated as an allowed writer (rule 4's writer list
   drops it); it still must not import any writer binding.

---

### User Story 3 - The load bench and the M0 tests still measure and prove the same things (Priority: P2)

An operator runs the load bench's `concurrency-smoke` case and the `commit`/`demand`
profiles with `wsSend: true`. The simulated users send a catalogued request through the
gate and the bench still times a WebSocket round trip. The M0 gateway integration tests
(fan-out, server authority, replay/live boundary, visibility, abrupt disconnect) keep
their meaning, driven by catalogued gate requests instead of raw uncatalogued types.

**Why this priority**: AC #3. Without it the bench reports every send as a timeout and the
M0 test suite fails, but neither is user-facing behaviour.

**Independent Test**: Run `apps/server/test/bench/*.test.ts` and the load bench's
`concurrency-smoke` case on a worktree stack: zero errors, a non-null round-trip p95. Run
`apps/server/test/ws.integration.test.ts` with `REQUIRE_DATABASE=1`: every test passes.

**Acceptance Scenarios**:

1. **Given** a load step with `wsSend: true`, **When** a simulated user sends, **Then** the
   frame is an out-of-character `talk` gate request with no character, and the user times
   until the `event` frame that carries its own send (matched by a per-send marker in the
   text), not merely the next `event` frame.
2. **Given** a gate refusal of a bench send, **When** the `error` frame arrives, **Then**
   the bench counts it as an error of an existing error kind and does not wait for the
   5-second timeout.
3. **Given** the M0 integration tests T009–T034, **When** they run, **Then** each sends
   `talk` gate requests (public, or with a per-user `visibility` for the restricted cases)
   and asserts the same property it asserted before.

---

### Edge Cases

- **Historical uncatalogued rows.** Logs written before this change may hold `chat`,
  `load-bench-ping` and other M0 rows (local stacks, the hosted `dev` database). Retirement
  is write-side only. Replay still delivers those rows by `canSee`, and projections still
  skip them. No migration deletes or retypes them (the log is append-only).
- **The session-model "unknown and invalid" fixture** keeps its uncatalogued rows; it
  tests the read side, which is unchanged.
- **`talk` is both a gate request kind and a catalogued type.** The gate row still wins.
- **A refused uncatalogued send with a non-object payload or a bad `payloadVersion`.** The
  type check comes first: the refusal is the uncatalogued refusal, whatever the payload.
- **Frame parsing.** `parseInboundFrame` still accepts any non-empty `eventType` string;
  the frame shape is unchanged. The refusal happens in the gateway's classifier, after
  parsing.
- **Bench sends under concurrency.** Several users appending to one session can make the
  gate's `expectedLastSeq` guard retry; a `CONFLICT` refusal surfaces as an `error` frame
  (User Story 3, scenario 2).
- **Presence.** Untouched. `presence.recorded` is written by the gate per DM turn, not
  through `send`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST refuse every `send` whose `eventType` is neither a gate
  request kind nor a catalogued type, with an `error` frame to the sender only, writing
  nothing and broadcasting nothing. The connection MUST stay open. The frame MUST be
  `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }` (ruling OQ1 = A).
- **FR-002**: Handling of gate request kinds and of other catalogued types MUST be
  unchanged from `specs/029-proposal-gate/contracts/ws-delivery.md`.
- **FR-003**: `appendUncataloguedEvent` MUST be removed from
  `apps/server/src/session/events.ts`, along with every import and call of it.
- **FR-004**: The write-boundary checker MUST drop `appendUncataloguedEvent` from its
  writer bindings and drop `ws/gateway.ts` from its allowed writers. The checker MUST still
  report zero violations on `src/` and exactly the three seeded violations on the fixture
  tree.
- **FR-005**: The load bench's WebSocket send MUST use an out-of-character `talk` gate
  request with `characterId: null`, `payloadVersion` 1, and a per-send marker in `text`.
  It MUST time the round trip to the `event` frame carrying that marker. An `error` frame
  MUST end the wait and count as an error. The results file format and profile schema MUST
  NOT change.
- **FR-006**: Every M0 gateway integration test that sent an uncatalogued type MUST send a
  `talk` gate request instead and assert the same property. One new test MUST prove
  FR-001 (refusal, no row, no broadcast to a second subscriber).
- **FR-007**: The frame shapes in `docs/wiki/ws-protocol.md` and
  `specs/006-ws-gateway/contracts/ws-protocol.md` MUST NOT change. No new frame type, no
  new field.
- **FR-008**: The wiki notes `websocket-gateway`, `ws-protocol`, `proposal-gate` (and
  `session-model`, `event-log` where they name the legacy path) MUST describe the
  two-row classifier and drop every "TASK-0099 retires this" pointer, re-pinned honestly.
- **FR-009**: The frozen contracts MUST be amended exactly as rulings OQ2, OQ3 and OQ4
  state, and nowhere else.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST still drive every table write through the
  same `send` frame a browser uses; this feature removes a raw path, not the interface.
- **CR-004** (IV/VI. Gate and engine boundary): After this feature no socket client can
  write a session-log row except through the proposal gate, which owns mechanics through
  the 5e engine. The write-boundary test MUST prove it structurally.

CR-002 (content contract), CR-003 (citations) and CR-005 (operator-owned content) do not
apply: this feature creates no entity, draws nothing from the library, and ships no
content.

### Key Entities

- **Send classification**: the gateway's per-frame decision. After this feature it has
  one accepting outcome instead of two: gate request → gate; anything else → refused
  (catalogued non-request types with `CATALOG_TYPE_REQUIRES_GATE`, uncatalogued types per
  FR-001).
- **Write-boundary allow-list**: the writer bindings and their allowed importers in
  `contracts/write-boundary.md` and `test/helpers/import-graph.ts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero session-log rows result from any socket `send` whose type is not
  catalogued (proved by an integration test on the task's own stack).
- **SC-002**: Zero references to `appendUncataloguedEvent` remain in `apps/` and
  `packages/` source and tests.
- **SC-003**: The load bench `concurrency-smoke` case passes with zero errors and reports
  a round-trip p95.
- **SC-004**: The full gateway integration suite passes with `REQUIRE_DATABASE=1`, with the
  same number of M0 property tests as before plus the refusal test.
- **SC-005**: `pnpm ci:check`, the wiki freshness gate and the spec-bridge gate are green.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 The WebSocket send path refuses every uncatalogued event type. | FR-001, FR-002, FR-006 (refusal test); User Story 1; SC-001 |
| #2 `appendUncataloguedEvent` and its write-boundary allow-list entry are removed. | FR-003, FR-004, FR-009; User Story 2; SC-002 |
| #3 The load bench and any remaining M0 sender use a catalogued type or are retired, and their tests pass. | FR-005, FR-006; User Story 3; SC-003, SC-004 |

## Operator rulings (2026-10-27)

The operator's words, recorded on TASK-0099: "I accept the defaults on the TASK-0099 and
TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006."

| Question | Ruling |
|---|---|
| OQ1 | Option A: `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }`. |
| OQ2 | Amend 029 `ws-delivery.md` send-table row 3, plus an "Amended by spec 043 (TASK-0099)" line. |
| OQ3 | Amend 029 `write-boundary.md` rules 3 and 4 as listed, plus an amendment line. |
| OQ4 | Add the amendment note to 006 `ws-protocol.md`. The `send` example stays `"chat"`. |

## Open Questions (resolved — kept as the record of what was asked)

The brief and the runbook make each item below an operator checkpoint: a client-visible
change to `send` handling is a ws-protocol change, and `specs/029-proposal-gate/contracts/`
is frozen. None of these contracts says that TASK-0099 removes its text (only 029's
`research.md` R8 and `spec.md` OQ2, which are not contracts, name the follow-up), so the
"solely deleting a self-declared deferral" exception does not apply.

**OQ1 — the refusal frame for an uncatalogued `send` (ws-protocol, client-visible).**
Today the server appends and broadcasts; after this card it refuses. The `error` frame
shape is unchanged (`kind`, `message`, optional `code`); the new behaviour and the code
value are the ruling.

| Option | Refusal | Implication |
|---|---|---|
| A (default) | `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }` | A distinct, stable code; `validation` matches "the request names nothing the server knows". |
| B | `error { kind: "forbidden", code: "CATALOG_TYPE_REQUIRES_GATE" }` | Reuses one code for every non-gate send; misleading, since the type is not catalogued. |
| C | `error { kind: "validation" }`, no `code` | No new code value; clients cannot tell this refusal from a malformed frame. |

**OQ2 — `specs/029-proposal-gate/contracts/ws-delivery.md` (frozen).** Replace the send
table's third row ("anything else | `appendUncataloguedEvent`, then broadcast, exactly as
M0") with the OQ1 refusal, and add one line: "Amended by `specs/043-retire-uncatalogued-send`
(TASK-0099): the uncatalogued append is retired." No other text changes.

**OQ3 — `specs/029-proposal-gate/contracts/write-boundary.md` (frozen).** This is the
change the card's AC #2 names. Exact edits:

1. Rule 3, the `session/events.ts` bindings list: delete `appendUncataloguedEvent`.
2. Rule 3, the allowed-importers table: delete the row `| appendUncataloguedEvent | ws/gateway.ts |`.
3. Rule 4: change "For every allowed writer (`session/**`, `gate/**`, `ws/gateway.ts`)" to
   "For every allowed writer (`session/**`, `gate/**`)".
4. Add one line: "Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): the legacy
   writer and its allow-list entry are removed."

**OQ4 — `specs/006-ws-gateway/contracts/ws-protocol.md` (frozen; prose only).** Its
"Extended by spec 029" note says "else uncatalogued append". Add one note beneath it:
"Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): an uncatalogued `eventType`
is refused (OQ1); no frame shape changes." The `send` example's `"eventType": "chat"` is
illustrative; the default leaves it, and the ruling may instead replace it with `"talk"`.

No new runtime dependency, no migration, and no deferral are expected. `speckit-clarify`
was not run: the only open points are the operator rulings above, which a clarify pass
cannot settle.

## Assumptions

- TASK-0047's play route is the only browser sender, and it sends only gate request kinds
  (verified in `apps/web/app/play/frames.ts`).
- TASK-0051 (spec 035, merged) left the send classifier as spec 029 defined it; its
  gateway changes are presence-only.
- An out-of-character `talk` with no character is permitted for any human at the table and
  routes `direct` (`packages/session-model/src/gate/permissions.ts`, `policy.ts`), so the
  bench's seeded users need no seat or character.
- A human `talk` row enqueues no DM job (`apps/server/src/dm/enqueue.ts` triggers on
  commits, AI-proposal decisions and human comments only), so the bench adds no DM work.
- The bench's error-kind keys are fixed (`specs/021-load-bench/data-model.md`); an
  `error` frame maps to `ws_refused` (plan.md, research R3).
