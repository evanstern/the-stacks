# Tasks: Human DM carries out a scene change from the table

**Input**: `specs/055-human-dm-scene-change/` — spec.md (ruled D-1 to D-7), plan.md,
contracts/scene-change.md, quickstart.md.

**Tests**: required. Every phase is red-first: write the test, run it, see it fail for the stated
reason, then implement.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order.

**Format**: `[ID] [P?] [Story] Description`. `[P]` = a different file with no open dependency.
`[US1]` = carry out a scene suggestion (P1). `[US2]` = edit the current scene (P2).
"(orchestrator)" = the orchestrator runs it, because implementers cannot export `TEST_DATABASE_URL`.

**Standing rules for every phase**:

- Work only in `/Users/evanstern/projects/the-stacks/.worktrees/task-0159`.
- Run `pnpm install --frozen-lockfile` first in a fresh worktree.
- The UI has no modals. The control is a slide-out `Panel`. Browser automation uses Brave.
- Do not change `PendingProposalView`, `ProposalCommands`, `ProposalList` props, any
  `specs/029-proposal-gate/contracts/` file, or `docs/wiki/ws-protocol.md` frame shapes.
- Never read, print or commit keys or passwords.
- Commit with `git -C <literal worktree path>`, staging and committing in separate Bash calls.
  Lead each commit message with `TASK-0159:`.
- Web tests: `pnpm --filter @the-stacks/web test`. End each phase with `pnpm ci:check` green.

---

## Phase 1: The scene request and command (card AC #1)

**Goal**: the play route can build and send a `scene` gate request, live and fixture, with the D-3
close of a pending seed.

**Independent test**: `frames.test.mjs`, `local-log.test.mjs` and `use-fixture-table.test.mjs`
pass with the new cases.

- [x] T001 Merge `origin/main` into the branch (`git -C <worktree> fetch origin` then `git -C <worktree> merge origin/main`), so TASK-0163's `start-scene-panel.tsx`, `TableHeader` props and `TableSource.role` are present. Resolve conflicts keeping both sides. Run `pnpm install --frozen-lockfile` and `pnpm --filter @the-stacks/web test` green before any edit.
- [x] T002 [P] [US1] Red: add `sceneFrame` and `sceneSummary` cases to `apps/web/test/play/frames.test.mjs`: a valid scene builds `eventType: "scene"`, `payloadVersion: GATE_REQUEST_VERSION`, `{ reason, after, summary: "Scene: <title>", rationale: null }`; fields are trimmed and a blank location becomes `null`; `after: null` builds summary "Clear the scene"; a 201-character title, an empty reason and a bad `sceneId` each return null; `closeProposalId` is absent from the payload; `localEventOf` returns null for a scene frame. Run it and see it fail on the missing export.
- [x] T003 [P] [US1] Red: add `localSceneEvents` cases to `apps/web/test/play/local-log.test.mjs`, using the `dm-approvals` fixture's DM projection: `before` equals the vault-door scene and `after` the input; `before: null` and `after: null` returns null; `payloadVersion` is `currentVersion("scene.changed")`.
- [x] T004 [US1] Add `SceneInput` and `TableCommands.changeScene(input: SceneInput): boolean` to `apps/web/app/play/source.ts`, per plan.md "Data model". Keep TASK-0163's `startScene?` and `role`.
- [x] T005 [US1] Implement `sceneSummary` and `sceneFrame` in `apps/web/app/play/frames.ts` per `contracts/scene-change.md` "Frame". Parse with `ReasonSchema` and `SceneSchema` from `@the-stacks/session-model`. T002 goes green.
- [x] T006 [US1] Implement `localSceneEvents(p, input)` in `apps/web/app/play/local-log.ts`. T003 goes green.
- [x] T007 [US1] Wire `changeScene` in `apps/web/app/play/use-live-table.ts`: `const ok = send(sceneFrame(input)); if (ok && input.closeProposalId) send(rejectFrame(input.closeProposalId, null)); return ok;`.
- [x] T008 [US1] Red, then green: add a `changeScene` case to `apps/web/test/play/use-fixture-table.test.mjs` (appends one `scene.changed` row; a set `closeProposalId` leaves `source.proposals`; an invalid input returns false and appends nothing). Then wire `changeScene` in `apps/web/app/play/use-fixture-table.ts` like `appendFloor`, plus `decide(closeProposalId)` when it is set.
- [x] T009 [US1] Add `changeScene` to every hand-built `TableCommands` stub in `apps/web/test/play/*.test.*` so the type check passes. Run `pnpm ci:check`. Commit: `TASK-0159: scene gate request and changeScene command`.

