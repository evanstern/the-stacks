# Tasks: Party slide-out

**Input**: `specs/072-party-slideout/` (spec.md, plan.md). Plan research R1 to R8 and design D1 to
D9 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. Browser automation uses Brave. No modals.

**Overlap rule**: T006 edits `apps/server/src/dm/nodes/resolve.ts`, which spec 068 (TASK-0194)
also edits. Run T006 only when the orchestrator clears it (0194 merged, or a ruling). Do not edit
`dm/gates/plan-gate.ts`, `dm/snapshot/`, `dm/nodes/schemas.ts` or `dm/prompts/`. If a task seems
to need one, stop and report.

## Phase 1: Class and level from the seed to the party row (card AC #3; US2)

**Goal**: every shipped seed declares class and level, and scene start logs them on each party
member.

**Independent test**: `seed.test.ts`, `catalog.test.ts` and `fixtures.test.ts` pass with the new
cases; the DB scene-start test sees Odo as `Cleric` 1.

- [x] T001 [US2] In `apps/server/src/dm/seed/schema.ts`, apply plan D1: add required
      `identity.class` (`Text(40)`) and `identity.level` (int 1..20) to `SeedCharacter`.
- [x] T002 [US2] Fill `class` and `level` per plan R5 in `apps/server/seeds/greyhollow-ford.json`,
      `greyhollow-ford-duo.json` and `greyhollow-ford-trio.json`. Put both keys first in each
      `identity`. Copy `greyhollow-ford.json` byte for byte to
      `specs/031-dm-runtime/data/greyhollow-ford.seed.json`.
- [x] T003 [US2] In `packages/session-model/src/events/party.ts`, apply plan D2: optional `class`
      and `level` on `PartyMemberSchema`.
- [x] T004 [US2] In `packages/session-model/src/fixtures/turn-mode-combat.ts`, apply plan D4.
- [x] T005 [P] [US2] Extend `apps/server/test/dm/seed.test.ts`,
      `packages/session-model/test/catalog.test.ts` and
      `packages/session-model/test/fixtures.test.ts` as plan "Tests" says.
- [X] T006 [US2] In
      `apps/server/src/dm/nodes/resolve.ts` `directorOpening`, apply plan D3: add `class` and
      `level` to the `director:party:<id>` `after`. Extend the scene-start case in
      `apps/server/test/dm/resolve.integration.test.ts` and run it with `REQUIRE_DATABASE=1` on the
      worktree stack.
- [x] T007 Amend `specs/031-dm-runtime/contracts/scene-seed.md` and
      `specs/028-session-model/contracts/session-events.md` as plan "Contracts" says. Mark each
      change "Amended by spec 072 (TASK-0164)".
- [ ] T008 Run `pnpm ci:check`. Commit as `TASK-0164 phase 1: class and level on seed characters
      and party members`.

## Phase 2: The Party slide-out (card AC #1, #2, #4, #5; US1, US3, US4)

**Goal**: every viewer opens a Party slide-out from the header that lists each character, its
controller, the own-character marker, class and level, HP and AC, and the initiative order in turn
mode.

**Independent test**: `party.test.mjs`, `party-panel.test.tsx`, `table-view.test.tsx`,
`turn-order.test.tsx` and `no-dialog.test.mjs` pass.

- [x] T009 [US1] Create `apps/web/app/play/party.ts` per plan D5.
- [x] T010 [US1] Create `apps/web/app/play/components/party-panel.tsx` per plan D6.
- [x] T011 [US3] In `apps/web/app/play/components/turn-order.tsx`, apply plan D7.
- [x] T012 [US4] In `apps/web/app/play/components/table-header.tsx` and
      `apps/web/app/play/table-view.tsx`, apply plan D8. Do not edit `routes/play.tsx` or
      `routes/play-fixture.tsx`.
- [x] T013 [P] [US1] Create `apps/web/test/play/party.test.mjs` and
      `apps/web/test/play/party-panel.test.tsx`; extend `table-view.test.tsx` and
      `turn-order.test.tsx`, as plan "Tests" says.
- [x] T014 Amend `specs/030-play-route/contracts/ui-surfaces.md` as plan "Contracts" says.
- [x] T015 Run `pnpm ci:check`. Commit as `TASK-0164 phase 2: party slide-out`.

## Phase 3: Brave evidence (merge condition; SC-003)

**Goal**: four Brave screenshots, 1280 and 390 px, light and dark, with the Party slide-out open
in combat and the initiative order shown.

**Independent test**: `node specs/072-party-slideout/evidence/shoot.mjs .handoff/072-operator.json`
prints only PASS lines and writes four PNGs.

- [x] T016 On the worktree stack, run `pnpm env:up`, migrate both databases by hand, and restart
      the app. Create the local-stack-only operator per plan D9 step 1. Store the random password
      only in `.handoff/072-operator.json`. Never print, log or commit it.
- [x] T017 Write `specs/072-party-slideout/evidence/shoot.mjs` per plan D9: Node built-in
      `fetch` and `WebSocket` over CDP, Brave headless, no Playwright, no new dependency.
- [x] T018 Run it. Look at each PNG and confirm the panel, the initiative list with the active
      turn, the "Your character" badge and the "AI companion" label are legible in both themes.
- [x] T019 Write `specs/072-party-slideout/evidence/README.md`: date, commit, command and the
      PASS lines. Commit the script, the README and `shots/*.png` as
      `TASK-0164 phase 3: Brave evidence`. Leave the stack up.

## Phase 4: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T020 Update `docs/wiki/play-route.md` (NEEDS-REVIEW): the Party trigger and slide-out,
      `party.ts`, `party-panel.tsx`, the `TurnOrder` label. Add the two new files to its sources.
- [ ] T021 Update `docs/wiki/scene-panels.md` (NEEDS-REVIEW): the Party panel beside the other
      table slide-outs, on the shared `Panel`.
- [ ] T022 `docs/wiki/actor-snapshot.md`: re-pin only if a cited file changed. `dm/snapshot/` is
      not edited (plan R4); confirm and leave it unless the gate names it.
- [ ] T023 Re-verify and re-pin every other note citing a changed file: `dm-runtime.md`,
      `seed-npc-presence.md`, `dm-failure-and-gates.md` (seed schema and seeds); `dm-turn-jobs.md`,
      `proposal-gate.md`, `turn-floor.md` (`resolve.ts`, if T006 ran); `turn-floor.md`
      (`turn-order.tsx`); `chat-ui.md` and `react-router-app.md` if the gate names them; any
      note the freshness gate reports. State class and level in `dm-runtime.md`'s seed section.
- [ ] T024 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: one sentence for the Party
      slide-out and seed class and level (TASK-0164, specs/072).
- [ ] T025 Run the freshness gate and the spec-bridge gate
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .`). Commit
      as `TASK-0164 phase 4: wiki re-ground`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4. T006 waits on the orchestrator (Overlap rule); Phase 2
does not depend on T006, because the fixture (T004) carries class and level. Phase 4 runs after
T006 lands.
