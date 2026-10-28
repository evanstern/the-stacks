# Tasks: Two-player alpha kit

**Input**: `specs/054-two-player-alpha-kit/` (spec.md, plan.md, research.md, data-model.md,
contracts/dm-seeds.md, contracts/scene-start-seats.md, contracts/web-surfaces.md, quickstart.md)

**Board task**: TASK-0163. Card AC #1: a shipped seed seats at least two humans, loads through
`loadSeed`, and has a test. Card AC #2: a second person gets a player account through the web
app from an operator-issued invitation, with no modal, and a test. Card AC #3:
`docs/ops/dev-vm-104.md` documents issuing an invitation, creating a session, and starting a
scene with a seat per human on hosted dev. Card AC #4: the runbook is run once on hosted dev
with two accounts, and the result is recorded on the card.

**Rulings**: Q1-Q6 resolved 2026-10-28, all defaults accepted (spec.md, "Open questions").

**Tests**: Required. Each phase writes its tests first and sees them fail before the code.

**Rules for every phase**: one phase is one sonnet dispatch, except Phase 8, which the
orchestrator runs. Work only in `/Users/evanstern/projects/the-stacks/.worktrees/task-0163`. No
provider key, no paid call: tests use the fake gateway, and the live run uses `DM_FAKE_SCRIPT`.
Never read, print or commit a secret. Generated test passwords live only in the session
scratchpad. No modal: slide-outs use `apps/web/app/components/panel.tsx`. Do not change the
`ws-protocol` frames, `specs/029-proposal-gate/contracts/`,
`specs/030-play-route/contracts/proposal-seam.md`, the invitation routes, or the seed schema.
Finish each phase with `pnpm ci:check` green; DB suites run with `REQUIRE_DATABASE=1` on this
worktree's stack, exporting only `TEST_DATABASE_URL` from the worktree `.env`. Commit as
`TASK-0163: Phase <n> — <title>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an open task).
- **[US1]**: User Story 1 (card AC #1). **[US2]**: User Story 2 (card AC #2).
  **[US3]**: User Story 3 (card AC #3). **[US4]**: User Story 4 (card AC #4).

---

## Phase 1: Duo seed, seat rules and the seeds route (card AC #1)

**Goal**: `greyhollow-ford-duo` loads, the loader accepts one or more humans, the start route
refuses one user in two seats, and `GET /dm/seeds` lists the shipped seeds.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/seed.test.ts`,
then `REQUIRE_DATABASE=1` `vitest run test/dm/routes.integration.test.ts`.

