# Tasks: Engine-derived numbers — modifiers, DCs and AC from combatant stats

**Input**: `specs/082-engine-derived-numbers/` (spec.md, plan.md), TASK-0104.

**Prerequisites**: TASK-0127 (spec 070) and TASK-0170 (spec 080) have merged into `main`, and
`main` is merged into this branch. The operator ruled OQ-1 to OQ-7 at (a) on 2026-11-02; the tasks
below implement each at (a). OQ-1's Sneak Attack is TASK-0225; OQ-2, OQ-3, OQ-7 are TASK-0222,
TASK-0223, TASK-0224.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Each implementer phase
ends with `pnpm ci:check` green and one commit led by `TASK-0104:`. DB suites run with
`REQUIRE_DATABASE=1` on the worktree's own stack in Phases 2, 3 and 4. Touch only the files plan.md
"Files the build touches" lists for the phase. Stop and report if another file is needed.

Phases 1 to 4 run in order: each needs the previous phase's types. Phase 3 leaves the JSON scripts
on the old shape, so Phase 3's gate is the unit suites plus the DB suites that build steps in TS;
Phase 4 closes the full gate.

## Phase 0: Seam check [orchestrator]

- [x] T001 [orchestrator] Merge `origin/main` into the branch. Read the merged check step in
      `apps/server/src/dm/nodes/schemas.ts`, `specs/070-stakes-before-dice/deviations.md` and spec
      080's merged plan. Record any field rename or moved seam in a new
      `specs/082-engine-derived-numbers/deviations.md`, and amend plan.md D6 or D7 if a seam moved.
      Done 2026-11-03: seams moved, none changed meaning; plan R3, R9, R10, R14, D3, D6, D7, D8
      and the Phase 3 file list amended.

## Phase 1: Engine derivation (card AC #1, #2, #4, #5; US1, US2, US3, US4)

- [ ] T002 [US1] In `packages/dnd5e-engine/src/schema/state.ts`, add `SKILL_ABILITY`,
      `AttackEntrySchema`, `CombatantStatsSchema` and optional `stats` on `CombatantSchema`. Move
      `Ability` and `Amount` here; import them in `commands.ts` and `events.ts` (plan D1).
- [ ] T003 [US1] In `packages/dnd5e-engine/src/schema/commands.ts`, add optional `stats` to
      `CombatantInit`. On `check.roll` make `expression` and `dc` optional and add `difficulty`. On
      `attack.roll` make `expression` optional and add `attack` (plan D3, R8: `.optional()`, plain
      `z.object`).
- [ ] T004 [US1] In `packages/dnd5e-engine/src/schema/events.ts`, add optional `difficulty` to
      `check.resolved` and optional `attack` to `attack.resolved`. In `schema/refusals.ts`, add
      `STAT_UNDEFINED`.
- [ ] T005 [US1] Create `packages/dnd5e-engine/src/derive.ts` with every function of plan D2. Cite
      the SRD record id in a comment beside each rule. Mark the OQ-6 proxies `ponytail:`.
- [ ] T006 [US1] In `packages/dnd5e-engine/src/commands/combatants.ts`, copy `init.stats` onto the
      new combatant when present.
- [ ] T007 [US1] In `packages/dnd5e-engine/src/commands/attacks.ts`, apply plan D3's order to
      `handleCheckRoll` and `handleAttackRoll`. Keep spec 070's band code and spec 079's reaction
      checks unchanged. Record `difficulty` and `attack` on the resolved events.
- [ ] T008 Export `derive.ts`'s functions and types, `DifficultySchema`, `CombatantStatsSchema` and
      `AttackEntrySchema` from `packages/dnd5e-engine/src/index.ts`.
- [ ] T009 [US4] Create `packages/dnd5e-engine/test/derive.test.ts`: a check modifier with and
      without proficiency; a skill paired with another ability; a save with and without a total;
      exhaustion −2 per level; each tier's DC; every condition rule of plan R5 once; prone by range;
      cancellation; `d20Expression` at 0, +5 and −1; `spellSaveDc` and `spellAttackBonus` for a
      Wis +3, PB +2 caster (13, +5) and null with no ability.
- [ ] T010 [US1] In `packages/dnd5e-engine/test/commands/attacks.test.ts`, add scripted-dice tests:
      a derived check at tier `medium` rolls `1d20+5` vs DC 15; a scene check rolls flat `1d20`;
      `difficulty` with `dc` and neither are refused `INVALID_COMMAND`; a derived attack by name
      rolls the entry's to-hit vs the record AC; `attack` with `expression` refused; a poisoned
      attacker rolls with disadvantage; an explicit expression ignores conditions (old behaviour);
      `STAT_UNDEFINED` for no stats, a missing ability modifier and an unknown attack name, each
      before any draw (`expectRefusedBeforeDraw`); band and margin use the tier DC.
