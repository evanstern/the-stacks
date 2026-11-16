# Tasks: Monster-feature DCs come from the stat block

**Spec**: `specs/120-monster-feature-dc/spec.md` | **Plan**: `specs/120-monster-feature-dc/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
**Rule**: each phase's dispatch ticks that phase's checkboxes in the same commit as the work.
Commit each phase in one commit led by `TASK-0224`. Tests use scripted dice only.
Do not edit `packages/srd`, `packages/intent`, `packages/session-model/src`, `apps/web`, the seeds, the prompts or the playtest harness. In `apps/server/src`, edit only `dm/seed/combatants.ts`.

## Phase 1: Engine source, planner call sites and engine tests (FR-001–FR-015, FR-017, FR-018; AC #1)

- [x] T001 In `packages/dnd5e-engine/src/schema/state.ts`, add `FeatureDcSchema`, `FeatureDc` and `stats.featureDcs` (plan D1).
- [x] T002 In `src/derive.ts`, add `findFeatureDc` and change `oppositionDc` to take `kind`, with the escape DC and the new comment (plan D2). Export the new names from `src/index.ts`.
- [x] T003 In `src/schema/commands.ts` and `src/schema/events.ts`, add the `feature` fields (plan D3).
- [x] T004 In `src/commands/attacks.ts` `handleCheckRoll`, add the fourth DC source, its refusals and the event field (plan D3, steps 1–6).
- [x] T005 In `packages/planner/src/checks.ts` and `src/combat.ts`, pass the roll kind to `oppositionDc` (plan D6).
- [x] T006 Write `packages/dnd5e-engine/test/commands/feature-dc.test.ts` with every SC-001 and SC-002 case and the two `check.roll` cases of SC-003 (plan D5). Confirm the coverage meta-test passes.
- [x] T007 Update `packages/dnd5e-engine/test/derive.test.ts`: the new `oppositionDc` argument, the SC-003 cases and the `findFeatureDc` cases (plan D5).
- [x] T008 Run the search in plan D5. Fix any expectation the rule now changes. List each changed test in the commit message.
- [x] T009 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 2: Stats builder, gate replay and contracts (FR-016, FR-019, FR-020; AC #1)

- [x] T010 In `apps/server/src/dm/seed/combatants.ts`, add `featureDcsFromSrd` and wire it into `statsFromSrd`; fix the `spellcastingAbility` comment (plan D4).
- [x] T011 Add the SC-004 cases to `apps/server/test/dm/seed-stats.test.ts` (plan D5).
- [x] T012 Add the `goblinFeatures` world option and the FR-019 replay to `packages/session-model/test/gate-intents.test.ts` (plan D5).
- [x] T013 Amend `specs/026-dnd5e-engine/contracts/commands.md`, `events.md` and `engine-api.md`, and close spec 082 OQ-7 and spec 084 OQ-2 (plan D7).
- [x] T014 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T015 Merge `origin/main` into the branch. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/<version>/gates/cli.mjs plan . docs/wiki` and work every entry it prints.
- [ ] T016 `docs/wiki/dnd5e-engine-derived-rolls.md` (`derive.ts`, `commands/attacks.ts`, `schema/state.ts`, `schema/events.ts`): behaviour changed. Add a section "Monster-feature DCs (spec 120)": `stats.featureDcs` and its two kinds; the fourth DC source `feature: { sourceId, name }`, saving throws only, never the source itself; a dead source is allowed; the four refusals; `check.resolved` records `feature`; the `unarmed-strike` escape check uses the first stated escape DC, the grapple and shove save keeps the formula. In the Opposition paragraph, replace "derives 8 + the opponent's Strength modifier + proficiency bonus (DC 9 for Snag)" with the same text plus "on a save; an escape check uses a stated escape DC first (spec 120)".
- [ ] T017 `docs/wiki/dnd5e-engine.md` (`derive.ts`, `index.ts`, `schema/state.ts`, `schema/commands.ts`, `schema/events.ts`): behaviour changed. Name the new exports and the fourth `check.roll` DC source, with a link to [[dnd5e-engine-derived-rolls]].
- [ ] T018 `docs/wiki/srd-data.md` (`dm/seed/combatants.ts` is named in its prose): behaviour changed. In the spec 082 paragraph, add that `statsFromSrd` also maps each feature's `save` field and "escape DC N" in its text into `featureDcs` (spec 120), and that the escape DC is read from prose.
- [ ] T019 `docs/wiki/planner.md` (`checks.ts`, `combat.ts`): re-verify. Add one sentence where opposition DCs are described: a `contest` escape against a monster now gets its stated escape DC from the engine.
- [ ] T020 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dnd5e-engine-economy.md`, `dnd5e-engine-reactions.md`, `dnd5e-engine-sides.md`, and `monorepo-and-toolchain.md` if the plan lists it.
- [ ] T021 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`: the `dnd5e-engine-derived-rolls` and `srd-data` lines name the spec 120 rule. Run the wiki plan (prints nothing), the freshness gate (exits 0) and the spec-bridge gate (exits 0). Run `pnpm ci:check` (green).
