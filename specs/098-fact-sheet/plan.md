# Implementation Plan: Fact sheet, code-rendered fact rows and State line

**Branch**: `task-0245-fact-sheet` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: `specs/098-fact-sheet/spec.md`; TASK-0245; runbook `docs/design/r1-fast-table-runbook.md`
(lane LN, spine #9, F4); contract [contracts/fact-sheet.md](contracts/fact-sheet.md).

## Summary

Add a pure `buildFactSheet` (`apps/server/src/dm/fact-sheet.ts`) that wraps today's
`NarrationFacts` with restate targets, code-rendered rows, speakers, allowed slots, a code-settled
ask and a code-rendered State line. Narrate asks the model for three tagged slots, validates them in
code, and composes the reply in template order. The audit and fallback keep running (TASK-0272
retires them) but check and ship the template. The transcript renders line breaks.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: none new. Reuses `spellDigits` (`fallback.ts`), `STOCK_ENDING` and
`EITHER_OR_END` (`audit-words.ts`), `clipProse` and `dropStockEnding` (`nodes/narrate.ts`).
**Storage**: none. **No migration.** No event catalog change: the reply still ships as one
`narration` event (`text` ≤ 8000).
**Testing**: Vitest unit tests and the scripted fake gateway. One fixture-replay test (run 1 seq
15-20) with no DB. Existing DB integration tests re-run unchanged in assertion intent.
**Constraints**: no frozen contract change. `dm.narrate` stays a text purpose (spec 093 D6). No new
model call. Narrate's import closure stays free of engine values and RNG.
**Scale/Scope**: 9 source files, 2 new test files, 1 new fixture, ~8 extended tests, 1 contract
amendment, 1 prompt bump per prompt (narrate, audit).

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no new write path. Companions read the same narration row. N/A beyond.
- [x] **II. One Intent vocabulary**: no new write. The sheet reads events. The planner `PlanFact`
      feed is a named seam (contract §6), not a private path.
- [x] **III. Event sourcing**: reads the ledger and projections only. Visibility: the sheet reads
      `NarrationFacts`, which already filters to public rows.
- [x] **IV. Data planes**: session plane only.
- [x] **V. Many views, one state**: every row is a rendering of a ledger event the ledger panel also
      shows. Rows in the narration text duplicate the stream; OQ-3 moves them to stream rows in
      TASK-0247.
- [x] **VI. Engine owns the numbers**: every digit in a reply comes from a ledger row. The sheet
      rolls nothing.
- [x] **VII. Narration around facts**: this card is VII's first half. Code renders every fact row
      and the State line; the model fills three slots from a fact sheet. Partial: rows still ship
      after the model call (OQ-3, carded to TASK-0247). The leak and contradiction check and audit
      retirement are TASK-0272.
- [x] **VIII. Campaign is data**: N/A.
- [x] **IX. UX quality bar**: no new model call; the sheet costs microseconds. Template order gives
      every reply a visible "what changed" and "whose move". The transcript renders line breaks
      with `whitespace-pre-line`; no modal; works at 1280 px and 390 px.
- [x] **X. Citations**: N/A.
- [x] **XI. Operator-owned content**: no rulebook text.
- [x] **XII. Self-hostable**: no container or config change.
- [x] **XIII. Just-in-time**: R1 card. Deferrals are open questions with an owner card or trigger.

**Stack conformance**: within the table. **Complexity Tracking**: none.

## Research

- **R1 — Slot transport.** Tagged text keeps `callText`, every fake script, and streaming open
  (spec OQ-1). An untagged reply degrades to `describe`. Rejected: a JSON slot schema now, which
  would rewrite 35 scripted narrate replies and need an incremental JSON reader for TASK-0298.
- **R2 — Where the state comes from.** `buildNarrationFacts` already folds everything the State
  line needs: `modeChange`, `events` (`encounter-started`, `encounter-ended`, `turn-advanced`),
  `turn.actor`, `director.sceneEnded`, `clarify`, `held`, action outcomes. The only new inputs are
  the beat (subject and actor), party controllers (answerer), the encounter's active combatant and
  resolve's submissions (partial).
- **R3 — `renderChangeLine` returns null for four kinds.** The audit's dice-lines check and the
  playtest auditor's `expectedDiceLines` both call it. Widening it widens both in lockstep; the
  auditor's `DICE_LINE` regex must accept the new forms, and its `DICE_RELEVANT` set must include
  their event types.
- **R4 — The audit reads `prose`.** It checks digits, word cap, agency, either-or ending and the
  clarify ending. The restate block quotes the player's declared verbs ("I dodge …"), which the
  agency check would flag, so the agency checks skip the restate block. The clarify-ending check
  (`facts.clarify.length > 0 && !prose.endsWith("?")`) holds because ask is the last slot.
- **R5 — Finding 49.** Claim `omission` (a death not named) blocks today. With a code life-state row
  it is redundant and costs regenerations (spec OQ-6).
- **R6 — Run 1 seq 15-20 fixture.** No ledger export of session 729a6c5c is in the repo. The beat is
  reconstructed from the playtest log finding 2 and 6 and the B-undeclared-method row: party action
  by Tamsin's player, interpret clarify, no steps, free mode, Wenna present. Cite the log in the
  fixture header.

## Design

### D1 — Sheet builder (`dm/fact-sheet.ts`, new)

Exports `FactSheet`, `FactRow`, `RestateTarget`, `Speaker`, `NarrationSlots`, `SlotName`,
`buildFactSheet`, `renderRows`, `renderStateLine`, `REFUSAL_REASON`, `parseSlots`, `composeReply`.
Pure; imports types from `facts.ts`, `spellDigits` from `fallback.ts`, words from `audit-words.ts`.
Implements contract §2 to §5. `renderRows` replaces `renderDiceLines` as the row source (it calls
`renderRollLine` and `renderChangeLine` and adds refusal rows); `renderDiceLines` stays as a thin
alias returning `renderRows(...).map(r => r.text)` for the playtest auditor and tests.

### D2 — Rows (`dm/facts.ts`)

`renderChangeLine` returns a row for `life-state`, `condition`, `spell-slot` and `assist` (contract
§3.1). No change to `collectFacts` or `buildNarrationFacts`.

### D3 — Narrate node (`dm/nodes/narrate.ts`)

After `withholdRefusedInputs`, build the sheet from the facts, `assembled.beat`, projections,
`resolve.snapshot` names and `resolve.submissions`. `nothingToNarrate` unchanged. `narrateAttempt`
takes the sheet, calls `callText`, then `parseSlots`. Output gains `sheet` and `slots`; `prose`,
`diceLines`, `text` per contract §5.2. `composeText` becomes `composeReply`.

### D4 — Narrate prompt (`dm/prompts/narrate.ts`, `dm.narrate-v22`)

- RULES: replace the prose-shape rule and the "Unclear intent" and "End on something" rules with the
  slot rules: write `[restate]` (one sentence, the character's intention, no outcome, no digit),
  `[describe]` (about one hundred words), and `[ask]` only when listed; never write a State line,
  never write a question when an ask is settled; code appends rows and the State line.
- User: a `Slots` section (allowed slots), a `Restate` section (targets with resolution), a
  `Speakers` section, a `Settled question` line when `sheet.ask` is set ("Code asks this; do not
  ask it."). `factEntries(sheet.settled)` stays the Facts section. Clarify entries render as
  `Waiting on an answer for <subject>` instead of the question text.

### D5 — Audit (`dm/nodes/audit.ts`, `dm/prompts/audit.ts`, `dm.audit-v17`)

- `deterministicChecks` filters claim `omission` (OQ-6); the agency checks run on `describe` + `ask`
  (restate removed by block); the clarify exemptions read `sheet.ask`. Regeneration and the fallback
  path keep their shape.
- The audit prompt states the reply's restate block repeats the player's intention and is never a
  result. Bump to `dm.audit-v17`.
- The regenerate path calls `narrateAttempt` with the sheet; the shipped text uses `composeReply`.

### D6 — Fallback (`dm/fallback.ts`)

`factualSummary` gains an option `{ forSheet: true }` that omits the clarify and refusal sentences
(the ask slot and refusal rows carry them). The audit's fallback ships `composeReply` with the code
restate, that summary as describe, `sheet.ask`, rows and State.

### D7 — Talk turn (`dm/talk-turn.ts`)

On `escalate` that starts a fight, append the floor-clause State line to the shipped text (OQ-4).
A `reply` ships unchanged.

### D8 — Playtest auditor (`playtest/auditor/checks.ts`)

`DICE_LINE` accepts every row form plus `State:`; `splitNarration` treats the last block (rows +
State) as the code block; `expectedDiceLines` adds the new `DICE_RELEVANT` types and compares rows,
ignoring the `State:` line.

### D9 — Transcript (`apps/web/app/play/components/transcript.tsx`)

The narration `<p>` gains `whitespace-pre-line`. The whole reply stays italic muted text; row and
State styling is TASK-0247.

### D10 — Contract amendment

`specs/034-narration-quality/contracts/narration-facts.md`: a section "Fact sheet (spec 098)"
pointing to `specs/098-fact-sheet/contracts/fact-sheet.md`, stating `NarrationFacts` is the sheet's
`settled` record.

## Seams

- **TASK-0267 / spec 097 (planner, lane LI).** The sheet's input is settled engine events and the
  projections that fold them (contract §1). The planner path writes the same events through the
  engine, so the sheet runs unchanged after TASK-0268 and TASK-0269 (F4). Spec 097 names the type
  `PlanFact` in `@the-stacks/planner`; this spec names `FactRow` in `apps/server/src/dm/fact-sheet.ts`
  (097 OQ-10 agreed). Contract §6 defines the later `PlanFact` → `why` row mapping; TASK-0272 adds
  it after TASK-0268 merges. This card adds no planner import and shares no file with 0267 or 0268.
- **Home justification.** `apps/server/src/dm/fact-sheet.ts`, not `packages/session-model`: every
  consumer is server code; `session-model` cannot import the planner (it sits below it in
  target-architecture §8), so the `PlanFact` mapping could not live there; and `session-model`'s
  catalog and events are serial hotspots for five lanes. Revisit when TASK-0247 renders rows in
  the web (spec OQ-2).
- **TASK-0272 (lane LN, next).** Builds the leak and contradiction check on `sheet` + `slots` and
  retires the audit loop, claim gate and fallback. It may switch narrate to a structured slot
  schema (spec OQ-10).
- **TASK-0215 (lane LS).** Adds a startle `involuntary` trigger to `buildNarrationFacts`; the sheet
  carries it in `settled`. Hotspot `dm/facts.ts`, `dm/prompts/narrate.ts`: 0215 lands after this.
- **TASK-0298 (narration streams).** Tagged slots stream as text; the client can show blocks as
  tags arrive.
- **TASK-0247 (MUD stream).** Takes rows out of the narration text and renders them from the ledger
  at resolve time (spec OQ-3).

## Files touched

| File | Change | Design |
|---|---|---|
| `apps/server/src/dm/fact-sheet.ts` (new) | sheet, rows, State line, slots, compose | D1 |
| `apps/server/src/dm/facts.ts` | `renderChangeLine` for four kinds; `renderDiceLines` alias | D1, D2 |
| `apps/server/src/dm/nodes/narrate.ts` | build sheet; parse and compose slots; output shape | D3 |
| `apps/server/src/dm/prompts/narrate.ts` | slot rules and sections; `dm.narrate-v22` | D4 |
| `apps/server/src/dm/nodes/audit.ts` | omission filter; agency on describe+ask; compose | D5 |
| `apps/server/src/dm/prompts/audit.ts` | restate note; `dm.audit-v17` | D5 |
| `apps/server/src/dm/fallback.ts` | `forSheet` option | D6 |
| `apps/server/src/dm/talk-turn.ts` | escalate State line | D7 |
| `apps/server/src/playtest/auditor/checks.ts` | row forms, State line, relevant types | D8 |
| `apps/web/app/play/components/transcript.tsx` | `whitespace-pre-line` | D9 |
| `apps/server/test/dm/fact-sheet.test.ts` (new) | branch table, rows per kind, no-`?`, slots | D1 |
| `apps/server/test/dm/fact-sheet-replay.test.ts` (new) | run 1 seq 15-20 replay | D3 |
| `apps/server/test/dm/fixtures/run1-seq15-20-clarify.json` (new) | reconstructed beat | D3 |
| `apps/server/test/dm/facts.test.ts` | change rows | D2 |
| `apps/server/test/dm/narrate.test.ts` | output shape, template order, closure covers fact-sheet | D3 |
| `apps/server/test/dm/audit.test.ts` | omission not blocking; restate skipped by agency | D5 |
| `apps/server/test/dm/fallback.test.ts` | `forSheet` | D6 |
| `apps/server/test/dm/player-facing-prompts.test.ts` | prompt sections | D4 |
| `apps/server/test/playtest/checks.test.ts` | new row forms, State line | D8 |
| `apps/server/test/dm/*.integration.test.ts` touching narration text | update text expectations only | D3 |
| `apps/web/test/play/table-view.test.tsx` | pre-line class on narration | D9 |
| `specs/034-narration-quality/contracts/narration-facts.md` | pointer section | D10 |
| `docs/wiki/{dm-narration-quality,dm-runtime,output-claim-gate,dm-talk-triggers,playtest-harness}.md`, `INDEX.md`, `CAPSULES.md` | re-ground | Phase 5 |

Prompt versions: `dm.narrate-v21` → `dm.narrate-v22`; `dm.audit-v16` → `dm.audit-v17`. `dm.react-v2`
unchanged (talk replies get no slots).

Not touched: `apps/web/app/play/ledger-format.ts` (spec OQ-8), `dm/claims.ts`, `dm/pipeline/call.ts`,
`packages/session-model/` (no catalog change), `ws/protocol.ts`, any fake script JSON (untagged
replies stay valid as `describe`).

**Migrations**: none. **New runtime dependencies**: none.

## Risks

- **Models ignore tags.** Degrades to `describe` with the code restate; the reply ships in shape.
  CP-7 counts tagged replies (watch line in TASK-0278 if wanted).
- **Integration tests asserting exact narration text.** About 11 assert on text; each gains rows and
  a State line. Phase 3 updates expectations, never behaviour.
- **Auditor drift.** `expectedDiceLines` and `renderRows` must stay identical; `checks.test.ts`
  pins one case per row kind.