- [ ] T011 In `packages/dnd5e-engine/test/commands/combatants.test.ts`, assert `stats` are copied
      and a combatant without them parses.
- [ ] T012 Update `packages/dnd5e-engine/README.md` with one paragraph on stats and derived rolls.
- [ ] T013 Amend `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md` and
      `engine-api.md`, each section marked "Amended by specs/082-engine-derived-numbers".
- [ ] T014 Run `pnpm ci:check`.

## Phase 2: Stats on combatants and the reaction path (card AC #1, #3, #4; US2, US3)

- [ ] T015 [US2] In `apps/server/src/dm/seed/combatants.ts`, add `statsFromSrd` and
      `statsFromCharacter`, and set `stats` in `combatantFromSrd` (plan D4).
- [ ] T016 [US3] In `apps/server/src/dm/seed/load.ts`, add the three FR-011 issues.
- [ ] T017 [US2] In `apps/server/src/dm/nodes/resolve.ts`, send `statsFromCharacter` on the scene
      start's PC `combatant.add`. Add the `hitDamage` helper. Switch `case "move"` to
      `firstMeleeAttack` over the reactor's engine stats with `attack: entry.name` (plan D5).
- [ ] T018 [US2] In `apps/server/src/dm/reactions.ts`, delete `meleeAttackOf` and its imports.
- [ ] T019 [US2] Create `apps/server/test/dm/seed-stats.test.ts`: every shipped seed PC's stats
      (Tamsin Longsword +5 melee 1d8+3, Light Crossbow ranged; Odo `spellcastingAbility` `wis`;
      Kestrel Shortbow ranged, Shortsword melee); goblin-warrior and goblin-minion stats from SRD
      (Scimitar +4 1d6+2 with the Advantage rider skipped; Dagger `melee-or-ranged` +4 1d4+2;
      Stealth skill key). Move `meleeAttackOf`'s cases from `reactions.test.ts` here as
      `firstMeleeAttack(statsFromSrd(...))` with the same numbers.
- [ ] T020 [US3] In `apps/server/test/dm/seed.test.ts`, add one refusing case per FR-011 issue.
- [ ] T021 [US2] Update `apps/server/test/dm/reactions.test.ts` and
      `opportunity-attack.integration.test.ts` for the shared path. Each run 1 replay keeps its
      dice and outcome.
- [ ] T022 Amend `specs/031-dm-runtime/contracts/scene-seed.md` (stats sources, loader checks).
- [ ] T023 Run `pnpm ci:check` and the DB suites.

## Phase 3: Step contract, prompts, resolve and plan gate (card AC #1–#4; US1, US2, US3)

- [ ] T024 [US1] In `apps/server/src/dm/nodes/schemas.ts`, apply plan D6 to the check and attack
      steps: strict objects, `difficulty`, `circumstance`, `attack`, non-null `attackerId`. Add the
      `onHit` damage refusal to the shared `requireAbilityStakes` helper (renamed `refineSteps`).
      Keep spec 080's `reveals` and the spec 070 stakes fields.
- [ ] T025 [US1] In `apps/server/src/dm/prompts/step-grammar.ts`, render the D9 step lines, the tier
      list from `DifficultySchema` with DCs, and the derivation rule. Drop the old modifier sentence.
- [ ] T026 [US1] In `apps/server/src/dm/prompts/interpret.ts`, update `EXAMPLE_OUTPUT` (keep
      `say: null` and `reveals`) and bump `PROMPT_VERSION` from `dm.interpret-v10` to
      `dm.interpret-v11`. Bump `prompts/adjudicate.ts` from `dm.adjudicate-v7` to
      `dm.adjudicate-v8`. If `main` has moved past either, go one past `main` and record it.
- [ ] T027 [US2] In `apps/server/src/dm/nodes/resolve.ts`, apply plan D7 to `case "check"` and
      `case "attack"`, and pass the engine combatants to `checkPlan`.
- [ ] T028 [US3] In `apps/server/src/dm/gates/plan-gate.ts`, add the `combatants` input, the
      `STAT_UNDEFINED` group refusal and `circumstance.reason` in `stepTexts` (plan D8).
- [ ] T029 In `apps/server/src/dm/resume.ts`, re-parse resumed readings and rulings and skip a
      failing plan (plan D10).
- [ ] T030 Update `checkStep()` and `attackStep()` in `apps/server/test/dm/world.ts` and the steps
      in `plan-reason-fixtures.ts` to the new shapes.
