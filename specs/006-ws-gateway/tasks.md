---

description: "Task list for the WebSocket gateway"
---

# Tasks: WebSocket gateway with event-log append and cursor replay

**Input**: Design documents from `/specs/006-ws-gateway/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. FR-015 and board AC#7 mandate tests for append-on-message, fan-out,
and replay from a cursor. Integration tests use **real WebSocket clients against a real
listening server and a real Postgres** — fan-out and the replay boundary are not observable
through a mocked socket, and this project has already paid once for testing only through
fakes (the T016 finding).

**Organization**: Grouped by user story. US1–US3 are all P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md
- Exact file paths in every task

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Add `ws` and `@types/ws` to `apps/server/package.json` and run `pnpm install`. This is the constraints table's own Server row, not a new choice
- [x] T002 Define the frame schemas in `apps/server/src/ws/protocol.ts` with Zod, per contracts/ws-protocol.md: `subscribe`, `send` inbound; `event`, `replay-complete`, `error` outbound
- [x] T003 [P] Write `apps/server/test/ws.protocol.test.ts` (no socket, no database): valid frames parse, malformed JSON is refused, an unknown `type` is refused, and **a `send` carrying `actor`/`seq`/`ts` parses with those fields ignored** (data-model.md — a client sending them is confused, not hostile)

**Checkpoint**: frames validate. T003 passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The server exists and authenticates. Every user story needs both.

⚠️ No user story can start until this phase completes.

- [x] T004 Attach a `ws` server to the existing HTTP server in `apps/server/src/index.ts`, sharing one port and one process (FR-001, architecture A2)
- [x] T005 Implement upgrade-time authentication in `apps/server/src/ws/gateway.ts`: extract the session token from the upgrade request's cookie header, call spec 005's `validateSession`, and **refuse the upgrade** on `null` (research D4). The socket must never open unauthenticated
- [x] T006 Distinguish the two refusals in `apps/server/src/ws/gateway.ts`: `401` for an invalid session, `503` when validation **throws** (datastore unreachable). A client retries these differently, and treating a database blip as "signed out" logs users out spuriously (FR-013)
- [x] T007 Implement the subscriber registry in `apps/server/src/ws/registry.ts`: `sessionId` → set of connections, with removal on disconnect and deletion of empty sets so a long-running process does not leak an entry per session ever visited
- [x] T008 [P] Build the integration test harness in `apps/server/test/ws.integration.test.ts`: starts a real server on an ephemeral port, opens real `ws` clients, and reuses spec 004's **loud-skip** pattern when no database is reachable

**Checkpoint**: an authenticated client can open a socket; an unauthenticated one cannot.

---

## Phase 3: User Story 1 — Say something and have everyone see it (Priority: P1) 🎯 MVP

**Goal**: A message from one client reaches every subscriber of that session, in order.

**Independent test**: Two clients, one session; send from one, observe at the other.

### Tests for User Story 1

- [x] T009 [US1] Test fan-out: two subscribers to one session both receive a message sent by one of them — **including the sender** (contracts/ws-protocol.md: one path for everyone)
- [x] T010 [US1] Test session isolation: a subscriber to session A receives nothing when a message is sent in session B (FR-008)
- [x] T011 [US1] Test durability: after delivery, reading the log finds the event (SC-002) — delivery and durability are the same act
- [x] T012 [P] [US1] Test ordering: several concurrent senders, and every subscriber observes the same sequence (FR-007)

### Implementation for User Story 1

- [x] T013 [US1] Handle the `send` frame in `apps/server/src/ws/gateway.ts`: validate the envelope, then **append through spec 004's `append` BEFORE broadcasting** (FR-004). Never the reverse — a broadcast that precedes the append can deliver what was never recorded
- [x] T014 [US1] Set `actor` from the connection's authenticated identity, never from the frame (FR-005). Let the log assign `seq` and `ts` (FR-006)
- [x] T015 [US1] Implement fan-out in `apps/server/src/ws/registry.ts`, sending the `event` frame to each subscriber of that session

**Checkpoint**: the realtime channel works. US1 tests pass.

---

## Phase 4: User Story 2 — Only the server decides what happened (Priority: P1)

**Goal**: A client cannot forge history.

**Independent test**: Send malformed input, input claiming another actor, and input
specifying its own position — each refused or overridden, with nothing spurious in the log.

### Tests for User Story 2

- [ ] T016 [US2] Test that a malformed frame produces an `error` frame, the connection **stays open**, and nothing is appended (FR-003)
- [ ] T017 [US2] Test that a `send` claiming a different `actor` records the **connection's** identity (FR-005, SC-004)
- [ ] T018 [US2] Test that client-supplied `seq` and `ts` are ignored and the server's values are used (FR-006)
- [ ] T019 [US2] **Test that a refused message leaves no trace**: read the session's stream afterwards and assert no gap and no stray event (US2 scenario 4)

### Implementation for User Story 2

- [ ] T020 [US2] Implement the `error` frame path in `apps/server/src/ws/gateway.ts` per contracts/ws-protocol.md, keeping the connection open — one bad frame is not a reason to disconnect a client that may immediately send a good one

**Checkpoint**: the log is a record of what the server decided, not what clients claimed.

---

## Phase 5: User Story 3 — Come back and miss nothing (Priority: P1)

**Goal**: Reconnect replays from a cursor with no gap and no duplicate.

**This phase contains the feature's one subtle algorithm.** Read research D1 before starting.

**Independent test**: Connect, receive events, disconnect, have more events happen, reconnect
from the last position seen, receive exactly the missed ones then live ones.

### Tests for User Story 3

- [ ] T021 [US3] Test basic replay: subscribing from position N delivers every event after N in order, and none at or before N
- [ ] T022 [US3] **Test the boundary — the load-bearing test.** Subscribe from a cursor **while another client is actively sending**, and assert the subscriber's received positions are ascending, contain no duplicate, and contain **no gap** between the replayed and live ranges (SC-003, quickstart step 2)
- [ ] T023 [US3] **Prove T022 has teeth.** Temporarily reorder the implementation to replay-then-subscribe, watch T022 fail (events appended in the window are lost), restore. Record the observed failure. A test that passes either way manufactures confidence
- [ ] T024 [P] [US3] Test subscribing with no cursor delivers history from the beginning, and subscribing from the newest position delivers nothing and is simply live (US3 scenarios 3–4)

### Implementation for User Story 3

- [ ] T025 [US3] Implement the boundary in `apps/server/src/ws/subscribe.ts` per research D1: join the registry **with delivery queued**, replay via `readFrom` in bounded batches, then drain the queue skipping positions the replay already covered, then switch to direct delivery
- [ ] T026 [US3] Deliver replay in **bounded batches**, never one unbounded read (FR-010) — one reconnecting client with a long history must not be able to exhaust the server
- [ ] T027 [US3] Send `replay-complete` once, after the last replayed event and before live delivery (contracts/ws-protocol.md)

**Checkpoint**: reconnect is exactly-once. T023 has proven the boundary test detects regressions.

---

## Phase 6: User Story 4 — See only what you are meant to see (Priority: P2)

**Goal**: A filtered event is never sent, not hidden client-side.

### Tests for User Story 4

- [ ] T028 [US4] Test that a public event reaches every subscriber
- [ ] T029 [US4] Test that a restricted event reaches only its intended recipient, and **nothing is sent in its place** to others (FR-011)
- [ ] T030 [US4] Test that **replay applies the same filtering** — replay must not be a way to receive what live delivery withheld (US4 scenario 3). Two filtering points is how the paths drift, and that drift is a disclosure bug
- [ ] T031 [P] [US4] Test that a filtered recipient's received positions may have **gaps**, and that this is correct (US4 scenario 4, research D2)

### Implementation for User Story 4

- [ ] T032 [US4] Implement per-recipient filtering at the **single send point** in `apps/server/src/ws/registry.ts` (research D2), so live and replayed events pass through exactly one decision

**Checkpoint**: all four user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T033 Implement per-socket send isolation in `apps/server/src/ws/registry.ts` (research D5): catch and discard per-socket failures, remove closed sockets. **Do not `Promise.all` the sends** — one dead client would deprive everyone of an event the log already holds
- [ ] T034 Test that killing a subscriber abruptly mid-broadcast leaves the remaining subscribers receiving the event (FR-012, SC-007)
- [ ] T035 Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` and paste literal output into the PR body — the evidence standing in for the CI TASK-0017 has not built
- [ ] T036 Run `quickstart.md` end to end, including the boundary check (step 2) and the authority checks (step 3)

