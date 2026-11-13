# Tasks: Narration streams to clients

**Spec**: `specs/108-narration-stream/spec.md` | **Plan**: `specs/108-narration-stream/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. Do not start phase 3 before the operator's C-GATE ruling is quoted
in the brief.

## Phase 1: Stream core (pure)

- [x] T001 In `apps/server/src/dm/pipeline/call.ts`, add `onText?: (delta: string) => void` to `CallRequest`. Call it per `text` event inside a `try`.
- [x] T002 In `collect()`, record `firstTokenMs` from the `chat()` call to the first non-empty delta. Return it on `TextResult` ok. Extend `apps/server/test/dm/call.test.ts`.
- [x] T003 Export `sentencesOf` from `apps/server/src/dm/narration-check.ts`. Export `TAG` and a new `dropDigitSentences` from `apps/server/src/dm/fact-sheet.ts`; `parseSlots` uses `dropDigitSentences`.
- [x] T004 Write `apps/server/src/dm/narration-stream.ts` per plan D2: `createNarrationStream`, `push`, `finish`, `NarrationPart`.
- [x] T005 Write `apps/server/test/dm/narration-stream.test.ts`. Cover: held last sentence, tag switch, slot not in `sheet.slots`, think strip, unclosed quote, cap, stock ending, leak drop (fogged zone, DM-only text, absent actor), digit drop.
- [x] T006 Add a prefix property test: for every narrate fixture and 1-, 3- and 17-character delta splits, each slot's joined parts are a prefix of the check node's kept slot.

## Phase 2: Pipeline wiring and timing

- [x] T007 In `apps/server/src/dm/pipeline/context.ts`, add `NodeDeps.streamNarration?` and the `NarrationPart` type.
- [x] T008 In `apps/server/src/dm/nodes/narrate.ts`, send the `rows` part before `narrateAttempt`. Pass `onText` into the parser. Add `stream` and `timing` to `NarrateOutput`.
- [x] T009 In `apps/server/src/dm/nodes/check.ts`, call `stream.finish(kept)` and forward the parts. Add `firstTokenMs`, `firstProseMs` and `firstProseAt` to `CheckRecord`. Log `dm.narrate.first-token`.
- [x] T010 In `apps/server/src/dm/worker.ts`, add `DmWorkerDeps.onNarrationStream`. Build `streamNarration` per job. Send `end` in a `finally` around each turn job.
- [x] T011 Write `apps/server/test/dm/narrate-stream.test.ts`: the `rows` part precedes the gateway `chat()` call; part order; `end` on success, call error and reclaim skip; timing fields in the check record (AC #5).
- [x] T012 Extend `apps/server/test/dm/fact-sheet.test.ts`: every digit in any stream part lies in a code-rendered row or the State line (runbook narration-PR gate).

## Phase 3: Delivery and C-GATE amendments

- [x] T013 In `apps/server/src/ws/protocol.ts`, add `NarrationStreamFrame` and the `OutboundFrame` member. Note the amendment in the header comment.
- [x] T014 In `apps/server/src/ws/registry.ts`, add the in-flight buffer, `streamNarration` and `endNarration` per plan D4. Filter with `canSee(viewerFor(conn, seat), "public")`. Skip mid-replay connections. Drop a buffer idle for `LEASE_MS`.
- [x] T015 In `apps/server/src/ws/subscribe.ts`, send the buffered frames after `replay-complete` and the drained queue.
- [x] T016 In `apps/server/src/ws/gateway.ts`, expose `streamNarration`. In `publish`, call `endNarration` before broadcasting an `ai:dm` `narration` event. Wire `onNarrationStream` in `apps/server/src/index.ts`.
- [x] T017 Write `apps/server/test/ws.narration-stream.integration.test.ts`: two players and a human DM receive parts; a mid-replay connection gets parts only after `replay-complete`; a late joiner gets rows and prose so far, then the `narration` event, then nothing more for that job. Extend `ws.protocol.test.ts` for the frame shape.
- [x] T018 Write `apps/server/test/dm/narration-stream-gate.integration.test.ts` (AC #4): a fake gateway pauses mid-narrate; `gate.handle` of an `intent` returns ok in free mode and for the floor holder in turn mode; release; the narration row ships.
- [x] T019 Add the C-GATE amendment blocks to `specs/006-ws-gateway/contracts/ws-protocol.md` and `specs/030-play-route/contracts/live-frames.md`. Quote the operator's ruling.

## Phase 4: Web rendering

UI rules: no modals. `apps/web/test/no-dialog.test.mjs` stays green. Render at 1280 px and 390 px.
Run an accessibility check. The live Brave check is the orchestrator's.

- [x] T020 In `apps/web/app/ws/types.ts`, add the `narration-stream` `ServerFrame` member.
- [x] T021 In `apps/web/app/play/reduce-frame.ts`, add `FrameState.stream` per plan D6. Extend `apps/web/test/play/reduce-frame.test.mjs`: new job, parts, `end`, clear on an `ai:dm` `narration` event.
- [x] T022 In `apps/web/app/ws/useSession.ts`, return `stream`. Add `narrationStream` to `TableSource` in `play/source.ts`. Pass it in `use-live-table.ts`; pass `null` in `use-fixture-table.ts`.
- [x] T023 In `apps/web/app/play/view-model.ts`, append the `narration-stream` item after the sorted transcript.
- [x] T024 In `apps/web/app/play/components/transcript.tsx`, render the block: rows first, then prose, the words "The DM is narrating", `aria-live="polite"`, `aria-busy="true"`.
- [x] T025 Write `apps/web/test/play/transcript-stream.test.tsx`: the block renders, the settled row replaces it, the label is text not colour, and the block wraps at 390 px.

## Phase 5: Wiki re-ground

- [ ] T026 Re-verify and re-pin `ws-protocol`, `websocket-gateway`, `subscriber-registry` and `replay-live-boundary` (NEEDS-REVIEW: new frame, buffer, in-flight replay).
- [ ] T027 Re-verify and re-pin `dm-runtime`, `dm-narration-quality` and `debug-view` (NEEDS-REVIEW: parser, timing fields, log line), and `dm-turn-jobs` (end in `finally`).
- [ ] T028 Re-verify and re-pin `client-session-hook` and `play-route` (NEEDS-REVIEW: `stream`, transcript block).
- [ ] T029 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`. Run the freshness gate until it prints `OK`.
