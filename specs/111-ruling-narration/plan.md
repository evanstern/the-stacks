# Implementation Plan: Every settled deed is narrated

**Spec**: `specs/111-ruling-narration/spec.md` | **Card**: TASK-0337 | **Branch**: `task-0337-ruling-narration`
**Authored against**: `origin/main` `594dd99a`.

## Summary

One pure module (`dm/deeds.ts`) finds the deeds in the narrate window. The runner reads it to
decide `empty-beat`. Narrate reads it to name each deed. The fact sheet and prompt render one
line per deed. The auditor reuses the same deed test to fail a silent deed. The CI scenario gains
two Intent moves. No migration, no new dependency, one prompt bump (`dm.narrate-v25`).

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. One deed test, shared by runtime and auditor. CI fails a silent deed. |
| II One Intent vocabulary | Pass. The deed row is the Intent's canonical `toText` form. |
| III Event-sourced, server authority | Pass. No event type or payload changes. The window reads existing rows. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. Public carriers only; the web keeps the deed row like a `why` row. |
| VI Engine owns the numbers | Pass. The deed row is code-written text; numbers stay on roll rows. |
| VII Narration around facts | Pass, strengthened. Each deed becomes an explicit fact line. Prompt bumped. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass, strengthened. No ruled deed ends silent; no deed is told one turn late. A deed with no prior intent turn adds one narrate call, already the cost of an `intent` turn. |
| X Grounded claims carry citations | Pass. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. No purpose or config change. |
| XIII Plan just-in-time | Pass. |

## Design

### D1 — The deed test and window (`dm/deeds.ts`, new, pure)

```ts
export interface Deed {
  seq: number;            // the carrier row
  intentId: string;       // the answered Intent for a ruling row
  name: string;           // party name, else actor id, else "The scene"
  text: string;           // toText(intent), clipped to 200 chars
  batchId: string | null;
  stopped: string | null; // the stop code
}
export function isDeedRow(row, carriers): { intent: Intent } | null;
export function narrateWindow(prior, lastNarrationSeq, throughSeq): { w0: number; w1: number };
export function windowDeeds(carriers, projections): Deed[];
```

