# Tasks: Seat actor id

**Input**: `specs/096-seat-actor-id/` (spec.md, plan.md). Plan D1 to D4 settle every choice; read
them before a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0302:`. No paid model run.

**Before Phase 1**: merge `origin/main` into the branch. Run `pnpm install --frozen-lockfile`.
Re-read `prompts/common.ts`, `prompts/interpret.ts`, `prompts/director.ts` and `nodes/interpret.ts`
as merged.

## Phase 1: Seat labels and seat normalizer (US1, US2; FR-001 to FR-007)

**Goal**: no user id reaches the interpret or director prompt, and a seated user id in a step's
actor field reaches the plan gate as the character's combatant id.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/seat-actor-id.test.ts` passes.

- [ ] T001 [US1] [US2] In `apps/server/src/dm/prompts/common.ts`, add `seatsOf` and `dmActorLabel`;
      extend `transcriptEntries` and `beatEntries` (plan D1). Add the `ponytail:` comment (plan D2).
- [ ] T002 [US1] In `apps/server/src/dm/prompts/interpret.ts` and `prompts/director.ts`, pass seats
      and bump to `dm.interpret-v16` and `dm.director-v11` (plan D2).
- [ ] T003 [US1] In `apps/server/src/dm/nodes/interpret.ts`, add `seatActorIds`; apply it and log
      `dm.interpret.seat-actor` in both return paths (plan D3).
- [ ] T004 [P] [US1] [US2] Add `apps/server/test/dm/seat-actor-id.test.ts` with the three cases in
      plan D4.
- [ ] T005 Update the version assertions in `test/dm/interpret-prompt.test.ts` and
      `test/dm/assemble.test.ts`, and line 296 of `test/dm/narration-quality-repro.test.ts`
      (plan, Files touched).
- [ ] T006 Run `pnpm ci:check`. Commit as `TASK-0302 phase 1: seat actor id in DM prompts and readings`.

## Phase 2: Wiki (re-ground)

**Goal**: the notes describe seat labels and the normalizer and pass the freshness gate.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T007 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: interpret step 3 names `dm.interpret-v16` and the
      seat normalizer (`seatActorIds`, log `dm.interpret.seat-actor`); the Director names
      `dm.director-v11`.
- [ ] T008 NEEDS-REVIEW `docs/wiki/dm-narration-quality.md` "Transcript and facts": the DM-side form
      labels a human by the seated character id, never a user id (`seatsOf`, `dmActorLabel`).
- [ ] T009 NEEDS-REVIEW `docs/wiki/dm-plan-gate.md`: the actor check receives readings already
      seat-normalized; the gate itself is unchanged and still maps no alias.
- [ ] T010 NEEDS-REVIEW `docs/wiki/dm-failure-and-gates.md` line 48: `dm.interpret-v16`.
- [ ] T011 Update `docs/wiki/INDEX.md` (state line: TASK-0302, specs/096) and `docs/wiki/CAPSULES.md`
      where they name the interpret or director version.
- [ ] T012 Re-pin each touched note honestly against the Phase 1 commit. Run the freshness gate and
      the spec-bridge check. Commit as `TASK-0302 phase 2: re-ground wiki for seat actor id`.
