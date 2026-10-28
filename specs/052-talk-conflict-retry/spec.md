# Feature Specification: Talk CONFLICT retry

**Feature Branch**: `task-0157-talk-conflict-retry`

**Created**: 2026-10-27

**Status**: Ready for planning — Q1–Q6 resolved 2026-10-27 (see "Open questions")

**Input**: User description: "Spec dir already exists: specs/052-talk-conflict-retry (TASK-0157). Several humans talking at once must never see a CONFLICT refusal for a talk request; document the gate's retry policy in the gate contract."

**Board task**: TASK-0157. **Milestone**: M3. **Must land before**: the M3 demo (TASK-0053), which seats three humans at one table.

## Background and root cause

TASK-0099 (spec 043, commit 92e0a14) moved the WebSocket integration tests (T012, T021) and the
`concurrency-smoke` load bench off the retired uncatalogued append and onto `talk` gate
requests. The tests began to see `CONFLICT` refusals and gained a resend-on-`CONFLICT` helper
(`sendTalkAndAwait` in `apps/server/test/ws.integration.test.ts`). The old path appended without
an expected-sequence guard, so it never conflicted.

The mechanism, read from the code:

1. One attempt of every gate request (`apps/server/src/gate/gate.ts`, `attempt`) folds the
   session's whole DM projection (`loadProjections`) and takes `lastSeq = p.throughSeq`.
2. It plans, then appends with `expectedLastSeq: lastSeq` (`appendBatch`,
   `apps/server/src/events/log.ts`). Under the per-session advisory lock the log compares that
   value with the session's current maximum `seq`. Any other append in between throws
   `SeqConflictError`, and zero rows land.
3. `run` retries immediately, with no backoff, at most `MAX_ATTEMPTS = 3` times
   (`gate.ts:100`), then refuses `CONFLICT` ("the log kept changing; try again").
4. The WebSocket gateway handles each socket's messages concurrently and maps `CONFLICT` to an
   `error` frame of kind `internal` (`apps/server/src/ws/gateway.ts`, `errorKindFor`).

So every gate request in one session is an optimistic transaction over the whole log. The
conflict window is one full projection fold, which grows with the log. A `talk` line depends on
almost nothing in that projection (only character control, for an in-character line), yet it
races every other write. With k concurrent writers each attempt loses to any of the others, and
three straight losses refuse the line. Every writer in the current topology shares one gate
instance in one process (`apps/server/src/index.ts:62`: the WebSocket gateway and the DM worker),
so every one of these conflicts is between requests in the same process.

**Reproduction (2026-10-27, this worktree's test database, direct `gate.handle` calls, no
network).** Scratch script, not committed:

| Senders | Lines per sender | In flight per sender | Prior log length | Landed | `CONFLICT` |
|---|---|---|---|---|---|
| 3 | 5 | 1 | 0 | 11 | 4 (27%) |
| 3 | 5 | 5 | 0 | 4 | 11 (73%) |
| 3 | 20 | 1 | 500 | 48 | 12 (20%) |
| 5 | 20 | 1 | 500 | 59 | 41 (41%) |
| 3 | 10 | 5 | 500 | 8 | 22 (73%) |

The same script with each session's gate requests chained one after another in process (a
per-session queue in front of `gate.handle`) landed every line with zero `CONFLICT` in all five
rows, at comparable wall time (65–833 ms against 69–650 ms).

Over WebSocket on this machine, three runs of `ws.integration.test.ts` and two runs of
`concurrency-smoke` saw no `CONFLICT`: socket latency spreads the sends out. The refusal is
timing-dependent, which is why TASK-0099 saw it and this run did not. It is real at the gate.

**What a player sees today.** The composer clears its draft as soon as the frame leaves the
socket (`apps/web/app/play/components/composer.tsx`). A later `CONFLICT` sets the table notice
to "the log kept changing; try again (CONFLICT)" (`reduce-frame.ts`; `labels.ts` has no plain
wording for the code). The player's line is gone and must be retyped. Nothing double-lands: a
`CONFLICT` writes zero rows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Three players talk at once and every line lands (Priority: P1)

Three humans sit at one table and type at the same moment. Each line appears once, for
everyone, in one shared order. No player sees a "try again" notice and no player loses a line.