- `isDeedRow` takes the row and the session's earlier carriers. Rule (a): `answers` set. Find the
  carrier whose `request.requestId === answers`. It is a deed when that carrier's actor does not
  start with `ai:`. The deed's Intent is the asker's `intent`. Its batch is the ruling row's
  `batchId`. Rule (b): actor not `ai:`, and (`outcome === "settled" && batchId != null` or
  `stopped != null`). The `ai:` test is the one `appendedByJob` uses in `enqueue.ts`. Copy the
  one-line predicate; do not import `enqueue.ts` (it pulls DB code into narrate's import closure).
- Rule (a) needs carriers before W0. `windowDeeds` takes all carriers through W1 and filters
  deeds to seq in `(W0, W1]`. Load with `loadEvents({ afterSeq: 0, throughSeq: w1, types: ["intent.recorded"] })`.
  ponytail: one full carrier read per narrating turn; ceiling a long session; upgrade to an
  `asks` lookup by request id when a session passes a few hundred carriers.
- `narrateWindow` is the W0/W1 logic now inline in `nodes/narrate.ts` L273–289, moved unchanged.
  The narration lookup stays a `loadEvents` call in the caller; pass its result in.
- Names: `projections.party` by `characterId`, else the combatant name, else the actor id. A
  `pc` or `companion` actor always has an id.

### D2 — Runner empty-beat rule (`pipeline/runner.ts`)

At the empty-beat branch (L215–224), replace `ctx.job.trigger !== "intent"` with a call to a new
narrate-side helper `pendingDeeds(ctx)` (in `nodes/narrate.ts`, exported; it computes the window
with the same deps and returns `windowDeeds`). Order:

1. `scene-start`: proceed (unchanged).
2. `talk`: run `runTalkTurn` (unchanged; spec OQ-1).
3. Pending deeds non-empty: proceed.
4. Else: `empty-beat`.

The Director skip at L161 changes from `trigger === "intent"` to "beat empty, no npcTurn, and not
`scene-start`". Use a local `deedPass` flag set at the assemble branch. The beat is known only
after assemble, and the Director runs after it, so the flag is set in time. On a reclaim, the
assemble checkpoint reloads the empty beat, and the flag recomputes the same way.

The `intent` trigger keeps working: it is now a trigger whose turn usually has a deed. An `intent`
turn with no deed (rule 9 fired, but a coalesced earlier turn already narrated it) now ends
`empty-beat` instead of shipping a skipped narrate. That is correct and is tested.

### D3 — Narrate (`nodes/narrate.ts`)

- Use `narrateWindow` and `windowDeeds` from D1.
- Build `directBatches` for every trigger, from the deeds:
  `{ name, batchId, text, stopped }`. A deed with no batch still produces an entry.
- `planFacts` stays as is: every public carrier in the window. The ruling's `why` rows keep coming
  from it.

### D4 — Facts, sheet, prompt

- `facts.ts`: `BuildFactsInput.directBatches` gains `text: string` and `stopped: string | null`.
  `FactSettled` gets an optional `deed?: { text: string; stopped: string | null }`, set only for
  direct entries. `collectFacts` runs on `[]` when `batchId` is null.
- `fact-sheet.ts`: `FactRow.kind` adds `"deed"`. In `renderRows`, for each `direct` entry push
  `{ kind: "deed", text: deedLine(s) }` before `push(s.rolls, s.changes)`. Export
  `deedLine = (s) => \`Deed: ${s.name}: ${s.deed.text}${s.deed.stopped ? \` (stopped, ${s.deed.stopped})\` : ""}\``.
- `fact-sheet.ts` `renderDiceLines` callers: `renderRows` includes deed rows; the auditor's
  `expectedDiceLines` does not build them, so `splitNarration` must drop deed lines (D6).
- `prompts/narrate.ts`: the direct loop pushes `Direct action: ${st.name}: ${st.deed?.text ?? ""}`.
  Add to the rules text: "Describe every Direct action line, in order. Each is a separate deed."
  Bump `PROMPT_VERSION` to `dm.narrate-v25`.
- The restate slot is unchanged: deeds have no beat item, so `restate` stays empty and slots stay
  `["describe"]`. The deed row is the code restate.

### D5 — Web row parser (`apps/web/app/play/narration-rows.ts`)

Add `|^Deed: ` to `WHY_LINE`'s alternation, or a separate `DEED_LINE` kept in the rules list. Keep
the copy-by-hand comment. Update the same regex in `auditor/checks.ts` (D6). Add one case to
`apps/web/test/play/narration-rows.test.mjs` beside the existing why-row case.

### D6 — Auditor check (`playtest/auditor/checks.ts`, `schema.ts`)

Self-contained, because TASK-0335 edits the same file:

- `CHECK_IDS`: append `"deeds-narrated"` last.
- `splitNarration`: add `DEED_LINE = /^Deed: /`. Accept it in the every-line test. Drop it from
  `diceLines` like `WHY_LINE`. Export a sibling `deedLines(text): string[]` for the check.
- One function, in one block at the file's end:

```ts
/** TASK-0337: every deed in the transcript is told by its segment's narration. */
export function checkDeedsNarrated(seg: Segment, ctx: CheckContext): CheckFinding[];
```

  It finds carriers in `seg.rows` with `isDeedRow` (import from `dm/deeds.ts`; earlier carriers
  from `ctx.transcript`). For each: tail segment (`narrationSeq === null`), or no deed line of the
  closing narration ends with `: <text>` (or `: <text> (stopped, …)`), is one finding:
  kind `unnarrated-deed`, seqs `[carrier.seq]`, detail
  `` `The deed "<text>" (seq N) has no narration row.` ``.
- `runChecks`: one line at the end, before `return`: `for (const f of checkDeedsNarrated(seg, ctx)) add("deeds-narrated", f);`
- `segments.ts`: a deed in a tail without `talk` rows is dropped today (the tail closes only on
  `talk`). Change the tail rule to close on `talk` or a deed carrier. One line; it is the only
  other auditor edit.
- `schema.ts`: `FINDING_KINDS` appends `"unnarrated-deed"`; `SEVERITY_OF` maps it to `"fail"`.

Why the segment's closing narration and not "any later narration": a deed told one turn late is
finding 11's fault. The narrating turn's window covers exactly the rows since the last narration,
so the closing narration is the one that must tell it.

### D7 — Scenario Intent moves (`playtest/scenario.ts`, `harness.ts`, `driver.ts`)

- `Move` gains `intent: z.literal(true).optional()`. `nextMove` is unchanged; it returns the move.
- `harness.ts`: when `move.intent`, parse `move.text` with `parse` from `@the-stacks/intent`
  (stamp: `id` `move.actionId`, actor `{ kind: "pc", id: seat.characterId }`, source `composer`,
  commit `confirmed`). Submit `{ kind: "intent", intent }` through `gate.handle` as the human. A
  parse failure or refusal is a refusal entry, like a declare refusal. Then settle and drain.
- `greyhollow-ford.json`: insert two free moves after `act-search`:
  `{ "text": "/search #ferry-house", "actionId": "deed-search", "intent": true }` and
  `{ "text": "/move #causeway", "actionId": "deed-move", "intent": true }`.
  Check the seed's start (`near-bank`) reaches both, and that later moves still reach the camp
  (`causeway` → `reed-marsh` is a squeeze edge; `act-advance` follows the posts). If moving to the
  causeway breaks the later script, move `/move #ferry-house` instead and record why.
- `test/dm/scripts/greyhollow-ford-full.json`: the search asks `difficulty`. Under the AI seat the
  `ruling` job calls `dm.adjudicate` (`answerRulings`) then `dm.narrate`; add those calls and one
  die in script order. The move turn needs one `dm.narrate` call. Add `dm.chronicle` entries as the
  existing pattern does. Keep `scriptRemaining` at zero.
- `playtest.integration.test.ts`: segment count goes from 8 to 10; assert `deeds-narrated` passes
  on every segment. `harness.integration.test.ts`: the dice equality still holds once the script's
  `dice` lists the new face.
- `fixtures/greyhollow-ford.audit.json`: two more `playtest.audit` responses (pass) for the two
  new segments.

### D8 — Tests (fake gateway only; one file per story)

- `test/dm/deeds.test.ts` (unit): `isDeedRow` cases (direct settled, stopped, speech, declared,
  `ai:` row, ruling answering a composer ask, ruling answering an `ai:` ask, reject ruling);
  `windowDeeds` order and W0 filtering.
- `test/dm/runner.test.ts` (unit, extend): empty beat with a pending deed proceeds for `ruling`,
  `approval`, `commit`; no deed returns `empty-beat`; `intent` with no deed returns `empty-beat`.
- `test/dm/ruling-narration.integration.test.ts` (DB, new): the replay. AI seat, duo seed.
  1. Post `/search #ferry-house` as a declared Intent (as the composer does).
  2. Drain: the talk read ships the code confirm row (no model call).
  3. 👍: `action.accept` on the suggestion item. The carrier records `needs_ruling`.
  4. Drain: the `ruling` job answers (`dm.adjudicate` scripted `accept`, `easy`), rolls, narrates.
  5. Assert: job outcome `completed`; one narration row; it holds `Deed: Tamsin Vale: /search #ferry-house`,
     the roll line and `DM ruling: accept`.
  6. Post `/move #causeway` declared, drain, 👍, drain. Assert the narration holds the move deed
     row and no search deed row; the narrate prompt (`scripted.provider.chatCalls`) has the move's
     `Direct action` line and not the search's.
  7. Stranded case (US3): run steps 1–4 with the `ruling` narrate replaced by the pre-fix shape:
     settle the search under a human seat with no turn drained, then submit the move directly,
     then drain once. Assert two deed rows in seq order and two `Direct action` lines.
  8. Human DM (US4): human seat, the DM accepts through `proposal.approve` on the request's
     proposal (or a `ruling` Intent for a difficulty ask). Assert the `approval` turn narrates.
- `test/playtest/checks.test.ts` (unit, extend): negative proof. Build the test-drive shape from
  plain rows: scene, search carrier (composer ask) + ruling carrier (`ai:dm`, answers), a narration
  with only rows; then the move carrier and a narration with only the search's deed row. Expect one
  finding, `deeds-narrated`, citing the move carrier. Fixed shape: none. Tail deed: one. The
  existing doctored and clean fixtures hold no deed carriers; their expectations do not change.
- `apps/web/test/play/narration-rows.test.mjs`: a `Deed: ` line stays in `rules`.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/deeds.ts` | new: `Deed`, `isDeedRow`, `narrateWindow`, `windowDeeds` |
| `apps/server/src/dm/nodes/narrate.ts` | window from `deeds.ts`; deeds for every trigger; export `pendingDeeds` |
| `apps/server/src/dm/pipeline/runner.ts` | empty-beat rule by deeds; Director skip by `deedPass` |
| `apps/server/src/dm/facts.ts` | `directBatches` text/stopped; `FactSettled.deed` |
| `apps/server/src/dm/fact-sheet.ts` | row kind `deed`; `deedLine` |
| `apps/server/src/dm/prompts/narrate.ts` | `Direct action` text; rule line; `dm.narrate-v25` |
| `apps/web/app/play/narration-rows.ts` | accept `Deed: ` lines |
| `apps/server/src/playtest/auditor/checks.ts` | `DEED_LINE`; `deeds-narrated` block |
| `apps/server/src/playtest/auditor/segments.ts` | tail closes on a deed carrier too |
| `apps/server/src/playtest/auditor/schema.ts` | kind `unnarrated-deed` |
| `apps/server/src/playtest/scenario.ts`, `harness.ts` | `Move.intent`; submit as Intent |
| `apps/server/playtests/scenarios/greyhollow-ford.json` | two Intent moves |
| `apps/server/playtests/fixtures/greyhollow-ford.audit.json` | two audit responses |
| `apps/server/test/dm/scripts/greyhollow-ford-full.json` | ruling, narrate calls and a die |
| tests | `deeds.test.ts`, `runner.test.ts`, `ruling-narration.integration.test.ts`, `checks.test.ts`, `playtest.integration.test.ts`, `harness.integration.test.ts`, `apps/web/test/play/narration-rows.test.mjs`, `narrate.test.ts` and prompt snapshot tests the bump touches |
| contracts | `031/node-seam.md`, `098/fact-sheet.md`, `032/auditor.md`, `032/audit-report-schema.md`, `032/scenario.md` |
| wiki | Phase 5 |

`dm/enqueue.ts`, `dm/rulings.ts`, `dm/intent-runner.ts` and the gate are not edited.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: `dm.narrate-v24` → `dm.narrate-v25`.
- Dependencies: none. `@the-stacks/intent` (`toText`, `parse`) is already a server dependency.

## Flags

- `jobs_turn_queued_key` coalescing is unchanged; D2 makes any trigger narrate deeds, which is
  what makes coalescing safe.
- The narration-stream parser (`narration-stream.ts`) sends `rows` as one frame of sheet row
  texts; deed rows ride it with no change. Check `narrate-stream.test.ts` fixtures still pass.
- `TASK-0335` edits `auditor/checks.ts`. D6 keeps every edit in `CHECK_IDS`' last entry, the
  regex block and one trailing block.

## Size and split check

Five phases, each one sonnet dispatch. Phases 1 and 2 share the runtime; Phase 3 is independent
of the runtime and could run in parallel, but it imports `dm/deeds.ts` from Phase 1.
