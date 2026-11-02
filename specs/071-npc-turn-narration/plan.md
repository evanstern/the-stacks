# Implementation Plan: NPC turn narration

**Branch**: `task-0193-npc-turn-narration` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/071-npc-turn-narration/spec.md`, alpha run 3 findings 14 and 15, runbook A lane
A1 (`docs/design/m3-runbook-a-run3-fixes.md`). This plan assumes OQ-1 to OQ-4 (a). Research,
data model and contracts are small, so they live in this file; there is no separate research.md,
data-model.md or quickstart.md.

## Summary

Carry the monster's planned action into the narration facts, and name whose turn the beat is.
The narrate node already holds the interpret reading and any ruling for the monster turn
(`actionId: null`). It passes the intent and the step reasons to `buildNarrationFacts`, with the
turn holder at the start of the beat. Narrate v7 and audit v4 render a turn line and a planned
action line, and a rule forbids showing the next actor act. The fallback voices a usable planned
reason, else an intent sentence, else a hold sentence. It never writes "makes a move". Separately,
the web transcript names the absent character when the AI DM passes a turn.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest, node:test (web). **No new runtime dependency.**
**Storage**: none. No migration. No event shape change.
**Testing**: Vitest unit tests with the scripted fake gateway (no DB); one web view-model test.
**Target Platform**: server DM pipeline (facts, prompts, fallback, narrate node); web transcript.
**Project Type**: monorepo web service.
**Constraints**: no frozen contract changes (`ws-protocol.md`, spec 029, spec 030 contracts
untouched). Changes to `facts.ts`, `narrate.ts` and `fallback.ts` are additive, because spec 070
(TASK-0127, runbook B) edits them later. `docs/wiki/` is re-pinned in the last phase.
**Scale/Scope**: 9 source files, 1 new test file, 4 extended test files, 2 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the DM pipeline is the agent path. The facts, prompts and fallback
      are code the agent's turn job drives. The floor line is a projection of ledger rows any
      client reads. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. The planned action is read from this turn's interpret
      output; the turn names are read from session projections.
- [x] **IV. Event sourcing**: no event changes. The floor line reads the existing
      `table-mode.changed` row's actor and reason.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic changes. The planned action is prose; no number
      reaches it (the fallback filter refuses digits).
- [x] **VII. Structured first**: the new facts are typed fields, rendered by code into prompt
      lines and fallback sentences.
- [x] **VIII. Operator-owned content**: no content change.
- [x] **IX. Self-hostable**: no new service or dependency.

## Research

- **R1 — The planned action exists and is dropped.** Interpret writes one reading with
  `actionId: null` for a monster turn (`dm/nodes/interpret.ts`, `prompts/interpret.ts`). Its
  `intent` and each step's `reason` say what the monster does. A talk turn plans a `none` step,
  which resolve skips (`resolve.ts`, `case "none": break`). `buildNarrationFacts` reads only
  `resolve.npcTurn` (combatant id and batch ids), so the plan never reaches narrate, audit or
  the fallback. Run 3's Snag line ("Snag makes a move.") is this gap.
- **R2 — The turn is unmarked.** `factEntries` writes `Monster turn: Snag` and
  `Event: Kestrel acts next`. No line says whose beat this is or that Kestrel has not acted. Run 3
  shows both failure modes: the narrator showed the next actor act (the fire goblin, refused as
  `invented-mechanics`), and the auditor refused Snag acting on Snag's own turn (`ledger-mismatch`,
  "the facts say it is Kestrel's turn"). One marking fixes both sides, because `buildAuditPrompt`
  reuses `factEntries`.
- **R3 — Where the plan is read.** The narrate node (`dm/nodes/narrate.ts`) already reads
  `ctx.results.interpret` and `ctx.results.adjudicate` to build clarify and follow-ups. It reads the
  monster's reading and ruling the same way. Resolve's `planGate` verdict for `actionId: null` is on
  `ResolveOutput.planGate`; a refused plan means no step ran, so the facts mark the monster as
  holding. No edit to `resolve.ts` or `gates/plan-gate.ts` is needed.
- **R4 — The fallback filter exists.** `reasonUsable` in `fallback.ts` refuses a digit, a system
  word, a dice word, a death word or a claim the state refutes, then checks the outcome pairing. A
  planned reason has no outcome, so the outcome pairing is skipped for it. The other filters apply
  unchanged, which keeps invariant 5 of the fallback contract (passes `deterministicChecks`).
- **R5 — The absence pass is visible in the ledger.** `runAbsence` (`dm/floor.ts`) submits a
  `floor` `end` proposal as `ai:dm` with a fixed reason. `planFloor` copies that reason onto the
  `table-mode.changed` row, and the projection's ledger row keeps `actor`, `reason` and `before`.
  The planner refuses an AI DM `end` unless the holder is an absent human, so actor `ai:dm` plus
  that reason identifies an absence pass. `before.activeCharacterId` names the absent character.
- **R6 — Run 3's rows are off-repo.** The session lives on vm-104. Per OQ-1 (a) the replay test
  builds the beat from the run 3 log and the `greyhollow-ford-duo` seed, and names that source.

## Design

### D1 — `dm/facts.ts`: the plan and the turn (FR-001, FR-005)

Additive only.

- `FactNpcTurn` gains optional `plan?: { intent: string; reasons: string[]; held: boolean }` (optional so existing literals compile; `buildNarrationFacts` always sets it). `reasons` are
  the planned step reasons in order, at most 4, each cut to 200 characters. `held` is true when the
  plan gate refused the monster's plan, or when the plan has no step.
- `NarrationFacts` gains optional `turn?: { actor: string; next: string | null }`. It is set only
  when the table was in turn mode at the start of the beat. `actor` is the monster's name on a
  monster turn, else the name of the combatant active at the start. `next` is the last
  `turn-advanced` event's name, or null.
- `BuildFactsInput` gains optional `npcPlan?: { intent: string; steps: { reason: string }[] } | null`
  and optional `turnActorId?: string | null`. Absent inputs give today's facts plus an empty plan
  (`intent: "other"`, `reasons: []`, `held: true`). Existing callers and tests keep working.

### D2 — `dm/nodes/narrate.ts`: pass the plan and the turn holder

- `npcPlan`: the reading with `actionId === null`; when a ruling with `actionId === null` exists,
  its steps replace the reading's (as `actionGroupSteps` does in resolve). Intent comes from the
  reading.
- `held`: also true when `resolve.planGate` has a verdict for `null` with `ok: false`. Pass it as
  part of `npcPlan` (`refused: boolean`), or derive it in `buildNarrationFacts` from
  `input.resolve.planGate`. Choose the second: `resolve` is already an input.
- `turnActorId`: `assembled.projections.encounter?.activeCombatantId ?? null`, only when
  `assembled.projections.tableMode.mode === "turn"`.

### D3 — `dm/prompts/narrate.ts`: narrate v7 (FR-002, FR-006, FR-007)

- `PROMPT_VERSION = "dm.narrate-v7"`.
- `factEntries` writes, first when `facts.turn` is set:
  `Turn: <actor> acts in this beat.` and, when `next` is set,
  `Next: <next> acts after this beat and has not acted yet.`
- Under `Monster turn: <name>`: `  planned: <intent>; <reason>; <reason>` when reasons exist, and
  `  held: the plan did not go ahead` when `held` is true. When there is no roll, add
  `  no rules effect (nothing rolled; <name> still acts in the story)`.
- One new rule in `RULES`, after "Cover every Event line.":
  "Only the actor named on the Turn line acts in this beat. The actor on the Next line has not
  acted: never show them move, speak or strike."
- Keep the `Event: <next> acts next` line; the fallback and events depend on it.

### D4 — `dm/prompts/audit.ts`: audit v4 (FR-008)

- `PROMPT_VERSION = "dm.audit-v4"`.
- One new numbered definition: "6. The actor on the Turn line acts in this beat, with or without a
  roll; showing it act is not a mismatch. Showing the actor on the Next line act is
  `invented-mechanics`."
- The fact lines arrive through `factEntries`, unchanged in code.

### D5 — `dm/fallback.ts`: say what the monster did (FR-003, FR-004, FR-009)

- Split `reasonUsable` into `reasonSpeakable(reason, state)` (digit, system word, dice word, death
  word, claims) and the existing outcome pairing. `reasonUsable` calls `reasonSpeakable` first.
  Behavior for roll reasons is unchanged.
- In the `facts.npcTurn` branch, when the turn has no rolled outcome:
  1. If not `held`, voice the first speakable planned reason as a sentence (digits spelled,
     trailing punctuation normalized), as the roll reasons are.
  2. Else, or if no reason is speakable, write the intent sentence: talk
     `<Name> speaks up.`; move `<Name> shifts ground.`; help `<Name> lends a hand.`; any other
     intent, or `held`, `<Name> holds back, watching.`
- The string "makes a move" is removed. Contract row "NPC turn, no roll" is amended (see
  Contracts).

### D6 — Floor-pass line (FR-010)

- `packages/session-model/src/gate/turn.ts` exports
  `ABSENCE_PASS_REASON = "The AI DM passes the turn of an absent player."`; `src/index.ts`
  re-exports it.
- `apps/server/src/dm/floor.ts` uses the constant instead of the literal.
- `apps/web/app/play/view-model.ts`: in the floor loop, when `row.actor === "ai:dm"` and
  `row.reason === ABSENCE_PASS_REASON` and `row.before` is a turn mode with an
  `activeCharacterId`, the text is `<absent> is away; the turn passes to <holder>.`, or
  `<absent> is away; your turn.` for the new holder. Every other floor line is unchanged.

## Contracts (additive amendments)

- `specs/034-narration-quality/contracts/fallback-summary.md`: replace the row
  "NPC turn, no roll | `<Name> makes a move.`" with the D5 rules, under a note
  "Amended by spec 071 (TASK-0193)".
- `specs/034-narration-quality/contracts/narration-facts.md`: add the `Turn:`, `Next:`,
  `planned:` and `held:` lines to the line table, under the same note.
- No frozen contract changes.

## Tests

- `apps/server/test/dm/npc-turn-narration.test.ts` (new; the merge condition, FR-011). A run 3
  replay without a DB, in the pattern of `narration-quality-repro.test.ts`: projections for the
  duo table in turn mode with Snag active (encounter order Snag, Kestrel, Tamsin, Odo), a monster
  turn whose interpret reading is `intent: "talk"` with one `none` step whose reason is Snag's
  parley line, no rolls, and a `turn.advanced` row to Kestrel. Its header names the source
  (run 3 log finding 15 and the duo seed, OQ-1 (a)). Cases:
  1. The narrate prompt holds `Turn: Snag acts in this beat.`, the `Next: Kestrel …` line, the
     `planned:` line and the new rule; the audit prompt holds the same turn lines and definition 6.
  2. Passing path: scripted narrate prose describing Snag's parley, audit `pass` → shipped prose
     is that text, `fallback: false`.
  3. Fallback path: three refused audits (the run 3 kinds) → the shipped text holds Snag's
     planned reason and never "makes a move".
  4. Held path: plan gate verdict `ok: false` for `null` → the fallback says
     "Snag holds back, watching."
- `apps/server/test/dm/fallback.test.ts`: update "an NPC turn with and without a roll"; add the
  intent sentences; extend the property generator with monster plans.
- `apps/server/test/dm/facts.test.ts`: `plan` and `turn` from the new inputs; absent inputs give
  today's facts plus the empty plan.
- `apps/server/test/dm/narrate.test.ts`: version pins to `dm.narrate-v7` and `dm.audit-v4`.
- `apps/web/test/play/view-model.test.mjs`: an absence pass line per viewer; a normal turn advance
  keeps "<name>'s turn".

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/facts.ts` | `FactNpcTurn.plan`, `NarrationFacts.turn`, two optional inputs (D1) |
| `apps/server/src/dm/nodes/narrate.ts` | passes `npcPlan` and `turnActorId` (D2) |
| `apps/server/src/dm/prompts/narrate.ts` | v7: turn lines, plan lines, one rule (D3) |
| `apps/server/src/dm/prompts/audit.ts` | v4: definition 6 (D4) |
| `apps/server/src/dm/fallback.ts` | `reasonSpeakable`, planned sentence, intent and hold sentences (D5) |
| `apps/server/src/dm/floor.ts` | uses `ABSENCE_PASS_REASON` (D6) |
| `packages/session-model/src/gate/turn.ts` | exports `ABSENCE_PASS_REASON` (D6) |
| `packages/session-model/src/index.ts` | re-exports it (D6) |
| `apps/web/app/play/view-model.ts` | absence-pass floor line (D6) |
| `apps/server/test/dm/npc-turn-narration.test.ts` | new: run 3 replay, the merge condition |
| `apps/server/test/dm/fallback.test.ts`, `facts.test.ts`, `narrate.test.ts` | extended |
| `apps/web/test/play/view-model.test.mjs` | extended |
| `specs/034-narration-quality/contracts/fallback-summary.md`, `narration-facts.md` | additive amendments |
| `docs/wiki/dm-narration-quality.md`, `dm-runtime.md`, `turn-floor.md`, `play-route.md`, `presence.md`, `test-suite.md`, `session-model.md`, `proposal-gate.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Migrations**: none. **New runtime dependencies**: none.

## Overlap

- **Spec 068 (TASK-0194, lane A2): no shared source file.** This plan does not edit
  `dm/gates/plan-gate.ts`, `dm/snapshot/build.ts` or `dm/nodes/resolve.ts`. It reads
  `ResolveOutput.planGate`, an existing field, without changing it. It does not edit
  `dm/nodes/schemas.ts` or `dm/prompts/interpret.ts` (OQ-2 (a)). Shared wiki note: `dm-runtime.md`
  (068 re-grounds it too); the later merge reconciles it.
- **Spec 070 (TASK-0127, runbook B):** edits here to `facts.ts`, `narrate.ts` and `fallback.ts`
  are additive (new optional fields, new lines, one split helper). Spec 070 extends
  `NarrationFacts` after this lands.
- **TASK-0189 (lane A3):** both edit `dm-narration-quality.md`'s prompt-version list
  (companion v6 is on main). The later merge reconciles the list.
- **TASK-0191 / TASK-0164 (lane A4):** they edit `table-view.tsx` and turn-order components, not
  `view-model.ts`. No shared source file.

## Open questions

OQ-1 to OQ-4 are in spec.md with recommended defaults (a). This plan implements the defaults.