- [x] T001 Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0163 fetch origin`,
  then `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0163 merge origin/main`. This
  brings in TASK-0158 (`DM_FAKE_SCRIPT`, merge `e20030d`). Keep both sides of any conflict. Run
  `pnpm install --frozen-lockfile`.
- [x] T002 [US1] In `apps/server/test/dm/seed.test.ts`, rewrite the "exactly one character"
  cases: a seed with no human is refused with `at least one character must have seat "human",
  found 0`; a seed with every character human loads. Add a case that `loadSeed("greyhollow-ford-duo")`
  loads, its humans are `["tamsin", "kestrel"]` and its companions are `["odo"]`. Add a case
  that greyhollow-ford still has exactly one human.
- [x] T003 [US1] In the same file, add `listSeeds` cases per `contracts/dm-seeds.md`: the default
  directory lists `greyhollow-ford` and `greyhollow-ford-duo` sorted by id; a temp directory
  (`mkdtempSync` under `os.tmpdir()`) holding one valid and one invalid seed lists only the valid
  one and does not throw.
- [x] T004 [US1] In `apps/server/test/dm/routes.integration.test.ts`, add cases: `GET /dm/seeds`
  as the operator returns 200 with each seed's `seedId`, `title`, `humans` and `companions` and no
  other field; as a player returns 403; with no cookie returns 401. A start on
  `greyhollow-ford-duo` with one user id in both seats returns 400 with one issue at
  `seats.kestrel`, `A user can hold only one seat.`, and enqueues no job. A start with two
  distinct user ids returns 202.
- [x] T005 [US1] Run T002 to T004 and confirm each new case fails.
- [x] T006 [US1] Create `apps/server/seeds/greyhollow-ford-duo.json` per `data-model.md`: a copy
  of `greyhollow-ford.json` with `seedId` `greyhollow-ford-duo`, `title`
  `Greyhollow Ford (two players)`, kestrel's `seat` `human`, and kestrel's `portrayal.voice` and
  `portrayal.want` set to `Chosen by the player.`. Keep every other field.
- [x] T007 [US1] In `apps/server/src/dm/seed/load.ts`, change the human-count rule in
  `crossCheckSeed` to "at least one" with the issue text from T002. Add and export
  `listSeeds(dir = DEFAULT_SEED_DIR)` per research R4. Log a failed file once as
  `{ event: "dm.seeds.load-failed", seedId, issues }` with `console.warn(JSON.stringify(...))`.
- [x] T008 [US1] In `apps/server/src/routes/dm.ts`, add `GET /seeds` (operator only) per
  `contracts/dm-seeds.md`, and add rule 3 of `contracts/scene-start-seats.md` to the start
  route's seat issues. Run T002 to T004 green.
- [x] T009 [US1] Run `pnpm ci:check` with `REQUIRE_DATABASE=1`. Commit and push.
  Orchestrator ran the DB suite on 143044b: REQUIRE_DATABASE=1 pnpm ci:check exit 0, server 1250 passed, routes.integration 15/15.

---

## Phase 2: Two-human behaviour check and mutation guard (card AC #1)

**Goal**: tests on the duo seed show scene start, the actor snapshot, the DM prompts, group
sign-off and floor passing behave with two humans; the two new seat rules are pinned by tests.

**Independent test**: `vitest run test/dm/duo-views.test.ts`, then `REQUIRE_DATABASE=1`
`vitest run test/dm/duo.integration.test.ts`.

- [x] T010 [P] [US1] Create `apps/server/test/dm/duo-views.test.ts` (no database), per research
  R9. Build duo projections in which tamsin and kestrel have `player` controllers for two distinct
  user ids and odo is an `ai-companion`; reuse the builders in `apps/server/test/dm/snapshot-fixtures.ts`
  and `helpers.ts`, adding a duo variant beside the existing greyhollow-ford one. Assert: the
  actor snapshot's `seat` view for each user marks that user's own character and shows the other
  human as a party member; the `dm` view lists both humans as players and odo as a companion;
  the player-facing interpret and narrate prompts (see `test/dm/player-facing-prompts.test.ts`)
  name both humans and never call kestrel a companion.
- [x] T011 [P] [US1] Create `apps/server/test/dm/duo.integration.test.ts` (database), modelled on
  `test/dm/scene.integration.test.ts` and `test/dm/floor-jobs.integration.test.ts`. Run scene start
  on `greyhollow-ford-duo` through the real queue with the `scene-start.json` script and seats
  `{ tamsin: <user A>, kestrel: <user B> }`. Assert three party rows: tamsin and kestrel with
  `player` controllers for A and B, odo with `ai-companion`. Then, with both users present, a
  party-scope action commits only after both approve (group sign-off, TASK-0049); with B absent,
  A's approval alone commits it. Then, in turn mode with B absent, the floor job passes B's turn
  (TASK-0050). Add a script under `apps/server/test/dm/scripts/` only if `scene-start.json` does
  not fit.
- [x] T012 [US1] Run T010 and T011. For each failure, decide: does it block the duo seed from
  starting or seating two humans? If yes, fix it in the smallest change and note the fix. If no,
  mark the case `it.fails` with a comment naming the defect, and write the defect (symptom, test
  name, source file) in `specs/054-two-player-alpha-kit/evidence/two-human-check.md` for the
  orchestrator to card. When nothing fails, the file says so and lists the cases run.
- [x] T013 [US1] Mutation check. Commit T010 to T012 first. Then:
  (a) in `apps/server/src/dm/seed/load.ts`, make the human-count rule always pass; run
  `test/dm/seed.test.ts` and confirm the no-human case fails; restore the file.
  (b) in `apps/server/src/routes/dm.ts`, remove the one-user-two-seats issue; run
  `test/dm/routes.integration.test.ts` with `REQUIRE_DATABASE=1` and confirm the duplicate-seat
  case fails; restore the file.
  After each restore, confirm `git diff -- <file>` is empty. Record the failing case names in
  `specs/054-two-player-alpha-kit/evidence/mutation-guard.md`.
- [x] T014 [US1] Run `pnpm ci:check` with `REQUIRE_DATABASE=1`. Commit and push.
  Orchestrator-run on 68ff701: duo.integration 4/4 passed; REQUIRE_DATABASE=1 pnpm ci:check exit 0, server 1261 passed.

---

## Phase 3: Redeem toggle and the invite section (card AC #2)

**Goal**: a signed-out visitor redeems an invitation on the sign-in card and lands signed in as
a player; the operator creates an invitation on Settings. No modal.

**Independent test**: `pnpm --filter @the-stacks/web test`.

- [x] T015 [P] [US2] Create `apps/web/test/sign-in.test.tsx` per `contracts/web-surfaces.md`
  ("Sign-in card"). Stub `fetch`. Cases: the card shows `Have an invitation?`; pressing it shows
  the four redeem fields and `Back to sign in`; submit posts `{ token, username, displayName,
  password }` to `/auth/invitations/redeem` with the token trimmed, and on 201 revalidates;
  a 400 with a `token` issue shows the invalid-token message; a 409 shows the username message;
  `Back to sign in` restores the sign-in form. No case puts the token in `location`.
- [x] T016 [P] [US2] Create `apps/web/test/settings-invite.test.tsx` per `contracts/web-surfaces.md`
  ("Settings"). Cases: a player sees no `Invite a player` section; the operator sees it with
  expiry default 7; `Create invitation` posts `{ expiresInDays: 7 }` to `/auth/invitations`; on
  201 the token shows in a read-only field with `Copy` and the expiry; a failure shows
  `Could not create an invitation.`.
- [x] T017 [P] [US2] In `apps/web/test/ssr.test.mjs`, add a case: `/` signed out renders the
  `Have an invitation?` control.
- [x] T018 [US2] Run T015 to T017 and confirm each new case fails.
- [x] T019 [US2] In `apps/web/app/auth.ts`, add `redeemInvitation(input)` and
  `issueInvitation(expiresInDays)` fetch wrappers. Each returns a typed result or throws an
  error that carries the HTTP status and the error-contract `issues`.
- [x] T020 [US2] In `apps/web/app/sign-in.tsx`, add the redeem mode per the contract and research
  R7. Keep the existing sign-in form and its hydration guard unchanged.
- [x] T021 [US2] In `apps/web/app/routes/settings.tsx`, add the operator-only invite section per
  the contract and research R8.
- [ ] T022 [US2] Run T015 to T017 green. Confirm `apps/web/test/no-dialog.test.mjs` passes. Run
  `pnpm ci:check`. Commit and push.

---

## Phase 4: Start scene slide-out (card AC #3)

**Goal**: the operator starts a scene on `/play/:sessionId` with a seat per human, choosing
from the humans present at the table.

**Independent test**: `pnpm --filter @the-stacks/web test`.

- [ ] T023 [P] [US3] Create `apps/web/test/play/start-scene.test.mjs` for pure helpers in
  `apps/web/app/play/start-scene.ts`: `seatMapIssues(humans, seats)` returns an issue per empty
  seat and per repeated user; `startBody(seedId, seats)` returns `{ seedId, seats }` with empty
  seats dropped; `issuesBySeat(errorIssues)` maps `seats.<id>` paths to seats and the rest to
  a form-level list.
- [ ] T024 [P] [US3] Create `apps/web/test/play/start-scene-panel.test.tsx` per
  `contracts/web-surfaces.md` ("Play route"). Stub `fetch` for `GET /dm/seeds` and the start
  route. Cases: the header shows `Start scene` only for the operator, on a live table, after
  replay, with no scene; the panel lists the seeds; choosing the duo seed shows a select for
  Tamsin Vale and Kestrel with the present humans as options and lists Brother Odo as an AI
  companion; `Start` is disabled while a seat is empty or one user holds both seats; `Start`
  posts the seat map and on 202 closes the panel and shows `Scene start queued.`; a 400 shows its
  seat issue beside that seat.
- [ ] T025 [US3] Run T023 and T024 and confirm each new case fails.
- [ ] T026 [US3] Create `apps/web/app/play/start-scene.ts` (pure helpers) and
  `apps/web/app/play/components/start-scene-panel.tsx` (the slide-out, on `components/panel.tsx`).
- [ ] T027 [US3] Expose what the panel needs on the live source in
  `apps/web/app/play/source.ts` and `apps/web/app/play/use-live-table.ts`: the signed-in user's
  role and a `startScene(body)` command that posts to `/dm/sessions/<sessionId>/start`. The
  fixture source (`use-fixture-table.ts`) leaves both absent, so fixtures never show the control.
- [ ] T028 [US3] Wire the header control and the panel in
  `apps/web/app/play/components/table-header.tsx` and `apps/web/app/play/table-view.tsx`. Run
  T023 and T024 green. Confirm `no-dialog.test.mjs` passes. Run `pnpm ci:check`. Commit and push.

---

## Phase 5: Runbook section and the DM API contract (card AC #3)

**Goal**: the hosted-dev runbook covers a two-player table end to end, and the DM API contract
records the new route and refusal.

**Independent test**: a reader can follow the new section against `quickstart.md` with no step
that needs source code.

- [ ] T029 [US3] In `docs/ops/dev-vm-104.md`, add a section `Run a two-player table` after
  `Create the first operator`. Write it in procedural prose: one instruction per sentence,
  imperative, about 20 words at most, one name per concept. Cover, in order: sign in as the
  operator; create an invitation on Settings; send the token by a private channel; the player
  redeems it on the sign-in card; create a session with `Start a new table` on the Table page;
  every human opens the table link; the operator opens `Start scene`, chooses
  `Greyhollow Ford (two players)`, and seats one human per character; expected results and the
  three refusals from `quickstart.md`; where to look when the opening does not arrive (the debug
  page). Name the model-key requirement and point at the `Secrets` section. Name
  `specs/054-two-player-alpha-kit/quickstart.md` and `specs/053-env-fake-dm-script/quickstart.md`
  as the local rehearsal.
- [ ] T030 [P] [US3] In `specs/031-dm-runtime/contracts/dm-api.md`, add a `GET /dm/seeds` section
  that points at `specs/054-two-player-alpha-kit/contracts/dm-seeds.md`, and add rule 3 of
  `contracts/scene-start-seats.md` to the start route's list. Additive only.
- [ ] T031 [US3] Run `pnpm ci:check`. Commit and push.

---

## Phase 6: Local live run on this worktree's stack (card AC #2, #3)

**Goal**: the quickstart runs for real with two accounts in two browser contexts, with evidence
saved in the spec dir.

**Independent test**: `specs/054-two-player-alpha-kit/evidence/live-run.md` records every
quickstart step with its observed result, and `evidence/shots/` holds the screenshots.

- [ ] T032 [US2] [US3] Run `pnpm env:up`. Migrate both databases credential-free per
  `specs/053-env-fake-dm-script/quickstart.md` step 2, with `<env>` `task-0163`. Set
  `DM_FAKE_SCRIPT=greyhollow-live` per that quickstart, steps 3-5. Create the operator per step 6
  with a generated password stored only in the session scratchpad.
- [ ] T033 [US2] [US3] Write `specs/054-two-player-alpha-kit/evidence/shoot-live.mjs`, modelled on
  `specs/053-env-fake-dm-script/evidence/shoot-live.mjs` (Playwright with Brave as the
  executable). It reads a credentials file path from its arguments (never from the repo), drives
  two browser contexts through `quickstart.md` steps 4-9, generates the player password into
  the scratchpad file, and saves screenshots at 1280 and 390 px wide, light and dark, of: the
  sign-in card in redeem mode, the Settings invite section after creation, the Start scene
  slide-out with both seats chosen, and the table after the opening in each context.
- [ ] T034 [US2] [US3] Run it. If the opening fails on the duo seed under `greyhollow-live`, add
  `apps/server/dm-scripts/greyhollow-duo-live.json` (research R6), add it to
  `apps/server/test/dm/dm-scripts.test.ts`, recreate the app container and rerun. Check the three
  refusals of `quickstart.md` (a 403 on `GET /dm/seeds` as the player, a duplicate-seat 400, a
  second-start 409) and the second redeem of a used token.
- [ ] T035 [US2] [US3] Write `specs/054-two-player-alpha-kit/evidence/live-run.md`: the commit,
  each step and its observed result, the refusals, and a list of the screenshots in
  `evidence/shots/`. Name no password and no token. Leave the stack up. Run `pnpm ci:check`.
  Commit and push.

---

## Phase 7: Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3)

**Goal**: the branch is current with `origin/main`, the wiki is re-pinned honestly, and the
sweep runbook records the ruling and the PRs.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
prints `OK`, and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
exits 0.

- [ ] T036 Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0163 fetch origin`
  and then `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0163 merge origin/main`.
  Keep both sides of any conflict. Run `pnpm ci:check` with `REQUIRE_DATABASE=1`.
