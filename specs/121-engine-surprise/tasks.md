# Tasks: The engine records surprise; the fact sheet derives startlement

**Spec**: `specs/121-engine-surprise/spec.md` | **Plan**: `specs/121-engine-surprise/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
**Rule**: each phase's dispatch ticks that phase's checkboxes in the same commit as the work.
Commit each phase in one commit led by `TASK-0215`. Tests use scripted dice only.
Do not edit `packages/srd`, `packages/intent`, `packages/planner`, `packages/session-model/src`, `apps/web`, the seeds or the playtest harness. Do not edit `apps/server/src/dm/fact-sheet.ts` or `apps/server/src/dm/nodes/resolve.ts`.

## Phase 1: Engine surprise, gate replay and contracts (FR-001–FR-006, FR-015, FR-016, FR-018; AC #1)

- [x] T001 In `packages/dnd5e-engine/src/schema/commands.ts` and `src/schema/events.ts`, add the participant `surprised` flag and the `encounter.started` `surprised` field (plan D1).
- [x] T002 In `src/commands/encounter.ts` `handleInitiativeRoll`, fold Disadvantage for a surprised participant and emit the `surprised` ids; add the doc comment (plan D2).
- [x] T003 Add `describe("spec 121: surprise")` to `packages/dnd5e-engine/test/commands/encounter.test.ts` with every SC-001 and SC-002 case (plan D5). Confirm the coverage meta-test passes.
- [x] T004 Add `describe("spec 121: surprise through the gate")` to `packages/session-model/test/gate-plan.test.ts` with the SC-005 case (plan D5).
- [x] T005 Amend `specs/026-dnd5e-engine/contracts/commands.md` and `events.md`, and close spec 074 OQ-2 (plan D6).
- [x] T006 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 2: Startlement fact, prompts and fact-sheet replay (FR-007–FR-014, FR-017; AC #2)

- [ ] T007 In `apps/server/src/dm/facts.ts`, add the `startle` trigger and `deriveStartle`, and put its entries first in `involuntary` (plan D3).
- [ ] T008 In `prompts/narrate.ts`, add the `startle` phrase. In `dm/doctrine/doctrine.ts`, amend the `AGENCY_RULE` reflex line (plan D4).
- [ ] T009 Merge `origin/main`. Bump the four prompt versions one past `main` and update each version pin test (plan D4).
- [ ] T010 Add `describe("deriveStartle (spec 121)")` to `apps/server/test/dm/facts.test.ts` with the SC-003 cases (plan D5).
- [ ] T011 Add `describe("spec 121: startlement on the fact sheet")` to `apps/server/test/dm/fact-sheet.test.ts` with the SC-004 cases, and the SC-006 assertion to `doctrine.test.ts` (plan D5).
- [ ] T012 Run the search in plan D5. Fix any expectation the rule now changes. List each changed test in the commit message.
- [ ] T013 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T014 Merge `origin/main` into the branch. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/<version>/gates/cli.mjs plan . docs/wiki` and work every entry it prints.
- [ ] T015 `docs/wiki/dnd5e-engine.md` (`schema/commands.ts`, `schema/events.ts`): behaviour changed. Where `initiative.roll` is listed, add: a participant may be `surprised`; it rolls with Disadvantage folded into its mode (SRD 5.2.1 `playing-the-game.combat.the-order-of-combat.initiative`) and loses no turn; `encounter.started` records the surprised ids, and engine state holds none (spec 121).
- [ ] T016 `docs/wiki/dm-narration-quality.md` (`dm/facts.ts`, `prompts/narrate.ts`): behaviour changed. In the involuntary-effects sentence, add the fifth reflex: `deriveStartle` lists a `startle` for each surprised party member from the turn's public `encounter.started` row, first in `involuntary`, rendered `Reflex: <name> may startle (surprised as the fight starts)`. In "Prompt versions", add `dm.narrate-v27` (spec 121: the `startle` reflex and the agency rule line).
- [ ] T017 `docs/wiki/dm-runtime.md` (`doctrine.ts`, `prompts/interpret.ts`): behaviour changed. In the Agency bullet, the reflex list names the startle. Name `dm.director-v13` and `dm.interpret-v19` where the versions appear.
- [ ] T018 `docs/wiki/playtest-harness.md` (`auditor/prompt.ts`): behaviour changed. The auditor prompt version reads `playtest.audit-v3` (spec 121: the agency rule names the startle).
- [ ] T019 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dnd5e-engine-economy.md`, `dnd5e-engine-reactions.md`, `dnd5e-engine-sides.md`, `dnd5e-engine-derived-rolls.md`, and any other note the plan lists.
- [ ] T020 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`: the `dnd5e-engine` and `dm-narration-quality` lines name the spec 121 rule. Run the wiki plan (prints nothing), the freshness gate (exits 0) and the spec-bridge gate (exits 0). Run `pnpm ci:check` (green).