**Why this priority**: the M3 demo seats three humans at one table. A lost line with a technical
notice is the first thing a demo audience would see.

**Independent Test**: run at least 3 concurrent human talk senders against one session, with
more than one line in flight per sender, and assert that every line lands exactly once, that no
sender receives a `CONFLICT` error frame, and that every subscriber sees the same order.

**Acceptance Scenarios**:

1. **Given** a session with three connected human players, **When** each sends 5 talk lines
   concurrently with no wait between them, **Then** all 15 lines land exactly once, no sender
   receives an `error` frame, and both subscribers see the same gapless sequence.
2. **Given** a session whose log already holds 500 events, **When** five players each send 20
   talk lines concurrently, **Then** every line lands exactly once and no sender receives
   `CONFLICT`.
3. **Given** the DM worker is writing a turn while players talk, **When** both write to one
   session, **Then** every player line and every DM write lands, and neither side is refused
   `CONFLICT`.

---

### User Story 2 - The retry policy is written down where the gate's rules live (Priority: P2)

A maintainer reading the gate contract learns exactly what the gate does when two writes race:
how requests in one session are ordered, how many attempts it makes, whether it waits between
them, and when a caller can still receive `CONFLICT`.

**Why this priority**: the current contract says only "after the third conflict, refuse
`CONFLICT`". The next change to concurrency must start from a written policy, not from code.

**Independent Test**: read `specs/029-proposal-gate/contracts/gate-api.md`; it states the
policy in an amendment block, and the gate integration tests assert each stated rule.

**Acceptance Scenarios**:

1. **Given** the amended gate contract, **When** a maintainer reads the algorithm section,
   **Then** it names the ordering rule, the attempt bound, the wait between attempts and the
   conditions under which `CONFLICT` still reaches a caller.
2. **Given** the gate integration tests, **When** they run, **Then** a test exists for each
   rule the amendment states.

---

### Edge Cases

- **A request in the queue is refused.** A refusal (for example `NOT_AUTHORIZED` or an engine
  code) returns to its sender and does not stall or fail the requests behind it.
- **A request throws.** An unexpected error rejects that request only; the next request in the
  session still runs.
- **Two sessions are busy at once.** Requests in different sessions never wait for each other.
- **A writer outside this process appends** (a second server process, or a script with its own
  gate against the same database). The expected-sequence guard still protects the log. The
  bounded retry is the only defence there; see open question Q3.
- **The presence marker is written during a burst.** `recordPresence` appends without the
  expected-sequence guard but still advances the log's `seq`, so it can make a queued talk
  conflict. It takes part in the same ordering (FR-002).
- **The DM's resolve node retries `CONFLICT` itself** (`dm/nodes/resolve.ts`,
  `CONFLICT_DELAYS_MS = [200, 800]`). That wrapper stays; it becomes a rarely used safety net.
- **The socket drops after the line is sent.** Out of scope: a line either landed (the player
  sees it on replay) or did not. This feature changes no reconnect behaviour.

## Requirements *(mandatory)*

### Functional Requirements

Each requirement names the card acceptance criterion it serves.

