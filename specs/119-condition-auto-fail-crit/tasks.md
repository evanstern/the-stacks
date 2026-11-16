# Tasks: Condition automatic save failure and automatic critical hits

**Spec**: `specs/119-condition-auto-fail-crit/spec.md` | **Plan**: `specs/119-condition-auto-fail-crit/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
**Rule**: each phase's dispatch ticks that phase's checkboxes in the same commit as the work.
Commit each phase in one commit led by `TASK-0222`. Tests use scripted dice only.
Do not edit `packages/planner`, `packages/intent`, `packages/session-model/src`, `apps/server/src`, `apps/web`, the seeds, the prompts or the playtest harness.

## Phase 1: Engine rules, tests and contracts (FR-001–FR-017; AC #1)

- [x] T001 In `packages/dnd5e-engine/src/derive.ts`, add `autoFailCondition` and `autoCritCondition` with their SRD comments (plan D1). Export both from `src/index.ts`.
- [x] T002 In `src/commands/attacks.ts` `handleCheckRoll`, derive the effective `autoFail` and move its branch above `autoSuccess` (plan D2).
- [x] T003 In `src/commands/spells.ts`, add the derived auto-fail to the save delivery and the `ponytail:` comment to the attack delivery (plan D3).
- [x] T004 In `src/commands/attacks.ts` `handleAttackRoll`, add `autoCrit` and the outcome change (plan D4).
- [x] T005 Write `packages/dnd5e-engine/test/commands/condition-auto.test.ts` with every SC-001, SC-002 and SC-003 case (plan D5). Confirm the coverage meta-test passes.
- [x] T006 Add the FR-017 replay to `packages/session-model/test/gate-intents.test.ts` (plan D5).
- [x] T007 Run the search in plan D5. Fix any expectation the rule now changes. List each changed test in the commit message.
- [x] T008 Amend `specs/026-dnd5e-engine/spec.md` FR-023 and `contracts/commands.md`, `events.md` and `engine-api.md` (plan D6).
- [x] T009 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 2: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [x] T010 Merge `origin/main` into the branch. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/<version>/gates/cli.mjs plan . docs/wiki` and work every entry it prints.
- [x] T011 `docs/wiki/dnd5e-engine-derived-rolls.md` (`derive.ts`, `commands/attacks.ts`, `commands/spells.ts`, `schema/events.ts`): behaviour changed. Add a section "Condition auto-fail and auto-crit (spec 119)": the four save conditions and Str and Dex only; the derived `autoFail` reason; a command `autoFail` wins; the derived failure beats `autoSuccess`; the explicit-expression path auto-fails too; `paralyzed` and `unconscious` turn a melee-use hit into `critical-hit`; ranged uses and spell attacks do not; advantage still picks the kept face.
- [x] T012 `docs/wiki/dnd5e-engine.md` (`derive.ts`, `index.ts`, `schema/events.ts`, `specs/026-dnd5e-engine/spec.md`): behaviour changed. Replace "The engine does not derive automatic failure from conditions." in the R8 section with the spec 119 rule and a link to [[dnd5e-engine-derived-rolls]]. Name the two new exports.
- [x] T013 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dnd5e-engine-economy.md` (`attacks.ts`, `spells.ts`; Dodge is unchanged), `dnd5e-engine-reactions.md` (`attacks.ts`; a reaction hit on a downed target now crits; add one sentence if the note describes reaction outcomes), `dnd5e-engine-sides.md` (`attacks.ts`, `spells.ts`), and `monorepo-and-toolchain.md` if the plan lists it.
- [x] T014 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`: the `dnd5e-engine` and `dnd5e-engine-derived-rolls` lines name the spec 119 rule. Run the wiki plan (prints nothing), the freshness gate (exits 0) and the spec-bridge gate (exits 0). Run `pnpm ci:check` (green).