- [ ] T031 [US3] In `apps/server/test/dm/interpret.test.ts`, add: a check with `dc`, with
      `expression` and with `mode` is rejected; an attack with `targetAc`, with `expression`, with a
      null `attackerId` and with a damage effect in `onHit` is rejected; an attack with empty
      `onHit` parses; `circumstance` defaults to null; an unknown tier is rejected.
- [ ] T032 [US3] In `apps/server/test/dm/plan-gate.test.ts`, add `STAT_UNDEFINED` cases: an unknown
      attack name, a combatant with no stats, a missing ability modifier; a joining combatant is
      skipped; a contradicting `circumstance.reason` is refused `REASON_CONTRADICTS_STATE`.
- [ ] T033 In `apps/server/test/dm/interpret-prompt.test.ts`, assert the new version strings, the
      tier list and the derivation rule, and that no grammar line shows `dc`, `targetAc` or a d20
      expression.
- [ ] T034 In `apps/server/test/dm/resume.test.ts`, add: an old-shape paused reading is skipped.
- [ ] T035 Update `first-stage.test.ts`, `rules-terms.test.ts`, `presence-effect.test.ts`,
      `runner.test.ts`, `adjudicate.integration.test.ts` and `beat.integration.test.ts` to the new
      step shapes. Edit `interpret-capture.test.ts` and `stakes.test.ts` only if they go red.
- [ ] T036 Amend `specs/031-dm-runtime/contracts/nodes.md`, `resolve.md` and
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`, each marked "Amended by
      specs/082-engine-derived-numbers".
- [ ] T037 Run `pnpm ci:check` (unit suites). Run the DB suites; list each failure that a JSON
      script still on the old shape causes, for Phase 4.

## Phase 4: Scripts, fixtures and integration tests (card AC #5; US5)

- [ ] T038 [US5] Migrate each check step in the 21 JSON scripts and fixtures plan.md lists: drop
      `expression`, `dc` and `mode`; add `difficulty` and `circumstance` (`approach-reed-camp.json`'s
      disadvantage becomes a circumstance with its reason). Pick the tier that keeps the scripted
      outcome and spec 070 band per plan R9; where none does, change the scripted die.
- [ ] T039 [US5] Migrate each attack step: drop `expression`, `targetAc` and `mode`; add `attack`
      (the seed or SRD entry name) and `circumstance: null`; move the damage effect out of `onHit`.
      In `downed-seat.json`, script a natural 20 and critical damage dice that total 13 (plan R11).
- [ ] T040 [US5] Walk every migrated roll for a derived mode (plan R10: downed, prone, restrained,
      poisoned or invisible actors). Insert or move scripted dice so each roll keeps its outcome.
- [ ] T041 [US5] Record every per-script tier, die and dice-count change in `deviations.md`.
- [ ] T042 [US5] Update the integration tests plan.md lists for Phase 4 wherever an assertion reads a
      changed dice line, DC or die count. Keep each test's intent.
- [ ] T043 [US1] Create `apps/server/test/dm/derived-numbers.integration.test.ts` over the
      greyhollow-ford seed: a check step at tier `medium` lands a dice row `1d20+5` and DC 15 for
      Tamsin's Athletics; Kestrel's `Shortbow` attack on a goblin rolls `1d20+5` vs its record AC
      and applies `1d6+3` piercing on a hit; an attack naming `Warhammer` is refused
      `STAT_UNDEFINED` with no dice row (card AC #4).
- [ ] T044 Run `pnpm ci:check` and the full DB suites, including `dm-scripts.test.ts` and
      `apps/server/test/playtest/harness.integration.test.ts` (the scripted CI playtest).

## Phase 5: Re-ground (wiki)

- [ ] T045 Review and update `docs/wiki/dnd5e-engine.md` (stats, `derive.ts`, tiers, condition
      modes, `STAT_UNDEFINED`, the R8 ruling's new inputs), `dm-runtime.md` (step shapes, stats at
      `combatant.add`, hit damage, the reaction path) and `dm-failure-and-gates.md` (drop "modifiers
      and DCs not yet gated"; the `STAT_UNDEFINED` plan-gate rule) (NEEDS-REVIEW).
- [ ] T046 Review `docs/wiki/srd-data.md` for the new SRD readers (`statsFromSrd`, class
      `spellcastingAbility`, weapon `rangeType`) (NEEDS-REVIEW).
- [ ] T047 Re-pin every other note that lists a touched source, verifying each against the diff:
      expected `seed-npc-presence`, `dm-turn-jobs`, `party-panel`, `turn-floor`,
      `output-claim-gate`, `dm-talk-triggers`.
- [ ] T048 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: the dnd5e-engine and
      dm-failure-and-gates one-liners, and the INDEX state paragraph.
- [ ] T049 Run the wiki freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
- [ ] T050 [orchestrator] Add the execution-log row to the runbook B file.
