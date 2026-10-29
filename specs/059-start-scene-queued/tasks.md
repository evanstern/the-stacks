# Tasks: The header stops offering Start scene once a scene start is queued

**Input**: `specs/059-start-scene-queued/` (spec.md, plan.md, contracts/scene-start-state.md)

**Board task**: TASK-0167. Card AC #1: the header hides or disables Start scene once the session
has a queued or pending scene start, with a test.

**Prerequisites**: the operator ruled OQ-1 to OQ-4 (a) on 2026-10-28 (spec.md). The tasks below
implement (a) for each.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0167`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green (DB
suites skip without a database) and one commit led by `TASK-0167:`. No modal. Do not change the
`ws-protocol` frames, `specs/029-proposal-gate/contracts/` or
`specs/030-play-route/contracts/proposal-seam.md`. Tests are written first and seen to fail.

## Phase 1: The server predicate, the 409 and the read route (card AC #1; OQ-1)

**Goal**: one pure `sceneStartState`; the POST refuses every state but `none`; the GET returns it.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/scene-start.test.ts`;
the DB cases run in Phase 3.

- [x] T001 Create `apps/server/test/dm/scene-start.test.ts`. Build projections with
      `project([], { role: "dm" })` and edit `scene` and `proposals` per case. Cases: empty →
      `none`; a scene → `started`; a `queued` and a `running` `scene-start` job → `queued`; a
      `succeeded` `scene-start` job → `none`; a `queued` job with trigger `manual` → `none`; a
      pending `ai:dm` `scene` proposal with non-null `after` → `pending`; the same proposal
      `rejected` → `none`; a pending `scene` proposal by a human proposer → `none`; a pending
      `ai:dm` `scene` proposal with `after: null` → `none`; a scene plus a queued job → `started`.
      See it fail (no module).
- [x] T002 Create `apps/server/src/dm/scene-start.ts` per `contracts/scene-start-state.md`
      ("The predicate"). Export `SceneStartState`, `sceneStartState` and
      `START_CONFLICT_MESSAGE: Record<Exclude<SceneStartState, "none">, string>`. Pure: no import
      from `db` or `routes`. T001 passes.
- [x] T003 In `apps/server/test/dm/human-dm-scene.integration.test.ts`, add case (e): after
      `humanDmWorld()`, a second `POST /dm/sessions/:id/start` as the operator returns 409 with
      message `A scene start is waiting for the DM.`, and the session's turn jobs still hold exactly
      one `scene-start` job. Build the app as `routes.integration.test.ts` does (`appWith`,
      `cookieFor("operator")`), against the world's session id and database. Run it red against
      today's route on a database **[orchestrator if no DB]**; if it is not red, follow plan.md
      "Risks" and report.
