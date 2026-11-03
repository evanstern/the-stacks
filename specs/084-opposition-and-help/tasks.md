# Tasks: Opposition as a derived DC, and Help as advantage

**Input**: `specs/084-opposition-and-help/` (spec.md, plan.md), TASK-0128.

**Prerequisites**: TASK-0104 (spec 082) is merged into `main`, and `main` is merged into this
branch. The operator has ruled OQ-1 to OQ-6, or accepted the defaults (a). The tasks below
implement each default (a). A ruling of (b) amends plan.md and this file before Phase 1.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and
the branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Each implementer
phase ends with `pnpm ci:check` green and one commit led by `TASK-0128:`. Touch only the files
plan.md "Files the build touches" lists for the phase. Stop and report if another file is needed.
Phases 1 to 3 run in order: each needs the previous phase's types.

## Phase 0: Seam check [orchestrator]

- [x] T001 [orchestrator] Merge `origin/main` into the branch. Compare plan.md's file list with
      TASK-0105's merged or in-flight plan (spec 083). Record each moved seam, the prompt versions
      on `main`, and the engine event count in a new `specs/084-opposition-and-help/deviations.md`.
      Amend plan.md D3, D9 to D11 if a seam moved. Decide develop-ahead or draft-hold per runbook B
      "Rule at dispatch" and log it. Done 2026-11-03: develop ahead; one changed-meaning seam (S1,
      spell attacks take attack assists) and 23 moved seams, all in deviations.md.

## Phase 1: Engine (card AC #1, #2; US1, US2)

- [x] T002 [US1] In `packages/dnd5e-engine/src/schema/state.ts`, add optional `abilityScores` to
      `CombatantStatsSchema`, `AssistSchema`, and optional `assists` on `CombatantSchema` with the
      unique-helper refinement (plan D1).
- [x] T003 [US1] In `schema/commands.ts`, add `check.roll.opposition` and the `help.grant` command.
      In `schema/events.ts`, add `check.resolved.opposition`, `assist.granted` and `assist.ended`.
      In `schema/refusals.ts`, add `NOT_PROFICIENT` (plan D3). Use `.optional()`, never
      `.default()` (spec 082 R8).
- [x] T004 [US1] In `derive.ts`, add `OppositionRuleSchema`, `oppositionCovers`, `oppositionDc`,
      `checkAssists`, `attackAssists` and `helperExpiry`, each citing its SRD record (plan D2).
      Mark the two `ponytail:` proxies.
- [x] T005 [US1] In `commands/attacks.ts`, apply plan D4 to `handleCheckRoll` and D5 to
      `handleAttackRoll`. Widen `actorUnable`'s `role` to add `"helper"`. In `commands/spells.ts`,
      apply plan D5a to the attack delivery of `handleSpellCast`.
- [x] T006 [US2] Create `commands/help.ts` with `handleHelpGrant` (plan D6). Register it in
      `execute.ts`.
- [x] T007 [US2] In `commands/encounter.ts`, make `expiring` end assists and `handleEncounterEnd`
      end every assist. In `evolve.ts`, apply `assist.granted` and `assist.ended` (plan D7).
- [x] T008 Export the new schemas, types and functions from `index.ts`. Document `help.grant`,
      the opposition rules and the assist lifecycle in `packages/dnd5e-engine/README.md`.
- [x] T009 [US1] In `test/derive.test.ts`, add: `unarmed-strike` DC for Snag's SRD numbers
      (Str −1, PB 2 → 9) and Tamsin's (Str +3, PB 2 → 13); `influence` DC for Int 10 (15) and
      Int 18 (18); missing stats, Strength modifier or Intelligence score → `{ok:false}`; the
      `oppositionCovers` table; `checkAssists` skill matching; `attackAssists` excluding the helper;
      `helperExpiry` for a helper before, at and after the active index, and with no encounter.
- [x] T010 [US1] In `test/commands/attacks.test.ts`, add `check.roll` cases: an opposed check
      records the derived DC and `opposition`; `expectRefusedBeforeDraw` for two DC sources, the
      opponent equal to the checker, an uncovered check, an unknown opponent, a dead opponent and
      an opponent with no stats; spec 070's band on a derived opposition DC.
