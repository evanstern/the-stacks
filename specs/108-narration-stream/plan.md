# Implementation Plan: Narration streams to clients

**Spec**: `specs/108-narration-stream/spec.md` | **Board**: TASK-0298 | **Branch**: `task-0298-narration-stream`
**Upstream plans**: spec 103 `39c9ed24` (dir head `5064cba6`), spec 098 `a370041c`, spec 100 `16ae6147`, spec 066 `797971db`; base `3f85a1bd`.
**Checkpoint**: **C-GATE** — this plan amends frozen frame shapes. The operator rules before the
first implementation dispatch.

## Summary

Narrate feeds model deltas to a pure stream parser. The parser emits checked slot parts. The
worker hands each part to the WebSocket gateway through an injected callback. The registry
filters each part per viewer, buffers the in-flight stream per session for late joiners, and
clears it when the settled `narration` row is published. The web client renders one growing
block that the settled row replaces. Time to first token lands in the check record.

## Technical context

- TypeScript, Node 22, pnpm workspace. Server: `apps/server`. Web: `apps/web` (React Router).
- Tests: vitest (server), node test runner and vitest (web). Fake gateway only; no paid run.
- Transport: the existing `/ws` socket (`ws` package). One process runs the worker and the
  WebSocket gateway (`apps/server/src/index.ts`), so the callback needs no bus.

## Constitution Check (3.0.0)

| Principle | Verdict | Note |
|---|---|---|
| III Event-sourced play, server authority | Pass | The `narration` row stays the only durable record. Stream parts are ephemeral, never appended, filtered per viewer with the same `canSee(viewerFor(...))` as events. A part carries only checked sentences (D2), so no hidden text reaches a client. |
| V Many views, one state | Pass | Every permitted viewer gets the same parts; the settled row replaces them. |
| VII Narration around facts | Pass | The `rows` part is code-rendered and sent before the model call ("Fact rows MUST render before narration and never wait on it"). Parts drop digit sentences; a test proves every digit in any part lies in a row or the State line. The check still runs after narration and appends corrections. |
| IX UX is a quality bar | Pass | Targets "first narration token under 10 s p50". No modal; one inline transcript block; works at 1280 px and 390 px; announced with `aria-live="polite"` and the words "The DM is narrating". |
| I Agent-operable | Pass | The frame is plain JSON on the same socket; an agent client may ignore it. |

No violation. No complexity entry.

## Design

### D1 — `callText` streams and times (`dm/pipeline/call.ts`)

- `CallRequest` gains `onText?: (delta: string) => void`. `collect()` calls it for each `text`
  event, inside a `try` so a throwing observer never breaks the call.
- `collect()` records `firstTokenMs` (ms from the `chat()` call to the first non-empty delta).
  `TextResult` ok gains `firstTokenMs: number | null`. `callJson` ignores both.

### D2 — The stream parser (`dm/narration-stream.ts`, new, pure)

`createNarrationStream(input)` returns `{ push(delta): Part[]; finish(settled): Part[] }`.
`input` is the `FactSheet` plus the `CheckInput` minus `slots` (snapshot, dm-only text, unmet
success, departed ids, `hasRoll`, rows).

- Holds the raw text. Strips a leading `<think>…</think>` and waits while one is open.
- Finds slot tags with the `fact-sheet.ts` `TAG` regex (export it). Text before a tag is
  `describe`, as `parseSlots` does. A slot not in `sheet.slots` emits nothing.
- `describe`: splits the slot text with `sentencesOf` (export it from `narration-check.ts`).
  Every sentence but the last is complete. For each new complete sentence it applies, in order:
  the `parseSlots` digit drop, then `checkNarration` on `{ describe: sentence }` and keeps it only
  when no issue is a `leak` or kind `digit`. It stops the slot (holds the rest) when an opening
  quote is unclosed, when the slot reaches `MAX_PROSE_CHARS`, or when a sentence matches
  `STOCK_ENDING`.
- `restate` emits once in `push`, when a later tag closes it, after the `parseSlots` restate rule
  (empty or digit falls back to `defaultRestate`). `ask` emits nothing in `push`.
- `finish(settled)` takes the check node's kept slots. It emits `restate` if not yet sent, `ask`
  whole, and the rest of `settled.describe` after what was sent — only when the sent describe text
  is a prefix of `settled.describe`. Otherwise it emits nothing more for describe; the settled row
  replaces the block. A per-sentence check that disagrees with the whole-slot check (a
  cross-sentence alias case) therefore fails closed.
