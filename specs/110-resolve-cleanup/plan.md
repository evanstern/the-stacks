# Implementation Plan: Resolve loses planner-owned step paths

**Spec**: `specs/110-resolve-cleanup/spec.md` | **Card**: TASK-0312 | **Branch**: `task-0312-resolve-cleanup`
**Authored against**: `origin/main` `e0d4ed33`; spec 104 `plan.md` `f61a0bac`; spec 109 `spec.md`
`fd588db1`; spec 107 `plan.md` `98014bc2`; spec 100 `spec.md` `8d8a9692`.

## Summary

A deletion card. No new behaviour, no new dependency, no migration, no prompt bump. The one
added code path is the old-checkpoint drop (AC #3). Every phase leaves `pnpm ci:check` green.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. Fewer paths; one Intent route. |
| II One Intent vocabulary | Pass, strengthened. The `Step` vocabulary is deleted; Intents are the only plan shape. |
| III Event-sourced, server authority | Pass. No event type changes. Old rows stay valid. |
| IV Three data planes | Pass. No plane touched. Retrieval stays for the rules answerer. |
| V Many views, one state | Pass. No projection change. |
| VI Engine owns the numbers | Pass, strengthened. Legacy amount producers L-1 to L-4 (spec 109) are gone. |
| VII Narration around facts | Pass. The `rulings` fact had no producer; narrate's prompt text is unchanged for every live input, so no version bump. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. The party no longer teleports at encounter start (spec 100 OQ-13). |
| X Grounded claims carry citations | Pass. The adjudicate citation path is unreached; the rules answerer keeps its own citations. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. `dm.adjudicate` purpose kept, so the vm-104 purpose config stays valid (C9). |
| XIII Plan just-in-time | Pass. |

## Design

### D1 — Throw-stub probe (Phase 1, reverted)

Before any deletion, replace the body of each dead entry point with
`throw new Error("TASK-0312 probe: <symbol>")`: `runSteps`, `pullIn`, the gathering block, the
`adjudicate` node, the legacy branch of `checkPlan`'s step loop (`stepIds` call),
`askUndeclared`'s legacy branch, `firstStage`, and the legacy accept in `findResumedPlans`. Run
`pnpm --filter @the-stacks/server test` and the scripted fake-gateway runs. Record each failing
test file and why in `specs/110-resolve-cleanup/probe.md`. Every failure must inject a legacy
input or test a deleted symbol. A failure that does not is a stop: report it, do not delete.
Revert the stubs. The probe file is the evidence for SC-002.

### D2 — Gathering (Phase 2)

Delete `resolve.ts` L1274–1291. Update `scene-start-space.integration.test.ts` L74: assert no
`combatant.placed` row for a party member before `encounter.started`. Keep the camp-reveal and
goblin-placement asserts.

### D3 — Adjudicate removal and cut re-anchor (Phase 3, C-GATE)

- Delete `nodes/adjudicate.ts`, `prompts/adjudicate.ts`, `prompts/step-grammar.ts`,
  `AdjudicateModelOutput`.
- `context.ts`: drop `"adjudicate"` from `NODE_NAMES` and `NodeOutputs`; drop `retrieve` and
  `minSimilarity` from `NodeDeps` when typecheck shows no other reader (spec OQ-2).
- `runner.ts`: drop `needsAdjudication`, the skip branch, and `"adjudicate"` from `CHECKPOINTED`.
  Move the post-planning block (cut, `askUndeclared`, `clarifyHolds`, `holdDirector`, checkpoint
  save with `cut: true`) to run after interpret, guarded by `!ctx.checkpoint.cut` (spec OQ-1).
  Its `rulings` inputs become absent.
- `jobs.ts`: delete `TurnCheckpoint.adjudicate`. Old rows keep the field; it is ignored.
- `worker.ts`, `talk-turn.ts`, `test/dm/helpers.ts`, `test/dm/world.ts`: drop the wiring.
- `resolve.ts`: delete the ruling group and every `ctx.results.adjudicate` read.
- `narrate.ts`, `facts.ts`, `follow-ups.ts`: delete ruling reads, the `rulings` fact, and the
  legacy `npcPlan` branch. `prompts/narrate.ts` L185 loop goes with the fact; for every live input
  the rendered text is identical, so `dm.narrate-v24` stays.
- Keep `purposes.ts`, `playtest/budget.ts`, `schema/jobs.ts` CHECK, `apps/web/app/debug/*`.
- Amend `specs/031-dm-runtime/contracts/node-seam.md` and `contracts/turn-jobs.md`: the runner has
  one conditional branch (audit's bounded loop was retired by spec 103; state what remains), and
  `adjudicate` is a retired node name kept in the stage CHECK for old rows.

### D4 — Step path removal (Phase 4)

- `resolve.ts`: delete `runSteps`, `hitDamage`, `pullIn`, `pullBatchIds`, `actionGroup`'s steps
  branch, `stepActors` use, the `Intent:` rationale branch, the `presenceTargets` Step loop and its
  `rulings` param, and `splitArrivals`' `steps` param (callers pass stakes only). A reading with no
  stages yields an empty chain.
- `reactions.ts` and `test/dm/reactions.test.ts`: delete.
- `plan-gate.ts`: `checkPlan` keeps only the `TURN_HELD` branch for staged groups (declarer as the
  named actor). Delete the D8 list plus `PlanInput` fields read only by it. `heldFor` takes the
  declarer list; its off-turn refusal path (`STEP_ACTOR_MISMATCH`) needs a second named actor,
  which a staged group never has, so delete it. `askUndeclared` keeps the Intent branch only.
- `first-stage.ts`: delete `firstStage` and the steps and ruling branches.
- `stakes.ts`: retype `isFreeRetry`'s argument as its own `FreeRetryCheck` interface (the six
  fields `intent-runner.ts` L232 already passes). Drop the `Step` import.
- `facts.ts` L860 `pullBatchIds` read: delete.

### D5 — Schemas and old checkpoints (Phase 5, AC #3)

- `schemas.ts`: delete `StepSchema`, `Step`, `refineSteps`, `CircumstanceSchema`,
  `OppositionSchema`, `LegacyInterpretReadingSchema`, `LegacyInterpretReading`,
  `AnyInterpretReading`, `hasStages`. `InterpretResult.readings` becomes `InterpretReading[]`.
  Keep the `DifficultySchema` re-export only if an importer remains.
- `resume.ts` `findResumedPlans`: accept a reading only if `InterpretReadingSchema.safeParse`
  succeeds; else `continue` (the action is interpreted again). Delete `ResumedPlan.ruling`.
- `worker.ts` at the `loadCheckpoint(job)` site (L228): add
  `dropLegacyPlan(cp: TurnCheckpoint): TurnCheckpoint` in `resume.ts`. When any
  `cp.interpret.readings` entry fails `InterpretReadingSchema`, return the checkpoint with
  `interpret: null`, `cut: false`, `resumed: null`, and log `dm.checkpoint.legacy-dropped` with the
  job id. `beat`, `director`, `submissions` and `lastSeq` stay, so landed rows replay by marker.
- Tests in `resume.test.ts`: (a) an old-shape reading with an approved paused proposal yields no
  plan; (b) `dropLegacyPlan` clears an old-shape checkpoint and returns a new-shape one unchanged.

### D6 — Test migration rule (all phases)

Delete a legacy test case when a planner test (`packages/planner/test/*`) or an Intent-path test
covers the behaviour. Port it to `stage(...)` fixtures only when nothing covers it. Delete the
legacy fixtures `checkStep`, `attackStep`, `spellStep`, `helpStep`, `reading()` from
`test/dm/world.ts` in Phase 5. Each phase lists its ported cases in the card notes.

## Files

**Deleted**: `apps/server/src/dm/nodes/adjudicate.ts`, `dm/prompts/adjudicate.ts`,
`dm/prompts/step-grammar.ts`, `dm/reactions.ts`; `apps/server/test/dm/adjudicate.integration.test.ts`,
`test/dm/reactions.test.ts`.

**Edited (src)**: `dm/nodes/resolve.ts`, `dm/gates/plan-gate.ts`, `dm/nodes/schemas.ts`,
`dm/pipeline/runner.ts`, `dm/pipeline/context.ts`, `dm/jobs.ts`, `dm/worker.ts`, `dm/talk-turn.ts`,
`dm/resume.ts`, `dm/first-stage.ts`, `dm/follow-ups.ts`, `dm/stakes.ts`, `dm/facts.ts`,
`dm/nodes/narrate.ts`, `dm/prompts/narrate.ts`.

**Edited (tests)**: `test/dm/helpers.ts`, `world.ts`, `plan-gate.test.ts`,
`resolve.integration.test.ts`, `opportunity-attack.integration.test.ts`, `first-stage.test.ts`,
`runner.test.ts`, `resume.test.ts`, `presence-effect.test.ts`, `interpret.test.ts`,
`reveal-waits.test.ts`, `scene-start-space.integration.test.ts`, `fact-sheet-replay.test.ts`,
`assemble.test.ts`, `npc-turn-narration.test.ts`, `spells.integration.test.ts`,
`opposition-and-help.integration.test.ts`, `companion-own-turn.integration.test.ts`,
`derived-numbers.integration.test.ts`, `clarify-keeps-turn.integration.test.ts`,
`fixtures/task-0203-shapes.ts`, `facts.test.ts`, and any other file typecheck flags.

**Edited (docs)**: `specs/031-dm-runtime/contracts/node-seam.md`, `contracts/turn-jobs.md` (C-GATE);
`specs/110-resolve-cleanup/probe.md` (new, Phase 1); wiki notes `dm-runtime`, `dm-plan-gate`,
`dm-failure-and-gates`, `dm-turn-jobs`, plus every note whose `sources` list a deleted file
(`intent-contract`, `dm-talk-triggers`, `party-panel`, `output-claim-gate`, `planner`,
`proposal-gate`, `seed-npc-presence`, `srd-data`, `test-suite`, `turn-floor`), `INDEX.md`,
`CAPSULES.md`.

**Untouched (keep)**: `dm/intent-runner.ts`, `dm/purposes.ts`, `dm/rulings.ts`,
`playtest/budget.ts`, `schema/jobs.ts`, `apps/web/app/debug/*`, `packages/*`.

## Migrations, prompts, dependencies

- Migrations: none. The `jobs.stage` CHECK keeps `'adjudicate'` for old rows.
- Prompt bumps: none. `dm.adjudicate-v10` is deleted with its prompt. `dm.narrate-v24` renders
  identical text for every live input. `dm.interpret-v18` is untouched.
- Dependencies: none added. None removed (`@the-stacks/planner` stays).

## Flags

- **C-GATE**: yes, Phase 3. Deleting the adjudicate node changes the seam
  `specs/031-dm-runtime/contracts/node-seam.md` and `turn-jobs.md` describe. Not on the
  dispatch-rules frozen list; flagged under the brief's rule. `REASON_CONTRADICTS_STATE` is
  **not** touched: spec 103 already removed its plan-gate check, and the engine enum stays.
  No `specs/029-proposal-gate/contracts/`, ws-protocol or `proposal-seam.md` change.
- **C-CON**: none. No Intent contract change.
- **C5**: none. No new runtime dependency.
- **Hotspots**: `resolve.ts`, `plan-gate.ts`, `schemas.ts` are shared with TASK-0313 (stakes on
  Intents). Land this card before 0313 opens, or rebase 0313 onto it. `interpret.ts` is not edited.

## Size and split check

- Tasks: 27 across 6 phases (5 sonnet dispatches plus a wiki phase).
- Lines deleted, estimate: src ~1,500 (resolve ~470, plan-gate ~450, adjudicate + prompts +
  step-grammar + reactions ~345, schemas ~150, first-stage, runner, resume and the rest ~85).
  Tests ~2,000–2,500 net. Added: ~60 src (drop + cut re-anchor), ~80 tests.
- Split: not recommended. Every phase is a deletion that compiles on its own, and the card
  already came from a split (spec 104). Splitting adjudicate (Phase 3) from steps (Phase 4) would
  give two PRs with no separate reviewer decision except C-GATE, which one PR carries.
  If the operator refuses C-GATE, Phase 3 shrinks to "node always yields `{ rulings: [] }`" and
  the rest stands.
