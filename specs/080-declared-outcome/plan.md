# Implementation Plan: Declared outcome — success means the attempted task happens

**Branch**: `task-0170-declared-outcome` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/080-declared-outcome/spec.md`, the operator rule of 2026-10-28 on TASK-0170, and
spec 070's plan (D1, D4, D6). This plan assumes OQ-1 to OQ-4 at (a). It builds after TASK-0127
(spec 070) merges, spine #9.

Research, design and contracts live in this file, as in specs 070 and 079. No separate research.md,
data-model.md or quickstart.md.

## Summary

Spec 070's `stakes.success` becomes required, and every band text is written as the concrete outcome
of this attempt. A check step gains `reveals`, a reference to one discoverable clue of the current
beat, which interpret now sees. Resolve records the reference and its clue text on the submission.
`FactRoll.consequence` carries the applied band's text for every band, and a new
`FactRoll.revealed` carries the clue text on a success. Narrate, audit and the fallback treat both as
settled fact the prose must deliver. The seeds name the goblins behind the claw marks.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: `jobs.result` JSON (interpret output, submissions). **No migration.**
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway.
**Target Platform**: the server's DM runtime.
**Project Type**: monorepo web service.
**Performance Goals**: no new model call. Interpret input grows by at most 8 clue lines.
**Constraints**: frozen contracts unchanged (`ws-protocol.md` frames, `specs/029-proposal-gate/
contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). No engine change. No number.
**Scale/Scope**: 11 source files, 4 seed files, 19 JSON fixtures, 18 test files (1 new) plus 1 new
fixture, 4 contract amendments, 5 wiki notes plus CAPSULES/INDEX.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no human-only path. Clue edits are seed data an agent writes.
- [x] **II. Content contract**: the seed schema is unchanged; one clue text per seed changes and
      still validates. The step contract gains one Zod-validated field.
- [x] **III. Data planes**: session plane only. The seed is read as today.
- [x] **IV. Event sourcing**: no new event type, no payload change. Outcome and clue text stay in
      `jobs.result` and in-memory facts, never in a public row.
- [x] **V. Citations**: no rules claim. N/A.
- [x] **VI. 5e engine boundary**: no number is added, read or rendered. The band stays the engine's.
- [x] **VII. Structured first**: `reveals` is a typed reference, not a prose blob.
- [x] **VIII. Operator-owned content**: the clue text is original project content.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — 070 already carries most of the seam.** Spec 070 D1 has `stakes.success` nullable "TASK-0170
  makes this required". D4's `consequenceFor(stakes, band)` returns the text for a non-success band
  only. D6's `FactRoll.consequence` follows it. This card flips the nullability, widens
  `consequenceFor` to every band, and adds `revealed`. No second outcome field.
- **R2 — Interpret never sees clues today.** `seedEntries` (`prompts/common.ts`) renders goal,
  location, active encounter and present NPCs. No prompt reads `beats[].clues`. The model can name a
  seed fact only from the transcript. A discoverable-clues section is the minimum change.
- **R3 — Which beat.** The Director's `pacing.beatId` is the only current-beat signal. Narrate
  already reads it (`nodes/narrate.ts` ~line 186). Interpret receives `director` already. A null or
  unknown beat id yields an empty list.
- **R4 — Clue reference form.** Clues have no id until TASK-0148. `RefIdSchema`'s regex
  (`^[a-z0-9][a-z0-9_.:-]{0,63}$`) refuses `#`, so the reference is a plain string `<beatId>#<n>` checked by
  its own regex `^[a-z0-9][a-z0-9_.:-]{0,63}#[1-8]$`. Resolution is code: `clueFor(seed, ref)`.
