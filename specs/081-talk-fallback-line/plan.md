# Implementation Plan: Talk fallback voices the line

**Branch**: `task-0207-talk-fallback-line` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/081-talk-fallback-line/spec.md`, runbook A playtest run 1 finding 15 (PR #109),
runbook B lane B4 and merge spine #10 (`docs/design/m3-runbook-b-resolution-quality.md`). This
plan assumes OQ-1 to OQ-4 (a). Research and design are small, so they live in this file; there is
no separate research.md, data-model.md or quickstart.md.

## Summary

Give the interpret reading an optional `say` line for a speaking monster. Carry it through the
narration facts on the monster's plan. Render it for the narrator and the audit. In the fallback,
`plannedSentence` voices it as attributed quoted speech before it tries the planned reasons. The
existing `reasonSpeakable` filter guards it. Player readings never voice it.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: none. **No migration.** No event shape change.
**Testing**: Vitest unit tests with the scripted fake gateway (no DB).
**Target Platform**: server DM pipeline (schema, interpret prompt, facts, narrate node, narrate and
audit prompts, fallback).
**Constraints**: no frozen contract changes. The `fallback.ts` change stays inside
`plannedSentence`. Every new field is optional, so old scripts, checkpoints and test literals
still parse and compile. Prompt versions bump to "the next version" at build time: siblings bump
them first (see Overlap).
**Scale/Scope**: 7 source files, 1 new test file, 5 extended test files, 3 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the DM pipeline is the agent path. The line is a typed field of the
      interpret output, read by code. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. The line is this turn's interpret output, held in the
      existing job checkpoint.
- [x] **IV. Event sourcing**: no event changes. The line reaches the log only as narration text.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic change. `say` is not a step; the engine never sees
      it. The fallback filter refuses digits and dice words in it.
- [x] **VII. Structured first**: the line is a schema field, rendered by code into one fact line
      and one fallback sentence.
- [x] **VIII. Operator-owned content**: no content change.
- [x] **IX. Self-hostable**: no new service or dependency.

## Research

- **R1 — The line had no home.** `InterpretReadingSchema` has `steps`, `clarify` and `followUps`.
  None of them holds speech. In run 1 the model put Pell's words in `followUps` and a rules note
  ("no roll needed") in the `none` reason.
- **R2 — `followUps` cannot carry it.** `followUps` mean held-back steps (spec 064). Narrate renders
  a player action's follow-ups as `not yet attempted:` lines, and `pipeline/runner.ts` counts any
  non-empty list as a cut beat (`cutBeat`). The facts drop the NPC reading's follow-ups entirely
  (`nodes/narrate.ts` keys them by `actionId`, which is null). Reusing them would voice a deferred
  step as speech and keep the Director hold side effect (spec OQ-3).
- **R3 — The fallback filter exists.** `reasonSpeakable` (`fallback.ts`, spec 071) spells digits
  and refuses a digit, a system word, a dice word, a death or unconscious word, a `?`, and a claim
  the state refutes. It is the guard the line needs.
- **R4 — Quotes pass the claim gate.** `checkClaims` blanks quoted text for its act and speech rule
  (`maskQuotes`), so a living monster quoted as speaking passes. "calls out" uses the speech verb
  `call` with the monster as subject, which is the same claim class as today's "speaks up".
- **R5 — The run 1 rows are off-repo.** The session lives on vm-104. The replay rebuilds the beat
  from finding 15 and the `greyhollow-ford-reed-camp` seed names (Pell Marsh; Goblin with a
  pot-helm), and names that source in its header.

## Design

### D1 — `apps/server/src/dm/nodes/schemas.ts`: the `say` field (FR-001)

One hunk: the `InterpretReadingSchema` field list. After the `followUps` line, add:

```ts
    say: z.string().min(1).max(200).nullable().optional(), // a monster's spoken line (specs/081)