### Constitution Compliance (the-stacks)

- [ ] T037 Events versioned with visibility set where information is hidden (Principle IV) — verified by T028–T031
- [ ] T038 Projection tolerates unknown and future event types (Principle IV) — the gateway never interprets a payload, so an unknown type is delivered unchanged
- [ ] T039 Agent-facing interface exercised by a test, not only a human path (Principle I) — every test drives the protocol directly, with no browser
- [ ] T040 `docker compose up` still works from a clean clone (Principle IX)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies
- **Phase 2 (Foundational)** → depends on Phase 1. **Blocks every user story.**
- **Phase 3 (US1)** → depends on Phase 2
- **Phase 4 (US2)** → depends on Phase 3 (refusal is tested against the send path US1 builds)
- **Phase 5 (US3)** → depends on Phase 3
- **Phase 6 (US4)** → depends on Phase 3 and Phase 5 (filtering must cover both paths)
- **Phase 7 (Polish)** → depends on all

### Consumed seams — do not reimplement

- **spec 004** `append`/`readFrom` — ordering, gaplessness, and race-safety are already
  solved and measured. Never write to or read `events` directly.
- **spec 005** `validateSession` — never parse tokens or check expiry here.

### Parallel Opportunities

- T003, T008, T012, T024, T031 are independent.
- **T025 and T032 do not parallelize** with their own phases' tests — the tests exist to
  catch what these get wrong.

## Implementation Strategy

### MVP scope

**Phases 1 + 2 + 3 (US1)** delivers a working realtime channel. Phase 5 (US3) makes it
survive a reload, which the milestone demo requires.

### Incremental delivery

Each phase leaves the feature working and testable.

## Notes

- **T023 is not optional.** The replay boundary is the one algorithm here that is subtly
  wrong in the obvious implementation, and a test that passes against the broken version is
  worse than none. Spec 004's T020 and spec 005's T036 set this precedent.
- **Test through real sockets.** A mocked socket cannot exhibit fan-out to a dead peer, and
  cannot exhibit the replay boundary at all.
