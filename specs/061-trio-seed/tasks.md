# Tasks: Three-human seed for the M3 demo

**Input**: `specs/061-trio-seed/` (spec.md, plan.md, quickstart.md)

**Board task**: TASK-0176. Card AC #1: a shipped seed seats three humans, loads through
`loadSeed`, and has a test. Card AC #2: the Start scene slide-out offers three human seats for it,
with no modal, and a test. Card AC #3: `docs/ops/dev-vm-104.md` names the seed for a three-player
table.

**Prerequisites**: the operator rules OQ-1 to OQ-6 (spec.md). The tasks below implement (a) for
each: seed id `greyhollow-ford-trio`, title `Greyhollow Ford (three players)`. A different ruling
amends plan.md and these tasks before Phase 1 dispatches.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0176`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green (DB
suites skip without a database; the orchestrator runs them) and one commit led by `TASK-0176:`.
No modal: slide-out panels or autocomplete dropdowns only. Browser automation uses Brave. Do not
change the `ws-protocol` frames, `specs/029-proposal-gate/contracts/` or
`specs/030-play-route/contracts/proposal-seam.md`. No source change under `apps/server/src/` or
`apps/web/app/`. Tests are written first and seen to fail, except where a task says why a test
cannot fail first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an open task).
- **[US1]**: card AC #1. **[US2]**: card AC #2. **[US3]**: card AC #3.

---

## Phase 1: Trio seed and the no-database server tests (card AC #1; OQ-1 to OQ-5)

**Goal**: `greyhollow-ford-trio` loads with three humans and no companion, the seed list shows it,
and a trio table gives the AI DM no companion to prompt.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/seed.test.ts test/dm/trio-views.test.ts`.

- [ ] T001 [US1] In `apps/server/test/dm/seed.test.ts`, add "loads the three-player trio seed":
      `loadSeed("greyhollow-ford-trio")` humans are `["tamsin", "odo", "kestrel"]`, companions are
      `[]`, title is `Greyhollow Ford (three players)`, and Odo's `portrayal.voice` and `.want` are
      `Chosen by the player.`. In "lists the shipped seeds sorted by id", expect
      `["greyhollow-ford", "greyhollow-ford-duo", "greyhollow-ford-trio"]`.
- [ ] T002 [US1] In `apps/server/test/dm/snapshot-fixtures.ts`, add `THIRD_USER`
      (`00000000-0000-4000-8000-000000000003`) and `greyhollowTrio()` beside `greyhollowDuo()`:
      the trio seed at its opening, `tamsin`, `odo`, `kestrel` held by `PLAYER_USER`,
      `SECOND_USER`, `THIRD_USER`, no fight.
- [ ] T003 [US1] Create `apps/server/test/dm/trio-views.test.ts`, modelled on `duo-views.test.ts`.
      Cases: the actor snapshot's `fiction` view labels all three `party, human player` and never
      `AI companion`; the `dm` view lists three players and no companion; `buildDirectorPrompt`
      with `aiCompanions: aiCompanionIds(projections)` gives a user prompt with no
      `## AI companions in the party`; `legalizeDirector` in free mode turns a hold naming `odo`
      into `resolve` with the override reason `a named companion is not an AI companion in the party`,
      and empties `companionPrompts: ["odo"]` with the reason
      `a prompted character is not an AI companion in the party`.
- [ ] T004 [US1] Run T001 and T003 and confirm each new case fails (no seed file).
- [ ] T005 [US1] Create `apps/server/seeds/greyhollow-ford-trio.json` per plan.md "Data model": a
      copy of `greyhollow-ford-duo.json` with `seedId` `greyhollow-ford-trio`, `title`
      `Greyhollow Ford (three players)`, Odo's `seat` `human`, and Odo's `portrayal.voice` and
      `.want` `Chosen by the player.`. Keep every other field and the character order. Confirm
      `git diff --stat` shows the two existing seeds untouched.
- [ ] T006 [US1] Run T001 to T003 green. Run the whole server suite (`pnpm --filter
      @the-stacks/server test`) to catch any other test that enumerates the seed directory. Run
      `pnpm ci:check`. Commit.

## Phase 2: The three-human DB test (card AC #1; FR-006)