- Contradiction issues do not drop text (spec 103 D2), so the stream does not drop them either.

The prefix invariant (spec FR-003) holds because each emitted sentence passes the same rules the
check node applies to the same sentence, and the check node's `dropSentences` only removes
sentences.

### D3 — Narrate, check and runner wiring

- `NodeDeps` gains `streamNarration?: (part: NarrationPart) => void`. `NarrationPart` =
  `{ jobId, slot: "rows" | "restate" | "describe" | "ask" | "end", text }`. Absent means no stream
  (tests, playtest, scripts).
- `narrate` sends `rows` (row texts plus the State line, joined by `\n`) right after
  `buildFactSheet`, before `narrateAttempt`. It passes `onText` to `callText` that pushes into the
  parser and forwards each part. The node output gains `stream` (the parser) and `timing:
  { firstTokenMs, firstProseMs }`; `firstProseMs` is ms from narrate start to the first prose part.
- `check` calls `stream.finish(kept)` and forwards the parts. `CheckRecord` gains optional
  `firstTokenMs`, `firstProseMs` and `firstProseAt` (ISO). `check` logs
  `dm.narrate.first-token` with `jobId`, `sessionId` and the three values.
- The runner is unchanged except the reclaim path that skips narrate: it sends nothing.
- `worker.ts` builds `streamNarration` from a new `DmWorkerDeps.onNarrationStream(sessionId,
  part)` and sends `{ slot: "end" }` in a `finally` around each turn job. `index.ts` wires it to
  `gateway.streamNarration`.

### D4 — Delivery (`ws/registry.ts`, `ws/subscribe.ts`, `ws/gateway.ts`)

- `registry.streamNarration(sessionId, frame)`: keeps one in-flight buffer per session
  `{ jobId, frames[] }`. A new `jobId` replaces the buffer. Sends to every open connection that is
  not mid-replay and passes `canSee(viewerFor(conn, seat), "public")`. On `end` it sends and then
  deletes the buffer. The buffer is deleted with the session's last subscriber, like the seat.
- `gateway.publish`: before broadcasting an event of type `narration` by `ai:dm`, calls
  `registry.endNarration(sessionId)`, which sends `end` for the in-flight job and deletes the
  buffer. One process, one thread: the settled row and the end leave in that order for everyone.
- `subscribe.ts`: after `replay-complete` and the drained queue, sends the session's buffered
  frames that pass `canSee`. A late joiner thus sees rows and the prose so far, then live parts,
  then the settled row.
- A buffer with no frame for `LEASE_MS` is deleted on the next stream call (a dead worker).

### D5 — Gate and floor (AC #4)

No change. `gate.handle` serializes per-session writes in `inOrder`; narrate holds no entry,
no lock and no floor. The floor is a projection of log rows; narrate writes none until
`submitNarration`. The next turn job queues on `jobs_turn_queued_key` and claims after the running
job ends, as today. The AC #4 test proves the gate side.

### D6 — Web (`apps/web/app`)

- `ws/types.ts`: `ServerFrame` gains the `narration-stream` member.
- `play/reduce-frame.ts`: `FrameState.stream: { jobId; restate; describe; ask; rows } | null`.
  A part with a new `jobId` starts a new stream. `end` clears it. An `event` of type `narration`
  by `ai:dm` clears it too.
- `ws/useSession.ts` returns `stream`. `play/source.ts` `TableSource` gains
  `narrationStream`. `use-live-table.ts` passes it; `use-fixture-table.ts` passes `null`.
- `play/view-model.ts`: when a stream is present, appends
  `{ kind: "narration-stream"; rows; prose }` after the sorted transcript.