**Mutation check (implementer)**: in `use-live-table.ts` drop the reject send. No unit test covers
the live hook, so record in `evidence/mutation-guard.md` that the live close is proven by Phase 5
step 8 instead. In `frames.ts` remove the `SceneSchema` parse: T002's over-long-title case must
fail. Restore with an empty `git diff`.

---

## Phase 2: Seeds and the view model (card AC #2)

**Goal**: a pure `sceneChangeView` lists scene proposals as seeds for a DM viewer, and the table
view model carries it.

**Independent test**: `scene-seeds.test.mjs` and `view-model.test.mjs` pass.

- [x] T010 [P] [US1] Red: create `apps/web/test/play/scene-seeds.test.mjs` over the `dm-approvals` fixture's DM projection with `pendingIds` from `selectPendingProposals`. Cases: P3 is the one `pending` seed, `policy: "suggest"`, scene `vault-interior` with its title, summary, location and reason; `current` is the vault-door scene with `reason: ""`; with P3's id removed from `pendingIds`, P3 moves to `earlier` (the fixture-mode decided case); an `ask` scene proposal from `ai:dm` is a seed (D-4); a scene proposal from a non-`ai:dm` proposer is not; with twelve scene proposals only the last ten appear; a clear seed is dropped when `p.scene` is null; `turnMode` follows `p.tableMode`; `empty` is true for a projection with no scene and no scene proposal. Build extra event lists with the fixture builders in `@the-stacks/session-model/fixtures` (or by appending rows to a fixture copy); original content only.
- [x] T011 [US1] Implement `apps/web/app/play/scene-seeds.ts` (`SceneSeedView`, `SceneChangeView`, `sceneChangeView`) per `contracts/scene-change.md` "Seeds". T010 goes green.
- [x] T012 [US2] Red, then green: add `view-model.test.mjs` cases (DM viewer: `sceneChange` not null with P3 pending; player viewer: `sceneChange` null). Then add `sceneChange: SceneChangeView | null` to `TableViewModel` in `apps/web/app/play/view-model.ts`, built from `input.proposals` ids. Update any `TableViewModel` literal in tests.
- [x] T013 Run `pnpm ci:check`. Commit: `TASK-0159: scene seeds and the view model`.

**Mutation check (implementer)**: in `scene-seeds.ts` remove the `ai:dm` proposer filter; the
non-`ai:dm` case must fail. Remove the ten-item cap; the twelve-proposal case must fail. Restore
with an empty `git diff`. Record both in `specs/055-human-dm-scene-change/evidence/mutation-guard.md`.

---

## Phase 3: The scene panel and the header trigger (card AC #1, card AC #2)

**Goal**: a seated human DM opens "Change scene", picks a seed, edits it and applies it. No modal.

**Independent test**: `scene-panel.test.tsx` and `table-view.test.tsx` pass, and the equivalence
test still passes.