- [ ] T037 Run `/grounding-wiki:wiki-update`. Review every note the planner lists as
  NEEDS-REVIEW against the diff. Expected: `dm-runtime` and `seed-npc-presence` (the
  at-least-one rule, `listSeeds`, the duo seed; add `apps/server/seeds/greyhollow-ford-duo.json`
  to their sources), `debug-view` and `server-entrypoint-and-app` (`routes/dm.ts`: `GET /dm/seeds`,
  the duplicate-seat refusal), `react-router-app` (the redeem mode on the sign-in card),
  `client-identity` (the new `auth.ts` wrappers), `chat-ui` (the Settings invite section),
  `play-route` (the Start scene slide-out, the `startScene` command; add the two new files to its
  sources), `invitations` (now has a web caller; the operational note), and `hosted-dev` (the new
  runbook section). Note in `playtest-harness` that the harness seats one human (research R2).
- [ ] T038 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: the state line gains one
  sentence on the two-player kit (TASK-0163, specs/054), and every changed note's one-liner stays
  true. Re-pin every touched note to the commit verified. Run the freshness gate until it prints
  `OK`.
- [ ] T039 Update `docs/design/m3-table-sweep-runbook.md` "Execution log": in the TASK-0158 row,
  replace "(this PR)" with `[#78](https://github.com/evanstern/the-stacks/pull/78)` and fill its
  merge cell with `` `e20030d` ``; add an amendment row dated 2026-10-28 that quotes the ruling
  as recorded in `spec.md` ("Open questions"), marks the 300-character cut, and says all six
  defaults were accepted; add a TASK-0163 row with PR "(this PR)", merge "—", tokens
  "spec (opus ×2), impl ×6 (sonnet)", and a one-sentence note naming the duo seed, the redeem
  toggle, the invite section, the Start scene slide-out and the local live run.