**Goal**: on the real gate, queue and worker, a trio scene starts with three players, signs off
with three, commits with one absent, passes an absent human's floor, and queues no companion job.

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/trio.integration.test.ts test/dm/routes.integration.test.ts`
**[orchestrator runs it]**.

- [ ] T007 [US1] In `apps/server/test/dm/routes.integration.test.ts`, in the `GET /dm/seeds` case,
      expect the three seed ids sorted, and the trio row's `humans` ids
      `["tamsin", "odo", "kestrel"]` and `companions` `[]`. Add a case: a trio start with one user
      on `odo` and `kestrel` returns 400 with one issue at `seats.kestrel`,
      `A user can hold only one seat.`, and queues no turn job; a trio start with three distinct
      users returns 202.
- [ ] T008 [US1] Create `apps/server/test/dm/trio.integration.test.ts`, modelled on
      `duo.integration.test.ts` (its `crowd`, world and `declareParty` helpers; `loudSkip` and
      `clearDmJobsBeforeEach` as that file uses them). Start `greyhollow-ford-trio` through the
      real queue with the `scene-start.json` script and three users. Cases:
      (a) three party rows, each a `player` controller for its user, no `ai-companion`, no failed
      job, and no job of kind `companion` in `listDmJobs`;
      (b) with all three present, a party action commits only after all three approve (two
      approvals leave it open);
      (c) with one user absent, the other two approvals commit it;
      (d) in turn mode with one user absent, the floor job passes that user's turn to the next
      actor in initiative order, and no companion `turn` job is queued.
      Add a script under `apps/server/test/dm/scripts/` only if `scene-start.json` does not fit.
- [ ] T009 [US1] Run `pnpm --filter @the-stacks/server exec vitest run test/dm/trio.integration.test.ts`
      without a database and confirm it skips loudly. Run `pnpm ci:check`. Commit. The
      orchestrator runs T007 and T008 on the database (Phase 4); a failing case comes back to this
      phase.

## Phase 3: Slide-out test and the runbook subsection (card AC #2, #3; OQ-6)

**Goal**: a test proves the Start scene form offers three seats for the trio, and the hosted-dev
runbook names the trio seed for a three-player table.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/play/start-scene-panel.test.tsx`
and `node --test apps/web/test/no-dialog.test.mjs`.

- [ ] T010 [P] [US2] In `apps/web/test/play/start-scene-panel.test.tsx`, add a trio
      `SeedSummary` (`greyhollow-ford-trio`, `Greyhollow Ford (three players)`, humans Tamsin Vale,
      Brother Odo, Kestrel; companions `[]`) and a third present user (`u3`, `Cass`). Cases: with
      the trio chosen the form renders `id="start-seat-tamsin"`, `id="start-seat-odo"` and
      `id="start-seat-kestrel"`, each listing Ada, Bram and Cass, and no `AI companions:`; Start is
      disabled for `{ tamsin: "u1", odo: "u2" }` and for `{ tamsin: "u1", odo: "u2", kestrel: "u2" }`;
      Start is enabled for three distinct users; `startBody` on the full map keeps all three seats.
      These cases pass on first run: `StartSceneForm` already maps every `seed.humans` entry
      (plan.md R5). Record that in the commit message. Their bite is proved by T015 (b).
- [ ] T011 [P] [US3] In `docs/ops/dev-vm-104.md`, add a subsection `### Seat three players` at the
      end of `## Run a two-player table`, before `## Rollback to a named commit`. Procedural prose:
      one instruction per sentence, imperative, about 20 words at most, one name per concept. Cover,
      in order: repeat steps 3 to 8 for a second player, with a second invitation; every human
      opens the table link and the presence strip shows three names; in step 14 choose
      `Greyhollow Ford (three players) (greyhollow-ford-trio)`; choose a different user for
      `Tamsin Vale`, `Brother Odo` and `Kestrel`; no `AI companions:` note shows; each human's
      speaker selector offers only their own character. Do not change steps 1 to 19.
- [ ] T012 [US2] [US3] Confirm `apps/web/test/no-dialog.test.mjs` passes. Run `pnpm ci:check`.
      Commit.

## Phase 4: DB suites, mutation guard and live check **[orchestrator]**

- [ ] T013 **[orchestrator]** On the worktree stack (`pnpm env:up`, migrate both databases,
      restart the app), with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported from the
      worktree `.env`, run `trio.integration`, `duo.integration`, `routes.integration` and `scene`
      integration suites, then `REQUIRE_DATABASE=1 pnpm ci:check`. Record counts in
      `specs/061-trio-seed/evidence/db-run.md`. A scene or playtest timeout under full-suite load
      gets one re-run, recorded (TASK-0154).