- [x] T014 [P] [US1] Red: create `apps/web/test/play/scene-panel.test.tsx` (`renderToStaticMarkup`, no DOM). Cases: seeded from P3, the markup holds "Scene id" `vault-interior` read-only and P3's title, summary, location and reason; seed buttons are named "Use: <label>" under "Suggestions" and "Earlier suggestions", with "Suggestion" or "Proposal" tags; "Use: Current scene" is present when a scene is set; "Clear the scene" is absent when no scene is set; `turnMode` shows "The table stays in turn mode."; `empty` shows "No scene to change yet. Start a scene, or wait for the AI DM's suggestion." and no "Apply"; no element has `role="dialog"` with `aria-modal`. Export a pure `initialDraft(view)` and `applyInput(draft, seed)` from the component module and test them: `applyInput` keeps the seed's `sceneId`, sets `closeProposalId` only for a `pending` seed, and sends `after: null` when "Clear the scene" is checked.
- [x] T015 [US1] Implement `apps/web/app/play/components/scene-panel.tsx` (`ScenePanel`, `SCENE_PANEL_ID`, `initialDraft`, `applyInput`) per `contracts/scene-change.md` "Panel". Use the existing input and button classes from `proposal-list.tsx` and `start-scene-panel.tsx`. Labels are `<label>` elements tied to inputs. T014 goes green.
- [x] T016 [US1] Add `sceneOpen` and `onScene?` to `TableHeader` in `apps/web/app/play/components/table-header.tsx`: a "Change scene" button for `model.isDm` with `aria-controls={SCENE_PANEL_ID}` and `aria-expanded`. Keep `onStartScene` and `startQueued`.
- [x] T017 [US1] In `apps/web/app/play/table-view.tsx`, add `sceneOpen` state, pass `sceneOpen` and `onScene` to `TableHeader`, and mount `<Panel title="Change scene" description="Change the scene, or carry out a scene suggestion." id={SCENE_PANEL_ID}>` with `ScenePanel` when `model.sceneChange` is not null. `onApply` calls `source.commands.changeScene`.
- [x] T018 [US1] Red, then green: add `apps/web/test/play/table-view.test.tsx` cases: the `dm-approvals` DM viewer renders a "Change scene" trigger; a player viewer renders none. Confirm `apps/web/test/play/equivalence.test.tsx` still passes with the panel closed (FR-014).
- [x] T019 [P] Append additive blocks tagged "Amendment (TASK-0159, operator ruling 2026-10-28, D-1)" to `specs/030-play-route/contracts/ui-surfaces.md` (the `TableHeader` row gains `sceneOpen, onScene`; a `ScenePanel` row; the accessible names from `contracts/scene-change.md`), `specs/030-play-route/contracts/live-frames.md` (a `changeScene` row: `eventType: "scene"`, then `proposal.reject` when closing a pending seed) and `specs/030-play-route/contracts/table-source.md` (`TableCommands.changeScene`). Quote the ruling once in `ui-surfaces.md`. Edit nothing above the blocks.
- [x] T020 Run `pnpm ci:check`. Commit: `TASK-0159: Change scene slide-out and header trigger`.

**Mutation check (implementer)**: in `applyInput` replace the seed's `sceneId` with a slug of the
title; T014 must fail. Make `closeProposalId` always the seed's id; the `earlier` case must fail.
Restore with an empty `git diff`. Record both in `evidence/mutation-guard.md`.

---

## Phase 4: The AI DM resumes in the carried-out scene (card AC #2, SC-002)

**Goal**: a DB test proves that a human DM's carry-out of the scene-start suggestion lets the next
AI DM turn load the seed, and a shipped script lets the live check replay it.

**Independent test**: `dm-scripts.test.ts` passes (implementer); the new DB test passes
(orchestrator).