- [ ] T040 Run `pnpm ci:check`, the freshness gate and the spec-bridge gate. Commit and push.

---

## Phase 8: Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go

**Goal**: the operator and one other developer play one scene on hosted dev with two accounts,
and the result is on TASK-0163.

**Runs only after**: the PR is merged, dev is deployed, and the operator has given the go on
each exact command below. No implementer runs this phase. No agent signs in on hosted dev or
enters a credential there.

**Independent test**: TASK-0163 carries a dated result note naming the deployed commit and the
session id.

- [ ] T041 [US4] From a tailnet machine, run
  `curl -s --max-time 60 https://vm-104.tailb3c1b6.ts.net:8443/health`. Expect `status` `ok` and
  `commit` equal to the TASK-0163 merge commit. Only when the commit is older, run
  `gh workflow run deploy-dev.yml`, then `gh run watch`, then repeat the `curl`.
- [ ] T042 [US4] On vm-104, as `stacks`, from the checkout, run `node scripts/deploy-dev.mjs status`.
- [ ] T043 [US4] On vm-104, as `stacks`, from the checkout, before play, run
  `node scripts/deploy-dev.mjs backup --name pre-task-0163-alpha`.
- [ ] T044 [US4] The operator and the other developer play in their own browsers, following the
  `Run a two-player table` section of `docs/ops/dev-vm-104.md`: issue an invitation, redeem it,
  both open one `/play/<uuid>` link, start `greyhollow-ford-duo` with one seat each, and play one
  scene with the provider-backed AI DM. No command runs in this step.
