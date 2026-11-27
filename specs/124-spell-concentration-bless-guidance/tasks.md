# Tasks: Concentration and roll-bonus spells (Bless, Guidance)

**Spec**: `specs/124-spell-concentration-bless-guidance/spec.md` | **Plan**: `specs/124-spell-concentration-bless-guidance/plan.md`
**Rule**: one phase is one sonnet dispatch. `pnpm ci:check` green at the end. Tests use scripted dice only.

## Phase 1: Engine concentration and roll bonuses (FR-001–FR-008; AC #1)

- [x] T001 State, events, evolve for concentration and roll bonuses (plan Design: State, Events).
- [x] T002 Spell table `effect`, `bless`, `guidance`, `moreTargetIds`/`skill` on `spell.cast`; effect branch in `handleSpellCast`.
- [x] T003 `src/concentration.ts`; hook damage, incapacitating conditions and expiry.
- [x] T004 Apply bonus dice in attacks.ts and spells.ts rolls.
- [x] T005 Engine tests `spell-effects.test.ts` and replay case; update the server SRD pin test.
- [x] T006 `pnpm ci:check` green.

## Phase 2: Wiki

- [x] T007 Re-pin `docs/wiki` notes whose `sources:` list a touched file (`/grounding-wiki:wiki-update`).
