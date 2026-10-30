# Implementation Plan: Resolve only the first step of a plan declaration

**Branch**: `task-0182-plan-first-step` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: `specs/064-plan-first-step/spec.md`. This plan assumes OQ-1 to OQ-7 (a). A different
operator ruling changes the phases named under each OQ in "Design".

## Summary

Code cuts each free-mode interpret reading and adjudicate ruling after its first stage (the first
run of like `check` steps). Cut step reasons become `followUps` on the reading. In a beat with any
follow-up, the runner holds the Director's `turn`, tracker and scene-end decisions and records
overrides. Narration facts list follow-ups as not yet attempted. The interpret, Director and narrate
prompts each gain one rule line and a version bump. A scripted fixture built from `act-197dae73`
proves it end to end.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. No new dependency.
**Storage**: Postgres event log and `jobs.result` checkpoint JSON. No migration.
**Testing**: Vitest unit tests; DB integration tests with `REQUIRE_DATABASE=1`; the fake gateway
and DM scripts (spec 053, `DM_FAKE_SCRIPT`).
**Target Platform**: the server's DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Performance Goals**: none new. The cut and the hold are pure, linear in steps.
**Constraints**: serial hotspot (`nodes/schemas.ts`, interpret and Director prompts). TASK-0180
follows and builds on the same prompts.
**Scale/Scope**: about 8 source files, 6 test files, 1 new DM script.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no new human path. The cut and the hold run inside the turn job; the
      override record is readable on the debug page.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only. No new query.
- [x] **IV. Event sourcing**: no new event. Resolve still writes only through `gate.submit`. The
      change writes fewer rows; it never edits a logged row.
- [x] **V. Citations**: rulings keep their citations; only the ruling's steps are cut.
- [x] **VI. 5e engine boundary**: no number moves. The engine is untouched.
- [x] **VII. Structured first**: `followUps` is a typed field; overrides use the existing typed
      `DirectorOverride`.
- [x] **VIII. Operator-owned content**: the fixture reads the shipped `greyhollow-ford-duo` seed.
      The post text is rebuilt from the playtest log, which the operator committed.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. No new runtime dependency.

## Research

- **R1 — Where the Director's stage changes land.** `directorOpening` in `nodes/resolve.ts` runs
  the `turn` decision before any action group (decision-0025 §4); `directorClosing` runs trackers
  and scene end after. Both read the `DirectorNodeOutput` from `ctx.results.director`. Rewriting
  that output once, after interpret and adjudicate, reaches both, the plan gate's
  `encounterToStart`, and narrate's facts. No resolve-order change is needed.
- **R2 — The runner is the one place that sees every planning output.** `pipeline/runner.ts` runs
  director, interpret, adjudicate in order and checkpoints each. A post-planning step there can cut
  readings and rulings and hold the Director before `resolve`, and store all three in the checkpoint.
  A reclaim reuses the stored outputs, so the cut and hold are idempotent.
- **R3 — Interpret runs after the Director.** The Director cannot see steps (OQ-1 (d) fails).
  The Director's prompt rule (FR-008) reduces held decisions; the code hold enforces AC #4.
- **R4 — Existing scripts.** No reading in `test/dm/scripts/*.json` has a step after its first run
  of like checks (checked 2026-10-29), so the cut changes no existing script outcome. The
  turn-mode scripts (`fight-round`, `greyhollow-ford-full`) switch to turn with `none` readings and
  no follow-ups, so the hold does not apply.
- **R5 — Narration.** `buildNarrationFacts` (`facts.ts`) builds one `FactAction` per beat item from
  the beat text. `factEntries` (`prompts/narrate.ts`) renders it. `withholdRefusedInputs`
  (`nodes/narrate.ts`) already runs `checkClaims` over ruling text and `goalNote`; follow-ups join
  that loop.
- **R6 — The plan gate.** `checkPlan` reads readings and rulings. Cut readings reach it, so it never
  checks a follow-up step. Spec 058's reason check is unchanged.
- **R7 — Resume (spec 057).** A resumed reading comes from a paused checkpoint, so it was cut when
  first planned. Its `followUps` ride along; the hold applies again in the resumed beat.

## Design

### D1 — `nodes/schemas.ts`: `followUps` on the reading (OQ-2 (a))

Add `followUps: z.array(z.string().min(1).max(200)).max(6).default([])` to `InterpretReadingSchema`.
The default keeps every existing reading literal and stored checkpoint valid. `Ruling` (in
`nodes/adjudicate.ts`) gains `followUps: string[]`, default `[]`, set by the cut only; the
adjudicate model output is unchanged.