- **R5 — Clue text is DM-only until found.** `dmOnlyEntries` (`seed/views.ts`) lists every clue
  text. The player-facing prompt leak test (`player-facing-prompts.test.ts`) asserts no DM-only text
  in any narrate prompt. A revealed clue in a narrate prompt would trip it, and a revealed clue is
  the point. The test's fixtures carry no `revealed`, so it stays green; a new case asserts only the
  named clue, only on success, reaches narrate (spec US2 #3, #4).
- **R6 — Hidden-info auditor.** The playtest auditor's `hiddenStrings` covers location and NPC
  `secrets` only (`playtest/auditor/checks.ts` ~line 284). A narrated clue does not trip it. No
  change.
- **R7 — The seed lacks the answer (OQ-2).** The ferry-house clue 1 says "Small clawed footprints"
  in all three `greyhollow-ford*` seeds and the spec 031 data copy. `seed.test.ts` asserts the base
  seed is a byte copy of the spec copy, so both change together. The reed-camp seed has no
  ferry-house beat.
- **R8 — No capture (OQ-3).** Run 1 of 2026-10-28 was lost. Run 5 seq 199–204 (2026-10-26,
  `specs/034-narration-quality/evidence/run5-…/transcript.jsonl`) holds a `dice.rolled`, a
  `check.resolved` and a narration with a 23 vs DC 12 tracking success. Its row shapes, with Tamsin's
  action text and a marks-only prose, make the reconstructed fixture.
- **R9 — Old checkpoints.** Resumed readings come from `turn.checkpoint.interpret` and are not
  re-parsed (`resume.ts` ~line 101; `assemble.ts` `selectResumed`). A reading saved under 070 may hold
  `success: null`. Readers treat null as no text; `reveals` is read as `step.reveals ?? null`.
- **R10 — Fixture blast radius.** Spec 070 Phase 2 adds `stakes` to every check fixture, with
  `success` nullable. This card fills every null `success`. On `origin/main` b79489e2 there are 19 JSON
  fixtures with check steps (5 more than 070's list: `free-pell`, `approach-reed-camp`,
  `reveal-snag`, `shoot-snag`, `runbook-a-reed-camp`). 070's build covers all 19 because its schema
  makes `stakes` required. 070's `checkStep()` builder default gains a success text here.

## Design

### D1 — Step contract delta (`apps/server/src/dm/nodes/schemas.ts`)

On spec 070's `StakesSchema`:

```ts
export const StakesSchema = z.object({
  success: StakeText,              // was .nullable() in spec 070 (card AC #1)
  cost: StakeText.nullable(),
  failure: StakeText,
  severe: StakeText.nullable(),
});
export const ClueRefSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}#[1-8]$/);
// check step gains:
//   reveals: ClueRefSchema.nullable().default(null),
```

070's ability-check `superRefine` is unchanged. No new refinement: a `reveals` that names no clue is
a resolve-time null (FR-005), not a parse failure, so a model typo never fails the turn.

### D2 — Interpret and adjudicate prompts

- `prompts/common.ts`: new `clueEntries(seed, beatId)` → `<beatId>#<n>: <text> (found with
  <ability> <skill>)` for each clue of that beat; `[]` when the beat is null or unknown. No DC.
- `prompts/interpret.ts`: a new user section `section("Discoverable clues", clueEntries(ctx.seed,
  director.pacing.beatId), 1200, "end")`, placed after "Scene seed". `OUTPUT_SHAPE` gains one sentence
  with the FR-003 rules. `EXAMPLE_OUTPUT`'s check step gains a success text naming the found thing and
  `reveals`. `PROMPT_VERSION` bumps one past `main`.
- `prompts/step-grammar.ts`: the check line gains `"reveals":clue ref|null`. The closing sentence
  "A narrative outcome such as spotting, learning or noticing something is narration, not an effect:
  leave onSuccess empty." gains "; write what is learned in stakes.success and name the clue in
  reveals."
- `prompts/adjudicate.ts`: version bump only (it renders `STEP_GRAMMAR`). Adjudicate sees no clue
  list; its `reveals` is normally null.

### D3 — Resolve delta (`apps/server/src/dm/stakes.ts`, `apps/server/src/dm/nodes/resolve.ts`)

- `stakes.ts`: `consequenceFor(stakes, band)` returns the band's text for every band, success
  included (`success-at-cost` → `cost`, `severe-failure` → `severe`, falling back to `failure` when
  `severe` is null). New pure `clueFor(seed, ref)` → the clue text or null.
- `resolve.ts` `case "check"`: after the submission, set `sub.reveals = step.reveals ?? null` and
  `sub.revealedText = clueFor(ctx.seed, sub.reveals)`. Log `dm.reveals.unknown` with the reference
  when the reference is set and the text is null. `Submission` gains `reveals: string | null` and
  `revealedText: string | null`.
- `resume.ts` `refreshSubmission`: unchanged (it spreads `s`, so both fields survive).

### D4 — Facts delta (`apps/server/src/dm/facts.ts`)

- `FactRoll` gains `revealed: string | null`. `consequence` keeps 070's type.
- `collectFacts`: 070's `stakesByBatch` map becomes `outcomeByBatch` carrying `{ stakes, revealedText
  }` (or keeps its name and gains `revealedText`; follow 070's merged shape). `consequence` comes from
  the widened `consequenceFor`. `revealed` is the text when the band is `success` or
  `success-at-cost`, else null.
- `renderRollLine` is unchanged: outcome and clue text never reach the public dice lines.

### D5 — Narration, audit, fallback

- `prompts/narrate.ts` `rollEntry`: 070's `consequence: <text>` becomes `outcome (settled): <text>`
  for every band; a non-null `revealed` adds `  learned (settled): <text>`. The 070 rule line becomes:
  "A roll's band and outcome are settled. A success means the attempted task happens. Deliver the
  outcome and any learned fact plainly in the prose; invent no other." Version bumps one past `main`.
- `prompts/audit.ts`: criterion 2 gains "or does not deliver a roll's settled outcome or learned
  fact". Version bumps one past `main`. `factEntries` is shared, so the audit sees the same lines.
- `fallback.ts`: 070's consequence append runs for a success too. A non-null `revealed` appends one
  more sentence when `checkClaims` passes it.

### D6 — Seeds (OQ-2 (a))

Ferry-house clue 1 in `apps/server/seeds/greyhollow-ford.json`, `greyhollow-ford-duo.json`,
`greyhollow-ford-trio.json` and `specs/031-dm-runtime/data/greyhollow-ford.seed.json` becomes:
"Small clawed footprints, goblin feet by their size and splayed toes, lead from the ferry-house down
to the causeway." The check stays `wis`/`perception`/12. The base seed and its spec copy stay
byte-identical.

### D7 — Claw-marks replay (`apps/server/test/dm/declared-outcome-audit.test.ts`)

Fixture `apps/server/test/dm/fixtures/claw-marks-20261028-reconstructed.json`: the header names it
reconstructed (OQ-3 (a)), cites alpha item 2 and run 5 seq 199–204. Rows: Tamsin's
`action.declared` ("Tamsin looks for what may have made these claw marks."), `dice.rolled` 23,
`check.resolved` 23 vs DC 12 success, and the marks-only prose. The test:

1. Builds facts with stakes `success: "Tamsin reads the prints: goblin feet, small and splayed."` and
   `reveals: "ferry-house#1"` over the duo seed.
2. Asserts the roll fact's `consequence` and `revealed` (card AC #2, #5).
3. Asserts the narrate and audit prompts carry `outcome (settled)` and `learned (settled)` lines and
   the delivery rule (card AC #3).
4. Runs the audit node with a fake gateway: `fail` (`ledger-mismatch`) for the marks-only prose,
   `pass` for a second draft naming goblins. Asserts one regenerate and that the shipped prose
   matches `/goblin/i` (card AC #4, runbook merge condition).
5. Runs it again with every draft failing. Asserts the fallback ships and matches `/goblin/i`.

## Shared-file hunks

Exact hunks this card edits in files other spine tasks also edit. Each build re-reads the merged
tree first.

| File | This card's hunk | Neighbours in the same file |
|---|---|---|
| `nodes/schemas.ts` | `StakesSchema.success` nullability; `ClueRefSchema`; `reveals` on the `check` option | 070 adds `StakesSchema` and check fields; 079 appends a `move` option after `roll`; 082 (TASK-0104, after) replaces `expression`/`dc` on `check` |
| `prompts/interpret.ts` | one user section after "Scene seed"; one `OUTPUT_SHAPE` sentence; `EXAMPLE_OUTPUT` check step; version | 070 adds stakes to the example and three rules; 079 adds one rule sentence; 082 changes modifier text |
| `prompts/step-grammar.ts` | the `check` line's `reveals`; the narrative-outcome sentence | 070 adds stakes fields; 079 adds a `move` line |
| `prompts/common.ts` | new `clueEntries` function only | none in spine B |
| `stakes.ts` | `consequenceFor` body; new `clueFor` | 070 creates the file |
| `nodes/resolve.ts` | `case "check"` after the submission (two assignments, one log); `Submission` two fields | 070 rewrites `case "check"` and adds `band`/`stakes`; 079 adds `case "move"`; 082 changes the `check.roll` command fields |
| `facts.ts` | `FactRoll.revealed`; the `collectFacts` lookup that fills `consequence` | 070 adds `band`/`margin`/`consequence`/`autoSuccess`; 079 adds `FactRoll.reaction` |
| `prompts/narrate.ts` | `rollEntry` outcome and learned lines; 070's rule line; version | 070 adds the consequence line and rule; 079 adds a reaction line and a followUp line |
| `prompts/audit.ts` | criterion 2 sentence; version | 070 adds the band criterion |
| `fallback.ts` | 070's consequence append condition; one `revealed` sentence | spine order 0209 → 0208 → 0127 → **0170** → 0207 → 0212 → 0213 → 0214 |

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Step contract, prompts, fixtures (Phase 1)**
- `apps/server/src/dm/nodes/schemas.ts`
- `apps/server/src/dm/prompts/common.ts`
- `apps/server/src/dm/prompts/interpret.ts`
- `apps/server/src/dm/prompts/step-grammar.ts`
- `apps/server/src/dm/prompts/adjudicate.ts`
- `apps/server/test/dm/helpers.ts` (070's `checkStep()` default success text)
- `apps/server/test/dm/interpret.test.ts`
- `apps/server/test/dm/interpret-prompt.test.ts`
- TS tests that build check steps by hand, where a null success remains after 070:
  `apps/server/test/dm/adjudicate.integration.test.ts`, `beat.integration.test.ts`,
  `first-stage.test.ts`, `presence-effect.test.ts`, `rules-terms.test.ts`, `runner.test.ts`,
  `world.ts`
- `apps/server/src/dm/first-stage.ts` (only if its check-step type narrowing breaks; it reads steps,
  never builds stakes)
- JSON fixtures with check steps (fill every null `stakes.success`):
  `apps/server/dm-scripts/greyhollow-human-dm.json`, `greyhollow-live.json`,
  `greyhollow-plan-approach.json`, `runbook-a-reed-camp.json`;
  `apps/server/test/dm/scripts/approach-reed-camp.json`, `audit-advisory.json`,
  `audit-fallback.json`, `audit-regenerate.json`, `encounter-end-bargain.json`,
  `exploration-check.json`, `free-pell.json`, `greyhollow-ford-full.json`,
  `human-dm-approval.json`, `human-dm-roll-chain.json`, `plan-approach.json`, `reveal-snag.json`,
  `shoot-snag.json`, `social-adjudicated.json`;
  `apps/server/test/playtest/fixtures/downed-seat.json`

**Seeds (Phase 1)**
- `apps/server/seeds/greyhollow-ford.json`
- `apps/server/seeds/greyhollow-ford-duo.json`
- `apps/server/seeds/greyhollow-ford-trio.json`
- `specs/031-dm-runtime/data/greyhollow-ford.seed.json`

**Resolve and facts (Phase 2)**
- `apps/server/src/dm/stakes.ts`
- `apps/server/src/dm/nodes/resolve.ts`
- `apps/server/src/dm/facts.ts`
- `apps/server/test/dm/stakes.test.ts`
- `apps/server/test/dm/resolve.integration.test.ts`
- `apps/server/test/dm/facts.test.ts`

**Narration, audit, fallback, replay (Phase 3)**
- `apps/server/src/dm/prompts/narrate.ts`
- `apps/server/src/dm/prompts/audit.ts`
- `apps/server/src/dm/fallback.ts`
- `apps/server/test/dm/narrate.test.ts`
- `apps/server/test/dm/audit.test.ts`
- `apps/server/test/dm/fallback.test.ts`
- `apps/server/test/dm/player-facing-prompts.test.ts` (one case: only the revealed clue, only on
  success)
- `apps/server/test/dm/declared-outcome-audit.test.ts` (new)
- `apps/server/test/dm/fixtures/claw-marks-20261028-reconstructed.json` (new)

**Contract amendments (Phase 4)**, each marked "Amended by specs/080-declared-outcome"
- `specs/031-dm-runtime/contracts/nodes.md` (check step `stakes.success` required, `reveals`;
  interpret's discoverable-clues section)
- `specs/031-dm-runtime/contracts/resolve.md` (`Submission.reveals`, `revealedText`)
- `specs/034-narration-quality/contracts/narration-facts.md` (`consequence` for every band,
  `revealed`)
- `specs/034-narration-quality/contracts/audit-criteria.md` (delivery criterion)

**Wiki (Phase 4)**
- `docs/wiki/dm-narration-quality.md`, `dm-runtime.md`, `dm-failure-and-gates.md`,
  `seed-npc-presence.md`, `dm-turn-jobs.md` (re-pin; `resolve.ts`), plus a computed re-pin of every
  other note that lists a touched file
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`

**Not touched**: `packages/dnd5e-engine/` (no number), `packages/session-model/`,
`seed/schema.ts`, `seed/views.ts`, `gates/plan-gate.ts` (070 already claim-checks every stakes text;
`reveals` is not prose), `nodes/audit.ts` (OQ-4 (a)), `playtest/auditor/` (R6),
`apps/web/` (no public row changes), every frozen contract.

**Migrations**: none. **New runtime dependencies**: none. **New event types**: none.

## Risks

- **070's merged shape differs.** Field and helper names may move during 070's build. The build reads
  070's merged code first and records any rename in this file.
- **The model writes a success that adds a PC choice.** TASK-0113's agency rule and audit check still
  run on the prose. The FR-003 sentence says the outcome is what happens to the task and the world.
- **Interpret input grows.** At most 8 clue lines, capped at 1,200 characters.
- **A clue in a success text, not `reveals`.** The text still reaches narrate as the outcome; only
  `revealed` is lost. The audit still checks delivery of the outcome.
