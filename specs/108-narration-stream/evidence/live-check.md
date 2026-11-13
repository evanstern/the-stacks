# Live check, spec 108 (TASK-0298, narration streams)

Run 2026-11-12 on the worktree stack `stacks-task-0298` (http://localhost:3298), script mode
`greyhollow-live` (boot log: `DM script mode: greyhollow-live (8 calls, 1 dice)`), seed
`greyhollow-ford`, operator seated as Tamsin. One isolated Playwright context on the Brave debug port.
Turn: `act-search` declared and committed over the WebSocket (spec 053 `declare.mjs`). No source change.
Setup note: the first `.env` append fused onto the `AI_PRICES` line (no trailing newline) and the app
refused to boot; fixed the line break, recreated the app container, boot clean.

## Results

| Check | Result | Notes |
|---|---|---|
| 1. Narrate turn lands once, no duplicate, no leftover block | pass | After the turn the transcript has the opening narration plus one "Tamsin crouches beside the cut bell rope..." row (1 occurrence in body text). `[data-kind=narration-stream]` count 0, "The DM is narrating" count 0 |
| 2. In-flight block caught | seen | MutationObserver plus 20 ms poll caught 5 states of the block, first at t=357 ms after the declare. Label "THE DM IS NARRATING" (CSS uppercase), rows first ("Tamsin Vale — /check investigation: 1d20 → 14 = 14 vs DC 10: success / DM ruling: accept / Difficulty: easy / State: ..."), then prose ("Tamsin crouches besid..." at t=359 ms). Attributes at every sample: `aria-live="polite"`, `aria-busy="true"`. The block was gone by the settle |
| 3. Mid-stream behaviour | not live | Script mode emits one text event, so prose-growing-by-sentence is not observable. Covered by integration tests: `apps/server/test/ws.narration-stream.integration.test.ts` (rows first, prose growing sentence by sentence, late joiner replay after `replay-complete`) and `apps/server/test/dm/narration-stream-gate.integration.test.ts` (AC #4, next Intent accepted while narration streams) |
| 4. Screenshots, no modal, no overflow | pass | `narrated-1280.png`, `narrated-390.png`. Dialog/aria-modal/open-dialog count 0 at both widths. At 390 px scrollWidth 390 = clientWidth 390 |
| 5. Accessibility | pass with finding | Live attributes read from the DOM during the in-flight sample (above) and in markup by `apps/web/test/play/transcript-stream.test.tsx` (lines 30-31). AX tree via CDP `Accessibility.getFullAXTree`: `main`, `list` (the transcript `<ol>`), `form "Composer"`, `list "At the table"` |

## Finding (not fixed)

The transcript is a bare `<ol>`: its AX role is `list` with no accessible name, and no `role` or
`aria-label` on it or its parent. The plan names no transcript region name, so this is a note, not a
failure. Add `aria-label="Transcript"` if a named region is wanted.

## Not run live

Prose growth, late joiner, and the AC #4 next-Intent case (integration tests only, see row 3).
