# Tasks: Talk fallback voices the line

**Input**: `specs/081-talk-fallback-line/` (spec.md, plan.md). Plan research R1 to R5 and design
D1 to D6 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Before Phase 1**: merge `origin/main` into the branch. Confirm specs 079,
070 and 080 have merged (spine #10). Re-read every hunk plan.md "Overlap" names. Read the current
`dm.interpret`, `dm.narrate` and `dm.audit` versions on main; "next version" means one past each.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. No DB is needed: every test here uses the
scripted fake gateway or pure functions.

**Overlap rule**: in `fallback.ts`, edit `plannedSentence` only. Do not edit `nodes/resolve.ts`,
`gates/plan-gate.ts`, `pipeline/runner.ts`, `first-stage.ts`, `prompts/step-grammar.ts` or
`prompts/adjudicate.ts`. If a task seems to need one, stop and report.

## Phase 1: The plan carries the line (card AC #2; US2)

**Goal**: interpret can write a monster's spoken words in their own field, apart from the reasons.

**Independent test**: `interpret-prompt.test.ts` passes with the new shape, rule and parse cases.

- [x] T001 [US2] In `apps/server/src/dm/nodes/schemas.ts`, apply plan D1. Add the optional `say`
      field after `followUps` in `InterpretReadingSchema`. Change nothing else in the file.
- [x] T002 [US2] In `apps/server/src/dm/prompts/interpret.ts`, apply plan D2. Bump
      `PROMPT_VERSION` to the next version. Add `say: null` to `EXAMPLE_OUTPUT`. Add
      `"say":str|null` to the shape line. Add the rule as a new `OUTPUT_SHAPE` element after the
      rule paragraph.
- [x] T003 [US2] Extend `apps/server/test/dm/interpret-prompt.test.ts`: the version pin, the
      updated inline snapshot, and `InterpretOutput` parsing a reading with `say` and one without.
- [x] T004 Amend `specs/031-dm-runtime/contracts/nodes.md` with the plan's "Amendment
      (specs/081-talk-fallback-line)" section. Commit as `TASK-0207 phase 1: interpret say field`.

## Phase 2: The fallback voices the line (card AC #1; US1, US3)

**Goal**: the line reaches the facts, the narrator, the audit and the fallback. A run 1 replay
ships Pell's words.

**Independent test**: `talk-fallback-line.test.ts`, `fallback.test.ts`, `facts.test.ts` and
`narrate.test.ts` pass with the new cases.

- [x] T005 [US1] In `apps/server/src/dm/facts.ts`, apply plan D3: `FactNpcPlan.say`, the
      `npcPlan.say` input, and the `held` rule.
- [x] T006 [US1] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D4: pass `reading.say`,
      and drop a refuted line in `withholdRefusedInputs`.
- [x] T007 [US3] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D5: the `says:` fact line
      and the one rule. Bump `PROMPT_VERSION` to the next version. In
      `apps/server/src/dm/prompts/audit.ts`, bump `PROMPT_VERSION` to the next version.
- [x] T008 [US1] In `apps/server/src/dm/fallback.ts`, apply plan D6 inside `plannedSentence` only.
- [x] T009 [P] [US1] Extend `apps/server/test/dm/fallback.test.ts`: a voiced line; lines refused
      for a dice word, a death word and a `?`; quote marks stripped; digits spelled; a random
      `say` in the property generator.
- [x] T010 [P] [US1] Extend `apps/server/test/dm/facts.test.ts`: `say` from `npcPlan`; a refused
      plan gives `say: null`; a line with no step is not held.
- [x] T011 [P] [US3] Extend `apps/server/test/dm/narrate.test.ts`: the version pins and a refuted
      line withheld.
- [x] T012 [US1] Write `apps/server/test/dm/talk-fallback-line.test.ts`, the merge condition: the
      run 1 seq 124–126 replay with the four cases in plan "Tests". Name the source in the header.
- [x] T013 Amend `specs/034-narration-quality/contracts/fallback-summary.md` and
      `narration-facts.md` as plan "Contracts" says. Commit as
      `TASK-0207 phase 2: talk fallback voices the line`.

## Phase 3: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [x] T014 Run `/grounding-wiki:wiki-update`. Review `dm-narration-quality.md` (NEEDS-REVIEW):
      add the new narrate, audit and interpret versions to the prompt-version list with one
      sentence each. Describe the `says:` line and the fallback's quoted line before the reasons.
- [x] T015 Review `dm-runtime.md` (NEEDS-REVIEW): the interpret reading's `say` field.
- [x] T016 Re-pin `dm-talk-triggers.md`, `dm-failure-and-gates.md`, `srd-data.md` and
      `seed-npc-presence.md` after checking their claims against the diff.
- [x] T017 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for any changed note summary.
- [x] T018 Run the freshness gate, the spec-bridge check and `pnpm ci:check`. Commit as
      `TASK-0207 phase 3: wiki re-ground`.

## Dependencies

- Phase 2 needs Phase 1 (the `say` field). Phase 3 runs last.
- Inside Phase 2, T005 precedes T006 to T008. T009 to T012 run after T005 to T008.