### D2 — `dm/first-stage.ts` (new, pure)

- `firstStage(steps)`: returns `{ kept, cut }`. Keep steps up to and including the first run of
  `check` steps with equal `kind`, `ability` and `skill`; `cut` is the rest (OQ-4 (a)). No check
  means nothing is cut.
- `cutPlans({ mode, readings, rulings })`: in `free` mode, applies `firstStage` to each reading's
  steps and each ruling's steps. A cut step's `reason` appends to `followUps`, deduplicated, capped
  at six. In `turn` mode returns the inputs unchanged (OQ-5 (a)). The NPC reading
  (`actionId: null`) is never cut.
- `holdDirector(director, cutBeat)`: when `cutBeat`, returns the Director output with
  `tableMode: stay` (only when it was `turn`), `trackers: []` and `scene: continue`, and appends one
  override per held decision (`turn`, `tracker`, `scene-end`) with reason
  "held: the plan was cut to its first stage". A `free` decision is not held: ending an encounter
  needs no premise. When nothing is held it returns the input unchanged (OQ-3 (a)).

### D3 — `pipeline/runner.ts`: the post-planning step

After `adjudicate` (or its skip) and before `resolve`, when `ctx.checkpoint.cut` is not set: call
`cutPlans` with `assembled.projections.tableMode.mode`, then `holdDirector` with
`cutBeat = any reading or ruling has followUps`. Store the cut readings, cut rulings and held
Director in the checkpoint with `cut: true` in one save. A reclaim with `cut: true` skips the step.
`TurnCheckpoint` (`jobs.ts`) gains optional `cut?: boolean`. Log `dm.plan.cut` with the job id and
the cut counts.

### D4 — Prompts (OQ-6 (a))

- `prompts/interpret.ts`: one line in `OUTPUT_SHAPE`: "When a post holds a plan, an approach and
  later steps, plan only the first stage: the move or approach, with a check for anyone moving
  hidden or over hard ground. List each later step that depends on it in followUps, one short
  sentence each, and plan no step for it." Add `"followUps":[str]` to the reading shape and
  `followUps: []` to `EXAMPLE_OUTPUT`. Bump to `dm.interpret-v5`.
- `prompts/director.ts`: one sentence in `SYSTEM`: "Decide table mode and trackers from what each
  beat item's first stage does; a trigger that needs a roll this beat to succeed waits for the next
  beat." Bump to `dm.director-v4`.
- `prompts/narrate.ts`: render `  not yet attempted: <text>` under each action's head line, and add
  one `RULES` line: "A not-yet-attempted step has not happened. Stop before it; never show it
  start." Bump to `dm.narrate-v6`.

These lines are the only prompt edits. TASK-0180 adds its talk-trigger rules beside them.

### D5 — Facts and the claim gate

`FactAction` gains `followUps: string[]`, read from the interpret reading (or ruling) for the action.
`withholdRefusedInputs` checks each follow-up with `checkClaims` (omission claims excluded, as for
rulings) and drops a refused one with a `ledger-mismatch` withheld issue labelled
`follow-up for <actionId>`. The fallback (`fallback.ts`) does not voice follow-ups.

### D6 — The fixture (card AC #5)

`apps/server/test/dm/scripts/plan-approach.json`, seed `greyhollow-ford-duo`, dice `[8, 15]`:

- Director: `tableMode: { to: "turn", encounterId: "reed-camp" }`, trackers `alarm +1`,
  `dusk +1`. This is what run 2's Director did.
- Interpret, one reading for `act-197dae73` with the post text from the playtest log: stealth checks
  for `kestrel` and `odo` (dex, `stealth`), then a `cha`/`persuasion` check for `tamsin` hailing
  the camp, then an `attack` by `kestrel` on `snag`. The reading's `followUps` is empty, so the cut
  alone must produce the follow-ups.
- Narrate, audit and chronicle replies as in `exploration-check.json`.

The test file `test/dm/plan-first-step.integration.test.ts` runs the turn on a DB with a duo scene,
declares and commits `act-197dae73` for Tamsin, and asserts: exactly two `check.roll` rows, both
stealth; no `attack.roll`; no `combatant.add` for any reed-camp monster; no `initiative.roll`; no
`table-mode` row; no `tracker` row; `action.resolved` applied; the checkpoint's director overrides
hold `turn` and `tracker`; the narration facts carry two follow-ups. A control case runs
`exploration-check.json` and asserts its `dusk` advance still applies.