- [x] T004 In the same file, add case (f): `GET /dm/sessions/:id/start` returns
      `{ "state": "pending" }` after `humanDmWorld()`; after the DM carries out the suggestion
      (reuse case (b)'s steps) it returns `{ "state": "started" }`.
- [x] T005 Add case (g) (OQ-3 (a)): after Dismiss (reject the pending suggestion as the DM), GET
      returns `{ "state": "none" }`.
- [x] T006 In `apps/server/src/routes/dm.ts`, replace the POST's two conflict checks with
      `sceneStartState(projections, await listDmJobs(db, sessionId, 100, "turn"))`. Throw
      `ConflictError(START_CONFLICT_MESSAGE[state])` for every state but `none`. Keep validation
      first and the `enqueueTurn` not-inserted 409 as is.
- [x] T007 Add `route.get("/sessions/:sessionId/start", …)`: `requireOperator`, `sessionIdOf`, the
      same two reads, `c.json({ state })`. No other field.
- [x] T008 In `apps/server/test/dm/routes.integration.test.ts`, extend "starts a scene": GET before
      the first POST is `none`; after it, `queued`; the second POST's message is
      `A scene start is already queued.` Add: GET with no cookie is 401, as a player is 403, with a
      bad session id is 400. Add: a session with a committed scene (reuse the file's existing
      setup or the world helper) returns `started`, and its POST message is
      `The session already has a scene.`
- [x] T009 Amend `specs/031-dm-runtime/contracts/dm-api.md`: a dated "Amendment, TASK-0167
      (additive)" block after the start route, with step 3 as amended and the GET, citing
      `specs/059-start-scene-queued/contracts/scene-start-state.md`. Do not rewrite earlier text.
- [x] T010 Run `pnpm ci:check`. Report the pure test count and that the DB cases skip.

## Phase 2: The live source and the header (card AC #1; OQ-2, OQ-4)

**Goal**: the header offers "Start scene" only on the server's `none`, and shows the note on
`queued` and `pending`.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/play/start-scene.test.mjs test/play/table-view.test.tsx`.

- [x] T011 In `apps/web/test/play/start-scene.test.mjs`, add `fetchStartState` cases with a stubbed
      `fetch`: 200 `{ state: "pending" }` → `"pending"`; a 403 → `null`; a body with an unknown
      state → `null`; a thrown fetch → `null`. It calls `GET /dm/sessions/<encoded id>/start` with
      `credentials: "same-origin"`.
- [x] T012 In the same file, add `nextStartView` cases: `unknown` + `fetched("queued")` →
      `queued`; any + `fetchFailed` → `none`; `none` + `started202` → `queued`; `queued` +
      `fetched("pending")` → `pending`. Add `shouldPollStart`: true for `queued` and `pending`,
      false for `unknown`, `none` and `started`. See them fail.
- [x] T013 In `apps/web/app/play/start-scene.ts`, add `fetchStartState`, `nextStartView` and
      `shouldPollStart` (plan.md "The hook"). T011 and T012 pass.
- [x] T014 In `apps/web/app/play/source.ts`, add `SceneStartView` and the optional
      `TableSource.sceneStart` per the contract.
- [x] T015 In `apps/web/app/play/use-live-table.ts`, for `user.role === "operator"` only: hold the
      view in state (start `unknown`); fetch when `caughtUp` turns true; wrap `startScene` so a
      `{ ok: true }` applies `started202` and every result triggers a fetch; while
      `shouldPollStart(view)`, fetch every 5000 ms (OQ-2 (a)), clearing the timer on change and
      unmount. Return `sceneStart` on the source. Leave it absent for other roles.
- [x] T016 In `apps/web/test/play/table-view.test.tsx`, add a live operator source helper (role
      `operator`, `startScene` stubbed, no scene in the events). Assert by accessible name:
      `sceneStart: "none"` → a "Start scene" button, no status note; `"unknown"` → no button, no
      note; `"queued"` → no button, status "Scene start queued."; `"pending"` → no button, status
      "Scene start waiting for the DM."; `"started"` with no scene → no button, no note. And a
      fixture with a scene → no button, no note. See them fail.
- [x] T017 In `apps/web/app/play/table-view.tsx`: add `source.sceneStart === "none"` to
      `canStart`; remove the `startQueued` state and the `onQueued` setter use (keep
      `StartScenePanel`'s `onQueued` prop as a no-op or drop it if nothing else needs it); pass
      `startNote` = `sceneStart` when it is `queued` or `pending` and `model.scene === null`.
- [x] T018 In `apps/web/app/play/components/table-header.tsx`, replace `startQueued?: boolean` with
      `startNote?: "queued" | "pending"` (OQ-4 (a)) and render the contract's two texts with
      `role="status"`. Update every caller and test that passes `startQueued`.
- [x] T019 Confirm `apps/web/test/play/equivalence.test.tsx` and `apps/web/test/no-dialog.test.mjs`
      pass unchanged (plan.md "Equivalence test").
- [x] T020 Amend `specs/030-play-route/contracts/table-source.md` (the `sceneStart` field),
      `specs/030-play-route/contracts/ui-surfaces.md` (the header's start note texts) and
      `specs/054-two-player-alpha-kit/contracts/web-surfaces.md` ("Play route: Start scene
      slide-out": shown only while the state is `none`; the note per state). Each is a dated
      "Amendment, TASK-0167 (additive)" block.
- [x] T021 In `docs/ops/dev-vm-104.md` step 17, add: with a human DM the header then shows `Scene
      start waiting for the DM.` until the DM carries out the suggestion.
- [x] T022 Run `pnpm ci:check`.

## Phase 3: DB suites and the live check **[orchestrator]**

- [x] T023 **[orchestrator]** On the worktree stack (`pnpm env:up`, migrate both databases, restart
      the app), with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported from the worktree
      `.env`, run `routes.integration`, `human-dm-scene.integration`, `human-dm-roll-resume`,
      `duo`, `scene` and `worker` integration suites. Record T003's red run (before Phase 1's T006,
      or by stubbing rule 3) and the green run.
- [x] T024 **[orchestrator]** Mutation guard: make `sceneStartState` return `none` for rule 3; run
      `scene-start.test` and `human-dm-scene.integration`; confirm the `pending` cases and case (e)
      fail. Restore; `git diff` is empty.
- [x] T025 **[orchestrator]** Live check in Brave, script mode, per
      `specs/055-human-dm-scene-change/quickstart.md` steps 1 to 5 (`<env>` is `task-0167`,
      `DM_FAKE_SCRIPT=greyhollow-human-dm`). Before the human DM acts, open the play URL as the
      operator: expect no "Start scene" button and the note "Scene start waiting for the DM."
      Reload: the same. Send a second start (HTTP): expect 409. Carry out the suggestion: the
      header shows the scene and no note. Then, on a second session, Dismiss the suggestion and
      expect "Start scene" back within 5 s (OQ-2, OQ-3).
- [x] T026 **[orchestrator]** AI-DM path: start a scene from the slide-out per
      `specs/054-two-player-alpha-kit/quickstart.md` in script mode. Right after the 202, expect
      "Scene start queued." and no button, then the scene title. Shots at 1280 px and 390 px, light
      and dark, of the pending header and the queued header in
      `specs/059-start-scene-queued/evidence/shots/`. No shot shows a modal. Record everything in
      `specs/059-start-scene-queued/evidence/live-run.md`. Remove the `DM_FAKE_SCRIPT` line and
      recreate the app container. Leave the stack up.

## Phase 4: Wiki re-ground

- [x] T027 Re-verify and re-pin `docs/wiki/scene-panels.md` ("Start scene": the server state, the
      GET, the hidden button, the two notes, the poll).
- [x] T028 Re-verify and re-pin `docs/wiki/play-route.md` (`TableSource.sceneStart`; `TableView`
      holds no start flag) and `docs/wiki/dm-runtime.md` (`/dm` routes: the GET and the `pending`
      409).
- [x] T029 Re-pin `docs/wiki/debug-view.md`, `docs/wiki/server-entrypoint-and-app.md`,
      `docs/wiki/hosted-dev.md` and `docs/wiki/react-router-app.md` where they list a touched
      source. Re-verify each claim that names a touched file; edit only what changed.
- [x] T030 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Add one sentence on
      spec 059 to `docs/wiki/INDEX.md`'s state paragraph.
- [x] T031 Add a TASK-0167 "(this PR)" row to the execution log in
      `docs/design/m3-table-sweep-runbook.md`, in the TASK-0168 row's shape.
- [x] T032 Run the wiki freshness gate
      (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      prints `OK`) and the spec-bridge check
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` exits 0).
      Run `pnpm ci:check`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4. Phase 2 needs Phase 1's GET contract. Phase 3 needs both.