- [x] T011 [US2] In the same file, add assist cases: an ability-check assist rolls advantage (two
      scripted d20s, higher kept) and emits `assist.ended` `used`; a different skill and a saving
      throw leave it; an assist plus a disadvantage `circumstance` rolls normal and is still used;
      two assists give advantage once and both end; an auto-fail and a free retry leave it; an
      explicit-expression check leaves it; an attack assist applies to another attacker and not
      to the helper. In `test/commands/spells.test.ts`, add: a spell attack against a target holding
      an attack assist rolls advantage and ends it `used`; a save spell leaves it.
- [x] T012 [US2] Create `test/commands/help.test.ts`: `help.grant` (`type: "help.grant"`, for the
      coverage meta-test) records the assist with the R4 expiry; `expectRefusal` for
      `NOT_PROFICIENT`, `STAT_UNDEFINED`, `ACTOR_UNABLE`, `INVALID_COMMAND` (self-help),
      `UNKNOWN_COMBATANT` and `TARGET_DEAD`; a second grant ends the first with `replaced`.
- [x] T013 [US2] In `test/commands/encounter.test.ts`, add: an assist ends `expired` at the start
      of its helper's next turn, not earlier; it ends when a dead helper's turn is skipped; it ends
      `encounter-ended` at `encounter.end`. In `test/replay.test.ts`, add: an assist survives
      replay and its end removes it.
- [x] T014 In `packages/session-model/test/catalog.test.ts`, move the mechanics count from 18 to
      20 and the catalog count from 37 to 39. In `packages/dnd5e-engine/test/execute.test.ts`, move
      the counts from 23 commands, 18 events and 34 refusal codes to 24, 20 and 35.
- [x] T015 Amend `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md` and
      `engine-api.md`, each marked "Amended by specs/084-opposition-and-help".
- [x] T016 Run `pnpm ci:check`.

## Phase 2: Step contract, prompts, plan gate and resolve (card AC #1, #3; US1, US3)

- [ ] T017 [US1] In `apps/server/src/dm/seed/combatants.ts`, fill `abilityScores` in
      `statsFromSrd` (plan D8). In `seed/schema.ts`, replace the `groupChecks` comment with the TASK-0232 text (plan D14).
- [ ] T018 [US3] In `apps/server/src/dm/nodes/schemas.ts`, widen the check step's `difficulty`,
      add the `help` step, and add the three `refineSteps` branches (plan D9).
- [ ] T019 [US3] In `prompts/step-grammar.ts`, add the D10 lines. In `prompts/interpret.ts`, add
      the help sentence to `OUTPUT_SHAPE` and bump `PROMPT_VERSION` to `dm.interpret-v13`. Bump
      `prompts/adjudicate.ts` to `dm.adjudicate-v10`.
- [ ] T020 [US3] In `gates/plan-gate.ts`, apply plan D12 to `stepIds`, `stepTexts`,
      `foreignActor`, `statGap` and `askUndeclared`.
- [ ] T021 [US1] In `nodes/resolve.ts`, apply plan D11 to `case "check"` and add `case "help"`.
- [ ] T022 [US1] In `apps/server/test/dm/seed-stats.test.ts`, assert `abilityScores` for the
      goblin warrior and none for a seed PC. Add `helpStep()` to `apps/server/test/dm/world.ts`.
- [ ] T023 [US3] In `apps/server/test/dm/interpret.test.ts`, add: a check with an opposition
      `difficulty` parses; `opposedBy` equal to `combatantId` fails at `difficulty.opposedBy`; an
      uncovered rule fails at `difficulty.rule`; both help assist kinds parse; an ally or target
      equal to the helper fails at `assist`; an unknown assist kind and an extra field fail; a tier
      string still parses.
- [ ] T024 [US3] In `apps/server/test/dm/plan-gate.test.ts`, add: a help step naming an absent or
      unknown id is refused; a help step whose helper is not the actor is refused
      `STEP_ACTOR_MISMATCH`; an opposition whose opponent lacks stats is refused `STAT_UNDEFINED`
      and a joining opponent is skipped; a contradicting help `reason` is refused
      `REASON_CONTRADICTS_STATE`; `askUndeclared` asks when the helper is another human's PC, with
      the question "<Helper>'s player decides what <Helper> does. What does <Declarer> do
      instead?", and passes when only the ally is.