Unit tests: `test/dm/first-stage.test.ts` (the cut rule, turn mode, NPC reading, dedupe and cap,
the hold and its overrides, a no-op hold), `test/dm/runner.test.ts` (the step runs once, stores
`cut`, is skipped on reclaim), `test/dm/facts.test.ts` and `narrate.test.ts` (the line, the rule,
the withheld follow-up), `test/dm/interpret-prompt.test.ts` (version and inline snapshot).

### D7 — Mutation guard

Stub `firstStage` to return `{ kept: steps, cut: [] }`: the fixture's roll and follow-up assertions
fail. Stub `holdDirector` to return its input: the table-mode and tracker assertions fail. Restore;
`git diff` is empty. The orchestrator runs it (Phase 4).

### D8 — Script-mode live check (spec 053)

Add `apps/server/dm-scripts/greyhollow-plan-approach.json`: `scene-start.json`'s calls plus
`plan-approach.json`'s calls and their chronicle calls. Extend `test/dm/dm-scripts.test.ts` to
prove that composition. Add `specs/064-plan-first-step/evidence/declare.mjs`, a copy of the 053
declare script with the action id `act-197dae73` and the run 2 post text. The orchestrator runs it
on the worktree stack with `DM_FAKE_SCRIPT=greyhollow-plan-approach` and records the table in Brave:
free mode after the turn, two stealth dice lines, no encounter.

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/nodes/schemas.ts` | `followUps` on `InterpretReadingSchema` (D1) |
| `apps/server/src/dm/nodes/adjudicate.ts` | `Ruling.followUps` (D1) |
| `apps/server/src/dm/first-stage.ts` | new: `firstStage`, `cutPlans`, `holdDirector` (D2) |
| `apps/server/src/dm/pipeline/runner.ts` | the post-planning step (D3) |
| `apps/server/src/dm/jobs.ts` | `TurnCheckpoint.cut?` (D3) |
| `apps/server/src/dm/prompts/interpret.ts` | rule line, shape, example, `dm.interpret-v5` (D4) |
| `apps/server/src/dm/prompts/director.ts` | rule sentence, `dm.director-v4` (D4) |
| `apps/server/src/dm/prompts/narrate.ts` | follow-up line, rule, `dm.narrate-v6` (D4) |
| `apps/server/src/dm/facts.ts` | `FactAction.followUps` (D5) |
| `apps/server/src/dm/nodes/narrate.ts` | withhold refused follow-ups; pass readings to facts (D5) |
| `apps/server/test/dm/first-stage.test.ts` | new (D6) |
| `apps/server/test/dm/runner.test.ts`, `facts.test.ts`, `narrate.test.ts`, `interpret-prompt.test.ts`, `director.test.ts` | extended (D6) |
| `apps/server/test/dm/scripts/plan-approach.json` | new fixture (D6) |
| `apps/server/test/dm/plan-first-step.integration.test.ts` | new DB test (D6) |
| `apps/server/dm-scripts/greyhollow-plan-approach.json`, `apps/server/test/dm/dm-scripts.test.ts` | live script and its composition test (D8) |
| `specs/064-plan-first-step/evidence/declare.mjs` | live-check declare script (D8) |
| `specs/031-dm-runtime/contracts/nodes.md`, `director.md`, `node-seam.md` | additive amendments |
| `specs/034-narration-quality/contracts/narration-facts.md` | additive amendment |
| `docs/wiki/dm-runtime.md`, `dm-turn-jobs.md`, `dm-failure-and-gates.md`, `dm-narration-quality.md`, `CAPSULES.md`, `INDEX.md` | re-ground (Phase 5) |
| `docs/design/m3-table-sweep-runbook.md` | execution log row (Phase 5) |

**Migrations**: none. **New runtime dependencies**: none.

## Frozen-contract impact

None. `ws-protocol.md` frames, `specs/029-proposal-gate/contracts/` and
`specs/030-play-route/contracts/proposal-seam.md` are untouched. The 031 and 034 contracts are
amended additively.

## Phases

1. Pure core: schema field, `first-stage.ts`, unit tests (sonnet).
2. Runner wiring, prompts, facts and narrate (sonnet).
3. Fixture, DB test, live script (sonnet).
4. DB suites, mutation guard, script-mode live check **[orchestrator]**.
5. Contracts and wiki re-ground, runbook log row (sonnet).

## Live check

Phase 4 runs D8 on the worktree stack. Expected: the table stays in free mode, the transcript shows
two stealth dice lines and a narration that ends at the camp's edge, and the debug page shows the
held `turn` and `tracker` overrides.