- [x] T021 [US1] Read `apps/server/test/dm/world.js`, `resolve.human-seat.integration.test.ts` and `worker.integration.test.ts` ("DM enqueuer on approvals"). Write red `apps/server/test/dm/human-dm-scene.integration.test.ts` with three cases on one world each, human DM seated before the scene starts: (a) the scene-start turn leaves one pending `scene` proposal, policy `suggest`, `after.sceneId` the seed id, and `p.scene` null; (b) baseline: the human DM sends `proposal.reject` on it only, the worker runs the `approval` turn, and its job result outcome is `empty-beat`; (c) the human DM sends `scene` with the proposal's `after` and then `proposal.reject`, the worker runs the `approval` turn, and its result names no failure and its `checkpoint.beat` is set (assemble ran, so the seed loaded). In (b) `checkpoint.beat` is null (the no-scene path). An approval turn with no player action ends `empty-beat` by design (ruled). If `startScene` in `world.js` assumes an AI seat, enqueue the scene-start job the way `apps/server/src/routes/dm.ts` does. Do not change server source.
- [x] T022 [US1] Create `apps/server/test/dm/scripts/human-dm-approval.json`: the scripted calls the case (c) approval turn makes, built from the purposes and outputs in `scene-start.json` and `exploration-check.json` (original content only). Find the purpose list by reading `apps/server/src/dm/pipeline/` for an `approval` trigger. Wire it into T021's case (c).
- [ ] T023 (orchestrator) Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/human-dm-scene.integration.test.ts` with only `TEST_DATABASE_URL` exported from the worktree `.env`. Expect (a), (b), (c) green. Record the output in `specs/055-human-dm-scene-change/evidence/db-run.md`. If (c) fails for a reason other than the scene (for example a pending narration or party proposal blocks the turn), stop and report it as a new open question. Do not fix server code in this task.
- [ ] T024 (orchestrator) DB mutation check: in case (c) drop the `scene` request. The case must fail with `empty-beat`. Then send `after.sceneId: "no-such-seed"`. The case must fail with `bad-seed`. Restore with an empty `git diff`. Record both in `evidence/mutation-guard.md`.
- [x] T025 [P] [US1] Create `apps/server/dm-scripts/greyhollow-human-dm.json` (`name: "greyhollow-human-dm"`): the calls of `test/dm/scripts/scene-start.json`, then `human-dm-approval.json`, then one `dm.chronicle` call per narrated turn as `greyhollow-live.json` does. Dice as the turns need (none if no roll).
- [x] T026 [US1] Red, then green: add a case to `apps/server/test/dm/dm-scripts.test.ts`: `greyhollow-human-dm` equals `scene-start` plus `human-dm-approval` calls, followed only by `dm.chronicle` calls. The existing `it.each` load case covers schema validity. Run `pnpm --filter @the-stacks/server exec vitest run test/dm/dm-scripts.test.ts`.
- [x] T027 Run `pnpm ci:check`. Commit: `TASK-0159: human-DM scene regression test and greyhollow-human-dm script`.

---

## Phase 5: Live check in script mode (card AC #1, card AC #2)

**Goal**: on the worktree stack, a human DM carries out the pending scene-start suggestion with the
seed's `sceneId`, and the next AI DM turn loads the seed: its `checkpoint.beat` is set, where the no-scene baseline leaves it null.

**Independent test**: `evidence/live-run.md` records steps 1 to 11 of `quickstart.md`, with the
shots.

- [ ] T028 [US1] Write `specs/055-human-dm-scene-change/evidence/start-human-dm.mjs <creds-file>`, modelled on `specs/053-env-fake-dm-script/evidence/start-scene.mjs`: sign in as the operator, send `dm.seat` over the WebSocket (`after: { kind: "human", userId }`), start `greyhollow-ford` with the player on the human seat, and print the play and debug URLs. It reads credentials from the file and never prints them.
- [ ] T029 [US1] Run `quickstart.md` steps 1 to 8c (the approval turn records `checkpoint.beat` set and no model calls; the player turn runs the `human-dm-approval` calls) on `stacks-task-0159` with `DM_FAKE_SCRIPT=greyhollow-human-dm`. Record the scene-start job, the `scene.changed` and `proposal.rejected` seqs, the `approval` turn job id, outcome and call purposes in `evidence/live-run.md`.
- [ ] T030 [US1] Run `quickstart.md` step 9 (the Dismiss-only baseline) and record its `empty-beat` outcome with `checkpoint.beat` null in `evidence/live-run.md`.
- [ ] T031 [P] [US1] Write `specs/055-human-dm-scene-change/evidence/shoot-live.mjs`, modelled on `specs/054-two-player-alpha-kit/evidence/shoot-live.mjs`, driving Brave. Take the shots listed in `quickstart.md` "Screenshots" into `evidence/shots/`: the seeded panel and the applied table at 1280 px and 390 px, light and dark, plus the debug approval turn and the player view with no control. Check each shot shows no modal.
- [ ] T032 [US2] On the same session, open "Change scene" again, pick "Use: Current scene", change the location and apply. Record the second `scene.changed` row (same `sceneId`) in `evidence/live-run.md`.
- [ ] T033 Run `quickstart.md` steps 10 and 11. Leave the stack up for the orchestrator's `pnpm env:down`. Commit the evidence: `TASK-0159: live check in script mode`.

---

## Phase 6: Merge, re-ground and close (all ACs)

**Goal**: the branch is current with `main`, the wiki is re-pinned, the gates pass and the runbook
is updated.

- [ ] T034 Merge `origin/main` into the branch again (`git -C <worktree> merge origin/main`). Resolve conflicts keeping both sides. Re-run `pnpm --filter @the-stacks/web test`.
- [ ] T035 Run `/grounding-wiki:wiki-update` for the sources this branch touched. Expect `docs/wiki/play-route.md` (new sources `scene-seeds.ts`, `components/scene-panel.tsx`; the "Open gap" sentence replaced by the Change scene slide-out, D-1 to D-7) and any note the plan names as NEEDS-REVIEW (`turn-floor.md` and `runtime-stacks.md` list play-route or dm-scripts sources). Name `greyhollow-human-dm` in `runtime-stacks.md` beside `greyhollow-live`. Update the play-route lines in `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`. Re-pin honestly.
- [ ] T036 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [ ] T037 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`. Expect exit 0.
- [ ] T038 In `docs/design/m3-table-sweep-runbook.md`, fill the TASK-0163 row: replace "(this PR)" with `[#79](https://github.com/evanstern/the-stacks/pull/79)` and "—" with `` `6d6982e` ``. Append a TASK-0159 row with "(this PR)", using the text the orchestrator gives. Do not edit other rows.
- [ ] T039 Run `pnpm ci:check`. Commit: `TASK-0159: re-ground wiki, runbook rows`. Push.
- [ ] T040 (orchestrator) Run `REQUIRE_DATABASE=1 pnpm ci:check` on the merged tree with only `TEST_DATABASE_URL` exported. Re-run a WebSocket gateway or DB scene timeout failure once and report it (TASK-0154).

---

## Dependencies and order

- Phase 1 → Phase 2 → Phase 3: each builds on the previous types.
- Phase 4 depends only on Phase 1's T001 merge. It can run beside Phases 2 and 3 if the
  orchestrator wants a parallel dispatch; it touches only `apps/server/test/` and
  `apps/server/dm-scripts/`.
- Phase 5 needs Phases 3 and 4.
- Phase 6 is last.

## Parallel examples

- Phase 1: T002 and T003 (different test files).
- Phase 3: T014 and T019 (a test file and contract docs).
- Phase 4: T025 beside T021 and T022 once the purpose list is known.

## Implementation strategy

MVP is US1 (Phases 1 to 3 plus the Phase 4 proof): a human DM carries out a suggestion with its
`sceneId`. US2 (edit the current scene) rides the same panel and adds only T012 and T032.

## Card AC coverage

| Card AC | Tasks |
|---|---|
| #1 control built from a gate scene request, no modal, a test | T002–T009, T012, T014–T020, T028–T033 |
| #2 a scene suggestion's content seeds the control | T010–T011, T014–T015, T021–T026, T029–T031 |
