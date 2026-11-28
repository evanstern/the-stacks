# Tasks: Repeat-save spells (Hold Person)

**Spec**: `specs/125-spell-repeat-saves-hold-person/spec.md` | **Plan**: `specs/125-spell-repeat-saves-hold-person/plan.md`
**Rule**: one phase is one sonnet dispatch. `pnpm ci:check` green at the end. Tests use scripted dice only.

## Phase 1: Engine repeat saves (FR-001–FR-007; AC #1)

- [x] T001 State `repeatSave`, new `condition.removed` causes, evolve.
- [x] T002 Spell table `repeat-save` effect and `hold-person`; `castRepeatSave` in `handleSpellCast`.
- [x] T003 End-of-turn repeat save in `handleTurnAdvance`; concentration-break cleanup.
- [x] T004 Engine tests `spell-repeat-save.test.ts`; update server SRD pin test if needed.
- [x] T005 `pnpm ci:check` green.

## Phase 2: Wiki

- [x] T006 Re-pin `docs/wiki` notes whose `sources:` list a touched file (`/grounding-wiki:wiki-update`).
