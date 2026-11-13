# Feature Specification: Narration streams to clients

**Feature Branch**: `task-0298-narration-stream`
**Created**: 2026-11-12
**Status**: Draft
**Board**: TASK-0298 (parent epic TASK-0258; gap G1, runbook finding F5, CP-5 ruling 2026-11-08)
**Runbook**: `docs/design/r1-fast-table-runbook.md` (lane LN, after TASK-0272; checkpoint C-GATE)

## Upstream artifacts this spec was authored against

| Artifact | Commit |
|---|---|
| `specs/103-prose-slots/plan.md` (check node D2, slots, one narrate call) | `39c9ed24` (dir head `5064cba6`) |
| `specs/098-fact-sheet/plan.md` and `contracts/fact-sheet.md` (§5 slots and composition) | `a370041c` |
| `specs/100-spatial-events/plan.md` (zone fog, per-viewer `spatial`) | `16ae6147` |
| `specs/066-one-chat-stream/plan.md` (frozen-contract amendment precedent, C-7) | `797971db` |
| Branch base (`origin/main`) | `3f85a1bd` |

`speckit-clarify` was skipped. The card, constitution III, VII and IX, and spec 103's check node
settle the behaviour. The judgment calls left are listed under Open questions.

## Summary

The AI gateway already streams text. `dm/pipeline/call.ts` `collect()` joins every delta before
`narrate` returns, `check` runs on the whole slots, and `submitNarration` ships one `narration`
row. Nothing reaches a client until the row lands. R1 exit criterion 2 and constitution IX need
the first narration token under 10 s p50, and the demo rule says narration never blocks the next
turn.

This feature streams **checked** prose to every permitted viewer over a new server-to-client
frame, `narration-stream`. The settled `narration` row is unchanged and stays the only durable
record.

## Design decision: streaming and the check

The check node (spec 103 D2) is pure and works per sentence. A leak or a digit drops a sentence.
Raw token streaming would send a leaking sentence before the check sees it, which breaks
constitution III ("A client MUST NOT receive information its viewer may not see").

**Chosen: stream per checked sentence (option A).** Narrate feeds each model delta to a pure
stream parser. The parser emits a sentence only when that sentence is complete and has passed
the same digit drop and the same `checkNarration` leak and digit rules the check node applies.
The last, still-growing sentence of a slot is always held. Per slot:

- `rows` — the code-rendered fact rows and State line. Emitted once, before the model call.
- `restate` — emitted once, when the slot closes, after the `parseSlots` restate rule (digit or
  empty falls back to the code restate).
- `describe` — emitted sentence by sentence as each one settles.
- `ask` — emitted once, at stream end, after the `parseSlots` ask rule (one question, or the
  code-settled `sheet.ask`).
- `end` — always sent when the turn job finishes, whether or not a row shipped.

**Invariant:** the streamed text of each slot is a prefix of that slot's settled text. A
sentence the check drops is never streamed, because the stream runs the same check first. When
the parser cannot prove a candidate extends what it already sent (a split changed under a late
quote, the 1200-character cap, a stock ending), it stops streaming that slot and holds the rest
(fail closed).

**What a viewer sees if a streamed sentence is later dropped:** by construction, nothing is
dropped after streaming. In the residual case (the settled split differs from the streamed split),
the text the viewer saw had itself passed the leak and digit check, so nothing hidden was sent. The settled `narration` row is still authoritative. When it arrives,
the client removes the streaming block and renders the row in its place. Any divergence shows as
that one replacement, never as leaked text. Corrections ship as today (spec 103).

Rejected: (B) stream only describe and ask after a per-sentence check — A is B plus code-written
rows and restate; (C) stream to the DM view only — fails AC #1 for players; (D) hold and flush
the whole reply after the check — no first token before the model ends, so it fails IX.

## User Scenarios & Testing

### User Story 1 - Prose streams while the model writes (Priority: P1)

A player confirms an attack. The fact rows appear at once. The DM's describe text then grows
sentence by sentence. The settled reply replaces the growing block when it lands.

**Independent test:** a fake gateway yields a narrate reply in small deltas. The test asserts
the frame order (`rows`, `restate`, `describe` parts, `ask`, `end`) and that the joined parts
equal the settled slots.

**Acceptance scenarios:**

1. **Given** a turn with a fact sheet, **When** narrate starts, **Then** every subscriber gets a
   `rows` part before the gateway `chat()` is called.
2. **Given** a describe slot of three sentences, **When** the model emits them, **Then** each
   sentence is sent once its successor starts, and the last one at stream end.
3. **Given** a describe sentence that names a fogged zone or DM-only seed text, **When** it
   completes, **Then** no frame carries it and the settled row omits it.
4. **Given** a describe sentence with a digit, **When** it completes, **Then** no frame carries it.
5. **Given** a reply that opens with a `<think>` block, **When** it streams, **Then** no frame
   carries any think text.

### User Story 2 - Late joiner (Priority: P1)

A player reconnects while the DM narrates. The client replays the log, gets `replay-complete`,
then gets the in-flight stream parts so far, then the live parts. After the stream ends the
client shows the settled `narration` row.

### User Story 3 - The table keeps moving (Priority: P1)

While the narrate call is mid-stream, the next player sends an Intent. The gate records it. The
next turn queues behind the running job as today.

### Edge cases