- [ ] T025 In `apps/server/test/dm/interpret-prompt.test.ts`, assert the new version strings, the
      opposition-rules line and the help line. Regenerate the inline snapshot.
- [ ] T026 Amend `specs/031-dm-runtime/contracts/nodes.md` (step shapes), `resolve.md` (the two
      submissions), `scene-seed.md` (`abilityScores` from SRD) and
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` (help ids, actor and stat
      rules), each marked "Amended by specs/084-opposition-and-help".
- [ ] T027 Run `pnpm ci:check`. Run the DB suites with `REQUIRE_DATABASE=1`: every shipped script
      stays green unchanged (SC-004).

## Phase 3: Narration facts and end-to-end test (card AC #1–#3; US1, US2, US4)

- [ ] T028 [US4] In `apps/server/src/dm/facts.ts`, add the `assist` `FactChange` from
      `assist.granted` rows (plan D13); `renderChangeLine` returns null for it.
- [ ] T029 [US4] In `prompts/narrate.ts`, render the assist in `describeChange` and bump
      `PROMPT_VERSION` to `dm.narrate-v17`. Bump `prompts/audit.ts` to `dm.audit-v11`. In `fallback.ts`, add the assist sentence to
      `changeSentence`.
- [ ] T030 [US4] In `apps/server/test/dm/facts.test.ts` and `fallback.test.ts`, add one case per
      assist kind. In `narrate.test.ts`, assert `dm.narrate-v17` and `dm.audit-v11`.
- [ ] T031 [US1, US2] Create `apps/server/test/dm/opposition-and-help.integration.test.ts` over
      the reed-camp seed with scripted dice: (1) Tamsin's Athletics check opposed by Snag rolls
      against DC 9 and the `check.resolved` row carries `opposition`; (2) a party-scope beat where
      Kestrel helps Tamsin's Acrobatics, then Tamsin's Acrobatics check rolls two d20s and the
      assist ends `used`; (3) in an encounter, an unused assist ends at the start of Kestrel's next
      turn. Use the fake gateway; no paid run.
- [ ] T032 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`. Re-run a known-flaky
      gateway or scene test once and report it (dispatch rules).

## Phase 4: Re-ground (wiki)

- [ ] T033 Review and update `docs/wiki/dnd5e-engine.md` (spell attacks take attack assists;
      extend its `size_budget_exempt` reason to name TASK-0128 and the split card TASK-0231) (opposition rules, `abilityScores`,
      assists, `help.grant`, the two events, `NOT_PROFICIENT`, assist expiry beside condition
      expiry) (NEEDS-REVIEW).
- [ ] T034 Review and update `docs/wiki/dm-runtime.md` (the opposition `difficulty`, the help step,
      resolve's two submissions, prompt versions) and `docs/wiki/dm-failure-and-gates.md` (the help
      step in the plan gate, `askUndeclared` and `STAT_UNDEFINED`; extend its `size_budget_exempt`
      reason as in T033) (NEEDS-REVIEW).
- [ ] T035 Review `docs/wiki/dm-narration-quality.md` for the assist fact, the narrate version and
      the fallback sentence (NEEDS-REVIEW).
- [ ] T036 Re-pin every other note that lists a touched source, verifying each against the diff:
      expected `srd-data`, `seed-npc-presence`, `dm-turn-jobs`, `party-panel`, `proposal-gate`,
      `turn-floor`, `output-claim-gate`, `dm-talk-triggers`.
- [ ] T037 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: the dnd5e-engine and
      dm-failure-and-gates one-liners, and the INDEX state paragraph.
- [ ] T038 Run the wiki freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
- [ ] T039 [orchestrator] Add the execution-log row to the runbook B file.

## Dependencies

- Phase 0 before Phase 1. Phase 1 exports the types Phase 2 imports. Phase 3 needs Phase 1's
  events and Phase 2's steps. Phase 4 runs on the final tree.
- Inside a phase, tests follow the source task they cover.