- **FR-001** (AC #1): The gate MUST run the gate requests of one session one at a time, in
  arrival order, inside the server process, so that no two requests in one session read and
  append concurrently. *(Q1 ruling: A.)*
- **FR-002** (AC #1): Every write the gate makes MUST take part in that ordering: `handle`,
  `submit` and `recordPresence`.
- **FR-003** (AC #1): Requests in different sessions MUST NOT wait for one another.
- **FR-004** (AC #1): A refusal or thrown error from one request MUST affect that request only.
  The next request in the session MUST still run.
- **FR-005** (AC #1): The gate MUST keep the `expectedLastSeq` guard on every append and MUST
  keep a bounded retry on `SeqConflictError`, so a writer outside the process can never make
  the gate decide against a stale log. The bound MUST stay 3 attempts, with a random wait of
  10–50 ms between attempts and none after the last. Tests MUST be able to inject the wait.
  *(Q3 ruling.)*
- **FR-006** (AC #1): A test MUST run at least 3 concurrent human talk senders, with more than
  one line in flight per sender, against one session over the WebSocket gateway. It MUST
  assert that no sender receives a `CONFLICT` error frame and that every line lands exactly
  once.
- **FR-007** (AC #1): A gate-level test MUST fire concurrent requests at one session through
  `gate.handle` (no socket latency) and assert zero `CONFLICT` refusals. This is the test that
  fails today.
- **FR-008** (AC #1): The resend-on-`CONFLICT` workaround in `ws.integration.test.ts`
  (`sendTalkAndAwait`) MUST be removed, so T012 and T021 fail if a `CONFLICT` ever returns. The
  `concurrency-smoke` bench MUST count a `CONFLICT` as an error, as it does now.
- **FR-009** (AC #2): The gate contract `specs/029-proposal-gate/contracts/gate-api.md` MUST
  carry an amendment block (TASK-0157) that states the per-session ordering, the attempt bound,
  the wait between attempts, and when `CONFLICT` can still reach a caller. Step 7 of "Algorithm
  (one attempt)" MUST point to it.
- **FR-010** (AC #2): The wire contract MUST stay unchanged: `CONFLICT` keeps the `internal`
  error kind (`specs/029-proposal-gate/contracts/ws-delivery.md`) and no frame gains a field.
- **FR-011** (AC #1): The play-route client MUST show a plain-language label for `CONFLICT`
  if one ever reaches it, instead of "the log kept changing". *(Q4 ruling.)*

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM and the playtest seat MUST get the same ordering
  as a human, because they write through the same `gate.submit` and `gate.handle`. No
  human-only path is added.
- **CR-002** (IV. Event-sourced play, server authority): Every write MUST still pass through
  the gate and append only the rows it plans. A refused or conflicted request MUST append
  nothing. The log stays the only state; the per-session queue holds no game state and is lost
  harmlessly on restart.

CR for principles II, III, V, VI, VII, VIII and IX: not applicable. This feature creates no
content entity, cites no library claim, computes no mechanics, ships no rulebook content and
adds no service.

### Key Entities

- **Gate request**: one proposal or supervision request for one session, from one proposer. Its
  outcome is applied, pending, suggested, decided or refused.
- **Session write order**: the order in which the gate runs one session's requests. It is the
  arrival order inside the process, and it decides the `seq` order of the rows they append.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With 3 players each sending 5 lines at once, 15 of 15 lines land and 0 players
  see a "try again" notice, in 20 of 20 consecutive test runs.
- **SC-002**: With 5 players each sending 20 lines at once into a session of 500 prior events,
  100 of 100 lines land with 0 refusals.
- **SC-003**: A line still appears to every player within 1 second of sending under the SC-001
  load, measured as the bench's WebSocket round-trip p95, which stays within the existing
  `concurrency-smoke` threshold.
- **SC-004**: A maintainer can answer "what happens when two writes race?" from the gate
  contract alone, without reading code.

## Open questions

**Resolved 2026-10-27.** The operator ruled in chat, verbatim: "TASK-0157: I accept the
recommended defaults Q1 to Q6, including the per-session gate queue, the jittered retry and the
029 gate-api amendment." The ruling is recorded on the card (commit 8a3105a). Every question
below is closed at its recommended default, and the spec above is written against them.

Each question changed a frozen contract, the wire, or what a player sees.

### Q1 — RESOLVED (recommended default accepted) — Where does the fix live?

| Option | What it does | Cost and risk |
|---|---|---|
| **A. Per-session queue in the gate (recommended)** | The gate chains each session's requests in process, so they never race one another. The `expectedLastSeq` guard and the bounded retry stay for writers outside the process. | Small change in `gate.ts`. Measured: 0 `CONFLICT` in every reproduction row. Throughput per session is unchanged in effect: the advisory lock already serialises appends, and today's lost attempts were wasted folds. Amends gate-api.md step 7. |
| B. Wider retry with jittered backoff | Keep the optimistic race; raise `MAX_ATTEMPTS` (for example to 8) and wait a random 10–50 ms between attempts. | Lowers the rate but never reaches zero; at 5 in flight per sender the loss rate is high enough that even 8 attempts can lose. Each lost attempt re-folds the whole log, so load rises with contention. Amends step 7. |
| C. Client resends on `CONFLICT` | The play-route client keeps the draft and resends the line on a `CONFLICT` error frame. | `error` frames carry no request reference, so with more than one request in flight a client cannot tell which one was refused. Doing it safely needs a client request id on `send` and its echo on `error`: a change to the frozen frame shapes (`docs/wiki/ws-protocol.md`, ws-delivery.md). Fixes only the web client, not the AI DM or other agents (constitution I). |
| D. Talk skips the guard | Append `talk` without `expectedLastSeq`, as `recordPresence` already does. | Fixes talk only; approvals, declarations and floor requests still race. An in-character line checks character control against a stale projection; a control change racing a line could let a line through that the new state would refuse. |

**Recommended default: A.** It is the only option measured at zero refusals, it covers every
request kind and every producer (human, AI DM, playtest seat), and it changes no wire shape.
The card's AC #1 is met on its first branch ("no CONFLICT reaches the client").

### Q2 — RESOLVED (recommended default accepted) — Does the ordering cover every request kind, or `talk` only?

- **All gate writes, including `recordPresence` (recommended).** Approvals, declarations, floor
  passes and DM writes race the same way; ordering only `talk` leaves them refusable and leaves
  presence markers able to break a queued talk.
- `talk` only: the narrowest change, matching the card title, but it keeps a known refusal for
  every other kind at a three-human table.

**Recommended default: all gate writes.** The root cause is shared; the fix should be.

### Q3 — RESOLVED (recommended default accepted) — What residual retry policy stays for writers outside the process?

- **Keep `MAX_ATTEMPTS = 3`, add a short jittered wait (10–50 ms) between attempts
  (recommended).** In the current topology (one server process, `index.ts`) nothing outside the
  process writes, so the retry almost never runs. A small wait stops two processes retrying in
  lockstep if a second process ever appears.
- Keep `MAX_ATTEMPTS = 3` with no wait: the smallest diff; correct today.
- Raise the bound: no evidence it is needed once in-process requests are ordered.

**Recommended default: 3 attempts with a 10–50 ms jittered wait.** The contract states the
numbers, and a gate test injects the wait so tests stay fast.

### Q4 — RESOLVED (recommended default accepted) — What does a player see if a `CONFLICT` still reaches them?

Under the defaults this happens only when a writer outside the process wins three times.

- **A plain label, no resend (recommended).** Add `CONFLICT` to the client's refusal labels
  (for example "The table was busy — your line was not sent. Send it again."). The composer
  behaviour is unchanged.
- Keep the draft until the line's own echo arrives, so a refused line is never lost. This needs
  the client to match an echo to its draft, which runs into Q1 C's missing request reference.
- Silent client resend: rejected for the reason in Q1 C.

**Recommended default: a plain label.** It is a one-line web change with no wire change. Losing
the draft on a refusal that should no longer occur does not justify a protocol change. If the
operator wants the draft kept, that is a separate card (it touches every refusal, not only
`CONFLICT`).

### Q5 — RESOLVED (recommended default accepted) — Can a talk ever double-land?

Not under any option except C without a request id. A `CONFLICT` appends zero rows
(`appendBatch` throws before its first insert, inside the transaction), so a server-side retry
can never land a line twice. Option A adds no resend at all. **Recommended default: no change;
the amendment states that a `CONFLICT` writes nothing and is safe to resend by hand.**

### Q6 — RESOLVED (recommended default accepted) — Does the per-session queue need a depth cap or a wait timeout?

- **No cap, no timeout (recommended).** A table holds a handful of humans plus the DM. The
  measured burst of 100 lines drained in under 1 second. A cap would add a new refusal code,
  which is the problem this card removes.
- A cap with a new refusal (for example `BUSY`): adds a refusal code to the gate contract and the
  client.

**Recommended default: no cap.** The bench's WebSocket round-trip p95 (SC-003) is the alarm if
the queue ever grows.

## Assumptions

- One server process serves a deployment (`apps/server/src/index.ts`, the hosted `dev`
  environment on vm-104). The WebSocket gateway and the DM worker share one gate instance.
- The playtest harness and the load bench build their own gate in their own process. They write
  to their own sessions, not to a live table's session.
- `speckit-clarify` was not run: the open questions above are operator rulings on contract and
  player-visible behaviour, not ambiguities in the description.
- Out of scope: reconnect behaviour, a client request id on the wire, and keeping a draft
  across any refusal.