- [ ] T014 **[orchestrator]** Commit T013's record before T015.
- [ ] T015 **[orchestrator]** Mutation guard: (a) set Odo's `seat` back to `companion` in
      `greyhollow-ford-trio.json`; confirm `seed.test.ts` and `trio-views.test.ts` fail. (b) In
      `apps/web/app/play/components/start-scene-panel.tsx`, render `seed.humans.slice(0, 2)`;
      confirm the T010 trio cases fail. (c) Delete `greyhollow-ford-trio.json`; confirm the
      seed-list case fails. Restore after each; `git diff` is empty. Record the failing case names in
      `specs/061-trio-seed/evidence/mutation-guard.md`.
- [ ] T016 **[orchestrator]** Write `specs/061-trio-seed/evidence/shoot-live.mjs`, modelled on
      `specs/054-two-player-alpha-kit/evidence/shoot-live.mjs` (Playwright with Brave as the
      executable), driving three browser contexts through `quickstart.md` steps 4 to 10. It reads a
      credentials file path from its arguments (never from the repo), generates the two player
      passwords into the scratchpad file, and never prints a secret.
- [ ] T017 **[orchestrator]** Live check in Brave, script mode, per `quickstart.md`
      (`DM_FAKE_SCRIPT=greyhollow-live`: the shipped script fits, no new DM script; no paid run).
      Shots at 1280 px and 390 px, light and dark, in `evidence/shots/`: the slide-out with the trio
      chosen and three seats filled, and the table after the opening in each of the three contexts.
      No shot shows a modal. Check the three refusals in `quickstart.md`. Walk T011's runbook steps
      against the run. Record everything in `evidence/live-run.md` (no password, no token). Remove
      the `DM_FAKE_SCRIPT` line and recreate the app container. Leave the stack up.

## Phase 5: Wiki re-ground and the sweep runbook

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
prints `OK`, and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
exits 0.

- [ ] T018 Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0176 fetch origin`, then
      `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0176 merge origin/main`. Keep both
      sides of any conflict.
- [ ] T019 Run `/grounding-wiki:wiki-update`. Re-verify and re-pin `docs/wiki/seed-npc-presence.md`
      (the trio seed: all three seat `human`, no companion; add
      `apps/server/seeds/greyhollow-ford-trio.json` to `sources:`) and `docs/wiki/dm-runtime.md`
      (the Scene seed line names the trio; add the file to `sources:`; a trio table queues no
      companion job, per plan.md R2).
- [ ] T020 Re-verify and re-pin `docs/wiki/hosted-dev.md`: its "Run a two-player table" section
      names the `Seat three players` subsection and `greyhollow-ford-trio`.
- [ ] T021 Review `docs/wiki/scene-panels.md` for its Start scene claims (any seed's human seats,
      the companion note). Its sources are unchanged; edit only a claim the trio makes false. Re-pin
      every other note the freshness gate flags, re-verifying each claim that names a touched file.
- [ ] T022 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Add one sentence on
      the trio seed (TASK-0176, specs/061) to `docs/wiki/INDEX.md`'s state paragraph, beside the
      TASK-0163 two-player sentence.
- [ ] T023 In `docs/design/m3-table-sweep-runbook.md` "Execution log", add an amendment row dated
      2026-10-28: the operator ruled in chat, answering "How should the demo get its three human
      players?": "Card a trio seed". Carded TASK-0176; TASK-0053 depends on it. New order:
      TASK-0176 → the TASK-0163 alpha run (spec 054 Phase 8, AC #4) → the TASK-0053 demo. Name the
      OQ-1 to OQ-6 ruling in the same row once it is on the card.
- [ ] T024 Add a TASK-0176 "(this PR)" row in the TASK-0165 row's shape: date, task, PR, —,
      dispatches (`spec (opus ×1), impl ×3 (sonnet)`), then the outcome (the trio seed, no source
      change), the OQ ruling, the DB count, the mutation result (three guards), and the live check
      with three accounts and its shots.
- [ ] T025 Run the wiki freshness gate, the spec-bridge check and `pnpm ci:check`. Commit and push.

---

## Dependencies and order

- Phase 1 → Phase 2. Phase 3 needs only Phase 1's seed id and may run beside Phase 2.
- Phase 4 needs Phases 1 to 3. Phase 5 needs Phase 4.
- Within Phase 1, T001 to T003 can be written in parallel. Within Phase 3, T010 and T011 are
  parallel.

## Implementation strategy

- MVP: Phase 1 meets card AC #1's seed and load test on its own.
- Phase 2 proves three humans on the database. Phase 3 meets card AC #2 and #3.
- Phase 4 proves the slide-out live with three accounts and pins every test by mutation.
- Phase 5 lands the wiki and the sweep runbook in the same PR.
- The TASK-0053 demo and spec findings F-1 and F-2 are outside this card.