- The narrate call fails: `rows` was sent, then `end`. The settled row ships rows only (spec 103).
- A reclaimed job re-runs narrate: a new `jobId` starts a new stream; the client drops the old one.
- A reclaim that finds landed narration skips narrate: only `end` is sent.
- A worker dies mid-stream: no `end` arrives. The server drops the in-flight buffer after
  `LEASE_MS` without a part; the client drops the block when the next `ai:dm` narration row lands
  or on resubscribe.
- A talk turn (`dm.react`) does not stream (Open question OQ-3).

## Requirements

- **FR-001** `callText` accepts an optional `onText(delta)` callback and reports `firstTokenMs`,
  the time from the call start to its first text delta.
- **FR-002** A pure module `apps/server/src/dm/narration-stream.ts` turns deltas into slot parts.
  It reuses `parseSlots` tag rules, `sentencesOf`/`dropSentences`, the digit drop and
  `checkNarration`. It holds a slot's last sentence, strips a leading think block, never emits
  text after an unclosed opening quote, and stops a slot at `MAX_PROSE_CHARS`.
- **FR-003** The joined parts of each slot are a prefix of that slot's settled text. A property
  test covers every narrate fixture.
- **FR-004** Narrate sends the `rows` part before it calls the gateway.
- **FR-005** Stream parts carry the settled row's visibility (`public`). The registry filters each
  part with `canSee(viewerFor(conn, seat), visibility)`, the same rule as events.
- **FR-006** A connection mid-replay receives no live part. After its `replay-complete` it receives
  the in-flight parts of its session, then live parts.
- **FR-007** The worker sends `end` when a turn job finishes, on every outcome.
- **FR-008** The gate accepts an Intent while narrate streams. Narrate holds no gate queue entry
  and no floor.
- **FR-009** The check record stores `firstTokenMs`, `firstProseMs` and `firstProseAt` per narrate
  job in `jobs.result.checkpoint.narration.check`. A log line `dm.narrate.first-token` carries the
  same values. No migration.
- **FR-010** The web client renders the in-flight stream as one transcript block after the last
  row. The settled `narration` row replaces it. The block is announced politely and says
  "The DM is narrating" in words.

## Acceptance criteria map

| Card AC | Requirements | Proof |
|---|---|---|
| #1 Prose slots stream to every permitted viewer as partial frames while the model writes. | FR-001–FR-005 | Stream parser unit tests; property test (prefix invariant); leak and digit tests; ws test: two players and a DM all receive parts, filtered by `canSee`. |
| #2 Fact rows render before the first prose token and never wait for narration. | FR-004, FR-006, FR-010 | Narrate test: the `rows` part precedes the `chat()` call; ws test: a late joiner gets `rows` after `replay-complete`; fact-sheet test: every digit in any part lies in a code-rendered row or the State line (runbook narration-PR gate, constitution VII). |
| #3 A viewer that joins mid-stream sees the settled slot text after the stream ends. | FR-006, FR-007, FR-010 | ws test: subscribe mid-stream, then `narration` event, then `end`; web reducer test: the block is replaced by the row. |
| #4 The next turn's Intent is accepted while narration still streams, with a test. | FR-008 | DB integration test: a fake gateway pauses mid-narrate; `gate.handle` of an `intent` returns ok in free mode and for the floor holder in turn mode; release; narration ships. |
| #5 Time to first narration token is recorded per narrate job. | FR-001, FR-009 | Narrate test reads the check record fields; call test for `firstTokenMs`. |

## Success criteria

- **SC-001** On fixture tables the first `describe` part leaves the server before the narrate call
  ends (fake gateway with deltas).
- **SC-002** No stream part ever carries a sentence the check node drops (property test).
- **SC-003** Hosted p50 of `firstProseAt` minus trigger row `ts` is under 10 s (measured by
  TASK-0278, not this PR).

## Out of scope

- A durable fact-rows row ahead of narration (OQ-1).
- Streaming talk-turn replies, companion or chronicle text (OQ-3).
- Cross-process fan-out: the worker and the WebSocket gateway share one process today.

## Open questions

- **OQ-1 — Durable split of fact rows.** Spec 103 handed "rows before narration as a separate
  row" to this task. A separate `narration` row before narrate breaks `findLandedNarration`,
  `checkpoint.narration.seqs`, playtest segments (`isDmNarration`) and the auditor's prose/dice
  split. **Recommend:** meet AC #2 with the ephemeral `rows` part plus the in-flight replay to late
  joiners (FR-006). Card a durable split only if a playtest shows a reconnecting viewer missing
  rows; revisit trigger: CP-7 playtest findings.
- **OQ-2 — Opt-in for the new frame.** Presence was opt-in. The web reducer ignores unknown frame
  types by design. **Recommend:** no opt-in. Every client gets `narration-stream`; a client that
  does not know it ignores it.
- **OQ-3 — Talk turns.** `talk-turn.ts` ships a `dm.react` reply, not prose slots. **Recommend:**
  out of scope for AC #1 (the card says prose slots). Card it if the playtest shows talk replies
  over 10 s.
- **OQ-4 — Transcript order when an Intent lands mid-stream.** The new Intent row gets a lower seq
  than the narration row that settles after it. **Recommend:** keep seq order. The streaming block
  sits after the last row, so the viewer sees the Intent above the growing narration; the settled
  row then lands below the Intent.