- `play/components/transcript.tsx`: renders the block as the narration row does, rows first,
  with a "The DM is narrating" label, `aria-live="polite"` and `aria-busy="true"`. No modal.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/pipeline/call.ts` | D1: `onText`, `firstTokenMs`. Hotspot (0273, 0272). |
| `apps/server/src/dm/narration-stream.ts` | New, D2. |
| `apps/server/src/dm/narration-check.ts` | Export `sentencesOf`. |
| `apps/server/src/dm/fact-sheet.ts` | Export `TAG` and the digit drop as `dropDigitSentences`; `parseSlots` uses it. |
| `apps/server/src/dm/pipeline/context.ts` | `NodeDeps.streamNarration`, `NarrationPart`. |
| `apps/server/src/dm/nodes/narrate.ts` | D3: rows part, `onText`, `stream`, `timing`. Hotspot. |
| `apps/server/src/dm/nodes/check.ts` | D3: `finish`, timing fields, log line. |
| `apps/server/src/dm/worker.ts` | D3: `onNarrationStream`, `end` in `finally`. |
| `apps/server/src/index.ts` | Wire `onNarrationStream` to `gateway.streamNarration`. |
| `apps/server/src/ws/protocol.ts` | `NarrationStreamFrame`; `OutboundFrame` member. Frozen; C-GATE. |
| `apps/server/src/ws/registry.ts` | D4: buffer, `streamNarration`, `endNarration`. |
| `apps/server/src/ws/subscribe.ts` | D4: in-flight replay after `replay-complete`. |
| `apps/server/src/ws/gateway.ts` | D4: `streamNarration`, `endNarration` in `publish`. |
| `specs/006-ws-gateway/contracts/ws-protocol.md` | C-GATE amendment block. |
| `specs/030-play-route/contracts/live-frames.md` | C-GATE amendment block. |
| `apps/server/test/dm/narration-stream.test.ts` | New: parser, leak, digit, think, quote, cap, prefix property. |
| `apps/server/test/dm/call.test.ts` | `onText`, `firstTokenMs`. |
| `apps/server/test/dm/narrate-stream.test.ts` | New: rows before `chat()`, part order, timing in check record. |
| `apps/server/test/dm/fact-sheet.test.ts` | Every digit in any part lies in a row or the State line. |
| `apps/server/test/ws.narration-stream.integration.test.ts` | New: per-viewer delivery, late joiner, end on row publish. |
| `apps/server/test/ws.protocol.test.ts` | Frame shape. |
| `apps/server/test/dm/narration-stream-gate.integration.test.ts` | New: AC #4. |
| `apps/web/app/ws/types.ts`, `ws/useSession.ts` | D6. |
| `apps/web/app/play/reduce-frame.ts`, `source.ts`, `use-live-table.ts`, `use-fixture-table.ts` | D6. |
| `apps/web/app/play/view-model.ts`, `components/transcript.tsx` | D6. Hotspots (0199, 0247, 0275–0277). |
| `apps/web/test/play/reduce-frame.test.mjs`, `test/play/transcript-stream.test.tsx` | Reducer and render tests. |
| `docs/wiki/*` | Wiki phase. |

`apps/web/app/play/frames.ts` needs no change: it builds client-to-server frames only.

## Migrations

None. Timing lives in `jobs.result.checkpoint.narration.check` (jsonb) and a log line.
`dm_model_calls` would need a column and a `meta/_journal.json` entry; not needed.

## New runtime dependencies

None.

## Prompt bumps

None. `dm.narrate-v24` is unchanged: the model output format (tagged slots) is the same.

## C-GATE: frozen contract amendments

Additive only. No existing frame changes. A client that does not know the new type ignores it
(`reduce-frame.ts` default branch; `ws-protocol.md` has no rule against unknown server frames).

| Frozen file | Before | After |
|---|---|---|
| `specs/006-ws-gateway/contracts/ws-protocol.md` (and `docs/wiki/ws-protocol.md`) | Server → client frames: `event`, `replay-complete`, `presence`, `error`. | Adds `narration-stream { sessionId, jobId, slot: "rows" \| "restate" \| "describe" \| "ask" \| "end", text }`: ephemeral, never in the log, never replayed from the log; filtered per recipient with `canSee` at `public`; a subscriber gets the in-flight parts after `replay-complete`. Guarantee 1 ("appended before broadcast") is scoped to `event` frames. |
| `apps/server/src/ws/protocol.ts` | `OutboundFrame = RecordedEventFrame \| ReplayCompleteFrame \| PresenceFrame \| ErrorFrame`. | Adds `NarrationStreamFrame` to the union. Inbound frames unchanged. |
| `specs/030-play-route/contracts/live-frames.md` | The live table sends `subscribe` and `send`; `useSession` returns `sendEvent`, `resync`. | `useSession` also returns `stream` (the in-flight narration, or null). No sent frame changes. |

## Task count and split check

29 tasks in 5 phases. Under the ~40 threshold: **no split**. Server (phases 1–3) and web
(phase 4) could separate, but AC #1 and AC #3 need both halves to be provable, so one PR.

## Phases (one phase = one sonnet dispatch)

1. Stream core (pure): `callText` and the parser.
2. Pipeline wiring and timing.
3. Delivery and the C-GATE amendments; AC #4 test.
4. Web rendering.
5. Wiki re-ground.

Phase 2 depends on 1. Phase 3 depends on 2. Phase 4 depends on 3's frame type. Phase 5 runs last.