- [ ] T045 [US4] Record the result on TASK-0163 with the `backlog` CLI, from the operator's report:
  date, deployed commit, session id, seed, each account's role (never a password or token),
  outcome, the cost from the debug page's cost slide-out, and each bug found. Card each bug, or
  name it as an open question for the operator. Tick card AC #4.

---

## Dependencies and order

- Phase 1 → Phase 2. Phase 3 needs only Phase 1's merge of `origin/main` (T001), so it may run
  beside Phase 2. Phase 4 needs Phase 1 (`GET /dm/seeds`). Phase 5 needs Phases 3 and 4 (it
  names their labels). Phase 6 needs Phases 1 to 5. Phase 7 needs Phase 6. Phase 8 needs the
  merged PR and the operator's go.
- Within Phase 2, T010 and T011 can run in parallel. Within Phase 3, T015 to T017 can run in
  parallel. Within Phase 4, T023 and T024 can run in parallel.
- Phase 6 is the only phase with browser work before merge. Phase 8 is the only phase on vm-104.

## Implementation strategy

- MVP: Phases 1 and 2 meet card AC #1 on their own.
- Phase 3 meets card AC #2. Phases 4 and 5 meet card AC #3. Phase 6 proves #2 and #3 live.
- Phase 7 lands the wiki and the sweep runbook in the same PR.
- Phase 8 meets card AC #4 after merge.
