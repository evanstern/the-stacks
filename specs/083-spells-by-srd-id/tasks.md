# Tasks: Spells resolve by SRD id through the engine

**Input**: `specs/083-spells-by-srd-id/` (spec.md, plan.md), TASK-0105.

**Prerequisites**: TASK-0104 (spec 082) has merged into `main` (PR #123), and `main` is merged into
this branch. The tasks below implement each open question at its default (spec OQ-1 to OQ-6).

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Each implementer phase
ends with `pnpm ci:check` green and one commit led by `TASK-0105:`. DB suites run with
`REQUIRE_DATABASE=1` on the worktree's own stack in Phase 2. Touch only the files plan.md "Files the
build touches" lists for the phase. Stop and report if another file is needed.

Phases run in order: Phase 2 needs Phase 1's engine command and exports.

## Phase 0: Seam check [orchestrator]

- [x] T001 [orchestrator] Merge `origin/main` into the branch. Re-read plan.md R1's seams
      (`derive.ts` exports, `CombatantStatsSchema`, `statGap`, prompt versions). If TASK-0128 or
      another card moved one, record it in a new `specs/083-spells-by-srd-id/deviations.md` and amend
      plan.md D4–D7.

## Phase 1: Engine spell resolution (card AC #2, #3, #5; US1, US2, US3, US4)

- [x] T002 [US1] Create `packages/dnd5e-engine/src/spells.ts` with `SpellMechanicsSchema`, the six
      `SPELLS` entries of plan R5 (each citing its SRD id and page in a comment) and `spellDice`
      (plan D1, R9).
- [x] T003 [US1] In `packages/dnd5e-engine/src/schema/commands.ts`, add `spell.cast` (plan D2). In
      `schema/events.ts`, add optional `spellId` on `attack.resolved` and `check.resolved`, and
      optional `half` on `hp.changed`. In `schema/refusals.ts`, add `SPELL_UNRESOLVED`,
      `SPELL_UNKNOWN` and `SPELL_NOT_PREPARED`.
- [x] T004 In `packages/dnd5e-engine/src/commands/hit-points.ts`, extract `damageEvents` and
      `healingEvents` from the two handlers with no behaviour change, and add the `half` option
      (plan R8). In `conditions.ts` export `appliedEvent`; in `attacks.ts` export `checkNamed` and
      `actorUnable`.
- [x] T005 In `packages/dnd5e-engine/src/derive.ts`, add `spellcastingModifier(stats)` and use it in
      `spellSaveDc` and `spellAttackBonus`.
- [x] T006 [US4] In `packages/dnd5e-engine/src/commands/spell-slots.ts`, export `slotExpendEvent`
      built from the existing `slotOf` and `preflight` (plan R6). `handleSpellSlotExpend` uses it.
- [x] T007 [US1] Create `packages/dnd5e-engine/src/commands/spells.ts` with `handleSpellCast` in
      plan D3's order: every refusal before any draw; slot, then attack, save or auto; condition
      expiry per plan R7 with a `ponytail:` comment on the no-encounter skip (OQ-4). Register it in
      `execute.ts`.
- [x] T008 Export `SPELLS`, `SpellMechanicsSchema`, `spellDice` and `spellcastingModifier` from
      `packages/dnd5e-engine/src/index.ts`.
- [x] T009 [US1] Create `packages/dnd5e-engine/test/commands/spells.test.ts` with scripted dice
      (`scriptedRng`), a Wis +3 PB +2 caster (DC 13, attack +5) and an Int +3 PB +2 caster:
      `fire-bolt` hit (`1d20+5` vs AC, `1d10` fire), miss (no damage), critical (doubled die);
      `fire-bolt` at caster level 5 rolls `2d10`; `sacred-flame` failed save (`1d8` radiant) and
      success (none); `inflict-wounds` success halves `2d10` rounded down and `hp.changed.half` is
      true; `inflict-wounds` at slot 2 rolls `3d10`; `ray-of-sickness` hit applies `poisoned` with
      the R7 expiry, both for an active caster and a caster later in the round, and outside an
      encounter applies damage and no condition; `cure-wounds` heals `2d8+3`, `4d8+3` at slot 2, and
      wakes a 0 HP target; `healing-word` heals `2d4+3`; a poisoned caster's spell attack rolls with
      disadvantage; a restrained target's Dex save rolls with disadvantage.
- [x] T010 [US3] In the same file, refusal cases, each with `expectRefusedBeforeDraw`:
      `SPELL_UNRESOLVED` for `bless` (no entry) and for a cantrip with a slot level;
      `INVALID_COMMAND` for `cure-wounds` at slot level 0 (schema); `STAT_UNDEFINED` for a caster with
      no spellcasting ability and for a save target with no stats; `ACTOR_UNABLE` for an unconscious
      caster; `TARGET_DEAD`; `UNKNOWN_COMBATANT`.
- [x] T011 [US4] In the same file, slot cases: a leveled cast's first event is
      `spell-slots.changed` 0 → 1; a cast with every slot spent is refused `NO_SLOT_AVAILABLE`
      before any draw; a caster with no slot of the level is refused `SLOT_LEVEL_UNAVAILABLE`; a
      cantrip spends none; a pact caster spends the pact slot.
- [x] T012 In `packages/dnd5e-engine/test/commands/hit-points.test.ts`, add `half` cases (odd roll
      rounds down; half then resistance). Keep every existing case unchanged and green.
- [x] T013 In `packages/dnd5e-engine/test/coverage.test.ts`, add `SPELL_UNKNOWN` and
      `SPELL_NOT_PREPARED` to `PLAN_GATE_ONLY`.
- [x] T014 Create `apps/server/test/dm/spell-mechanics.test.ts`: for each `SPELLS` entry, the SRD
      spell record exists, its level matches, and the record's `text` or `higherLevels` contains each
      dice string, the attack phrase ("ranged spell attack" or "melee spell attack"), the save
      ability ("Dexterity saving throw" and so on), "half as much damage" when `onSuccess` is
      `half`, the condition name, "spellcasting ability modifier" when `addModifier`, the scaling
      die, and "end of your next turn" for `caster-next-turn-end`. Assert no entry is concentration.
- [x] T015 Update `packages/dnd5e-engine/README.md` with one paragraph on `spell.cast` and the table.
- [x] T016 Amend `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md` and
      `engine-api.md`, each section marked "Amended by specs/083-spells-by-srd-id".
- [x] T017 Run `pnpm ci:check`. `replay.test.ts` and the existing `hit-points.test.ts` cases must pass
      unchanged.

## Phase 2: Spell step, plan gate, resolve, prompts, snapshot and seeds (card AC #1–#5; US1–US5)

- [ ] T018 [US1] In `apps/server/src/dm/nodes/schemas.ts`, add the strict `spell` step (plan D4).
- [ ] T019 [US3] In `apps/server/src/dm/gates/plan-gate.ts`, apply plan D6: the `spellLists` and
      `srdSpell` inputs, `stepIds`, `foreignActor`, `stepTexts`, `askUndeclared`, `spellGap` and the
      intent-`spell` refusal, and the new verdict codes and failure reasons.
- [ ] T020 [US1] In `apps/server/src/dm/nodes/resolve.ts`, add `case "spell"` (plan D5) and pass
      `spellLists` and `srdSpell` to `checkPlan`, built from the seed characters and `deps.srd`.
- [ ] T021 [US5] In `apps/server/src/dm/prompts/step-grammar.ts`, add the spell line and the rule
      sentence (plan D7). Bump `prompts/interpret.ts` and `prompts/adjudicate.ts` one past `main`
      (interpret-v12, adjudicate-v9 at authoring; record any other value).
- [ ] T022 [US5] In `apps/server/src/dm/snapshot/render.ts`, render the sheet's spell ids.
- [ ] T023 Add `"cure-wounds"` to Odo's `identity.spells` in the four greyhollow seeds (plan D8).
- [ ] T024 Add a `spellStep()` helper to `apps/server/test/dm/world.ts`.
- [ ] T025 [US1] In `apps/server/test/dm/interpret.test.ts`: a spell step parses; one with `dc`,
      `expression`, `damage`, `effects` or `amount` is rejected; `slotLevel` 0 and 10 are rejected; a
      bad id grammar is rejected.
- [ ] T026 [US3] In `apps/server/test/dm/plan-gate.test.ts`: `SPELL_UNKNOWN`, `SPELL_NOT_PREPARED`
      (Odo and `fire-bolt`; a monster caster), `SPELL_UNRESOLVED` (`bless`; a cantrip with a slot
      level; a leveled spell below its level; intent `spell` with only check and effect steps),
      `STAT_UNDEFINED` (a caster with no spellcasting ability); a spell by another party member in a
      character action is refused `STEP_ACTOR_MISMATCH`; a joining caster is skipped; a
      contradicting spell `reason` is refused `REASON_CONTRADICTS_STATE`; a clarify reading with
      intent `spell` passes.
- [ ] T027 [US5] In `apps/server/test/dm/interpret-prompt.test.ts`: the new version strings, the
      spell grammar line and the rule sentence. In `snapshot-render.test.ts`: Odo's sheet lists his
      spell ids.
- [ ] T028 In `apps/server/test/dm/fallback.test.ts`, add one case per delivery (attack, save, heal)
      that pins the fallback sentences for a `spell.cast` batch. If a sentence is wrong, stop and
      report (plan "Not touched").
- [ ] T029 [US2] [US4] Create `apps/server/test/dm/spells.integration.test.ts` over the
      greyhollow-ford seed: Odo's `sacred-flame` on a goblin lands a save row at DC 13 and radiant
      damage on a failure; Odo's `cure-wounds` heals a downed Kestrel `2d8+3` and she wakes (TASK-0211
      AC #2); three casts of `cure-wounds` spend both slots, and the third is refused
      `NO_SLOT_AVAILABLE` with no healing row; `bless` is refused `SPELL_UNRESOLVED` with no dice
      row (card AC #3); `no-such-spell` is refused `SPELL_UNKNOWN`.
- [ ] T030 Amend `specs/031-dm-runtime/contracts/nodes.md`, `resolve.md` and
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`, each marked "Amended by
      specs/083-spells-by-srd-id".
- [ ] T031 Run `pnpm ci:check` and the full DB suites, including `dm-scripts.test.ts` and
      `apps/server/test/playtest/harness.integration.test.ts` (the scripted CI playtest).

## Phase 3: Re-ground (wiki)

- [ ] T032 Review and update `docs/wiki/dnd5e-engine.md` (`spell.cast`, the spell table,
      `spellcastingModifier`, half damage, the new codes, the extracted builders) and
      `docs/wiki/srd-data.md` (the server table test reads spell records; the engine holds no SRD
      import) (NEEDS-REVIEW).
- [ ] T033 Review and update `docs/wiki/dm-runtime.md` (the spell step, `case "spell"`, prompt
      versions, Odo's spell list) and `docs/wiki/dm-failure-and-gates.md` (drop "spells not yet
      gated"; the spell refusal codes and the intent rule) (NEEDS-REVIEW).
- [ ] T034 Re-pin every other note that lists a touched source, verifying each against the diff:
      expected `actor-snapshot`, `dm-narration-quality`, `seed-npc-presence`, `playtest-harness`,
      `output-claim-gate`.
- [ ] T035 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: the dnd5e-engine and
      dm-failure-and-gates one-liners, and the INDEX state paragraph.
- [ ] T036 Run the wiki freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
- [ ] T037 [orchestrator] Add the execution-log row to the runbook B file.