```

`optional` keeps the inferred type `say?: string | null`, so no existing literal changes.
`StepSchema`, `AdjudicateModelOutput` and the `superRefine` are untouched.

### D2 — `apps/server/src/dm/prompts/interpret.ts`: interpret next version (FR-002)

Four hunks:

1. `PROMPT_VERSION`: the next `dm.interpret-v<n>` past main at build time.
2. `EXAMPLE_OUTPUT.readings[0]`: add `say: null` after `followUps: []`.
3. `OUTPUT_SHAPE[1]` (the JSON shape line): add `"say":str|null` after `"followUps":[str]`.
4. `OUTPUT_SHAPE`: a NEW array element right after the rule paragraph (element 2). Do not append
   to element 2: spec 070 and spec 079 both append sentences there. The new element:
   "On a monster turn, put the words the monster speaks this beat in say: one short line, at most
   200 characters, no quote marks. Otherwise set say null. Never put speech in followUps. Write
   each reason as what the actor does, with no rules note such as whether a roll is needed."

`prompts/step-grammar.ts` and `prompts/adjudicate.ts` are unchanged: `say` is not a step field.

### D3 — `apps/server/src/dm/facts.ts`: the line on the plan (FR-003, FR-006)

- `FactNpcPlan` gains `say?: string | null`.
- `BuildFactsInput.npcPlan` gains `say?: string | null`.
- In `buildNarrationFacts`, the `plan` literal gains
  `say: refused ? null : (input.npcPlan?.say?.slice(0, PLAN_MAX_CHARS) ?? null)`, and `held`
  becomes `refused || (steps.length === 0 && !say)`.

### D4 — `apps/server/src/dm/nodes/narrate.ts`: pass and filter the line (FR-003)

- The `npcPlan` literal gains `say: reading.say ?? null`. The line comes from the reading even
  when a ruling replaces the steps.
- `withholdRefusedInputs`: when `facts.npcTurn?.plan?.say` is set and
  `refuse("monster line", say)` is true, return the facts with `npcTurn.plan.say = null`.

### D5 — `apps/server/src/dm/prompts/narrate.ts` and `prompts/audit.ts`: the `says:` line (FR-007)

- `factEntries`: under `Monster turn: <name>`, after the `planned:` line, write `  says: <line>`
  when `plan.say` is set and `plan.held` is false.
- `RULES` gains one rule after the Turn rule: "When the Monster turn has a says: line, the monster
  speaks those words in this beat."
- `narrate.ts` `PROMPT_VERSION` and `audit.ts` `PROMPT_VERSION`: the next version each past main
  at build time. The audit renders `factEntries`, so its prompt changes too.

### D6 — `apps/server/src/dm/fallback.ts`: `plannedSentence` only (FR-004, FR-005, FR-008, FR-009)

Inside the `if (plan && !plan.held)` block, before the reasons loop:

```ts
    const said = spellDigits((plan.say ?? "").replace(/["“”]/g, ""))
      .replace(/[.!]+$/, "")
      .trim();
    const line = `${name} calls out, "${said}."`;
    if (said && reasonSpeakable(said, state) && (!state || checkClaims(state, line).pass))
      return line;
```

The reasons loop, the intent sentences and the hold sentence stay as they are. The player action
loop in `factualSummary` is not touched, so a player reading's `say` is never voiced (FR-008).

### OQ defaults applied

- OQ-1 (a): D5 is in scope. OQ-2 (a): `?` stays refused. OQ-3 (a): `runner.ts` is not touched; the
  orchestrator cards the NPC `followUps` hold. OQ-4 (a): the line alone, no reason sentence beside it.

## Contracts (additive amendments, none frozen)

- `specs/031-dm-runtime/contracts/nodes.md`: an "Amendment (specs/081-talk-fallback-line)"
  section: the reading's `say` field and the prompt rule.
- `specs/034-narration-quality/contracts/fallback-summary.md`: amend the row "NPC turn, no roll":
  a speakable `say` line first, as `<Name> calls out, "<line>."`, under "Amended by spec 081
  (TASK-0207)".
- `specs/034-narration-quality/contracts/narration-facts.md`: add `  says: <line>` to the turn
  marking row, under the same note.

## Tests

- `apps/server/test/dm/talk-fallback-line.test.ts` (new; the merge condition, FR-010). A run 1
  replay without a DB, in the pattern of `npc-turn-narration.test.ts`. Turn mode with Pell Marsh
  active (grappled, conscious), the pot-helm goblin next, a `turn.advanced` row to it. Pell's
  reading: `intent: "talk"`, one `none` step whose reason is run 1's rules note, `say` holding a
  line built from finding 15 (for example "The clapper's tied with a wet slip-knot! Two more hide
  left of the fire!"). Its header names the source (PR #109 finding 15, seq 124–126). Cases:
  1. Three refused audits (run 1's kinds: `player-agency`, `invented-mechanics`, `doctrine`) →
     the shipped text holds `Pell Marsh calls out, "` and Pell's words, and not "speaks up".
  2. The narrate and audit prompts hold `  says: ` under `Monster turn: Pell Marsh`.
  3. The run 1 reading as it was (no `say`, the line in `followUps`) still ships today's
     "Pell Marsh speaks up." This pins why AC #2 needs the field.
  4. A refused plan (plan gate `ok: false` for `null`) → "Pell Marsh holds back, watching."
- `apps/server/test/dm/fallback.test.ts`: a speakable `say` line is voiced; a line with a dice
  word, a death word or a `?` falls back to the spec 071 sentence; quote marks are stripped;
  digits are spelled. The property generator gains a random `say` on monster plans.
- `apps/server/test/dm/facts.test.ts`: `say` from `npcPlan`; refused plan gives `say: null`; a
  line with no step is not held.
- `apps/server/test/dm/narrate.test.ts`: version pins to the next narrate and audit versions;
  `withholdRefusedInputs` drops a refuted line.
- `apps/server/test/dm/interpret-prompt.test.ts`: version pin; the inline snapshot gains
  `"say":str|null`, `say: null` in the example and the new rule element; `InterpretOutput`
  parses a reading with `say` and one without it.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/nodes/schemas.ts` | `InterpretReadingSchema` field list: `say` (D1) |
| `apps/server/src/dm/prompts/interpret.ts` | next version, example, shape line, new rule element (D2) |
| `apps/server/src/dm/facts.ts` | `FactNpcPlan.say`, `npcPlan.say` input, `held` rule (D3) |
| `apps/server/src/dm/nodes/narrate.ts` | passes `say`; `withholdRefusedInputs` filters it (D4) |
| `apps/server/src/dm/prompts/narrate.ts` | next version, `says:` fact line, one rule (D5) |
| `apps/server/src/dm/prompts/audit.ts` | next version only (D5) |
| `apps/server/src/dm/fallback.ts` | `plannedSentence` voices the line (D6) |
| `apps/server/test/dm/talk-fallback-line.test.ts` | new: run 1 replay, the merge condition |
| `apps/server/test/dm/fallback.test.ts`, `facts.test.ts`, `narrate.test.ts`, `interpret-prompt.test.ts` | extended |
| `specs/031-dm-runtime/contracts/nodes.md` | additive amendment |
| `specs/034-narration-quality/contracts/fallback-summary.md`, `narration-facts.md` | additive amendments |
| `docs/wiki/dm-narration-quality.md`, `dm-runtime.md`, `dm-talk-triggers.md`, `dm-failure-and-gates.md`, `srd-data.md`, `seed-npc-presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Migrations**: none. **New runtime dependencies**: none.

## Overlap

0207 builds at spine #10, after 0208 (spec 079), 0127 (spec 070) and 0170 (spec 080) merge.
Rebase on main before building and re-read each hunk below.

- **Runbook file list (spine amendment).** The runbook lists 0207 as `nodes/schemas.ts`,
  `prompts/interpret.ts` and `fallback.ts`. The data path adds `facts.ts` and `nodes/narrate.ts`;
  OQ-1 (a) adds `prompts/narrate.ts` and `prompts/audit.ts`. The orchestrator tells the operator
  and amends the runbook. 0212 (spine #11) may run beside 0207 only if it leaves
  `plannedSentence` untouched, as the runbook says.
- **`nodes/schemas.ts`.** Spec 079 appends a `move` option to `StepSchema`. Spec 070 D1 adds
  `StakesSchema`, fields on the `check` step and a `superRefine` walk on `InterpretReadingSchema`.
  Spec 080 is still being authored. This plan adds one line to the `InterpretReadingSchema` field
  list after `followUps`, and nothing else.
- **`prompts/interpret.ts`.** Spec 070 edits `EXAMPLE_OUTPUT` (stakes inside the check step) and
  appends rules to `OUTPUT_SHAPE[2]`. Spec 079 appends one sentence to `OUTPUT_SHAPE[2]`. This plan
  adds `say: null` after `followUps: []` in the example, one token in the shape line, and a new
  array element after the rule paragraph. Each sibling bumps the version; this plan takes the next
  one.
- **`fallback.ts`.** 0208 edits `rollSentences`; 0127 edits `outcomeSentence`. This plan edits
  `plannedSentence` only, and imports nothing new (`checkClaims` and `spellDigits` are already
  in the file).
- **`facts.ts`, `prompts/narrate.ts`, `prompts/audit.ts`.** 0127 and 0170 extend `FactRoll`,
  `rollEntry` and audit criteria, and bump narrate and audit. This plan touches `FactNpcPlan`, the
  `plan` literal in `buildNarrationFacts`, the monster-turn block of `factEntries` and one `RULES`
  line. Take the next versions after theirs.
- **Wiki.** `dm-narration-quality.md`'s prompt-version list is edited by every narration card; the
  later merge reconciles it.

## Open questions

OQ-1 to OQ-4 are in spec.md with recommended defaults (a). This plan implements the defaults.
