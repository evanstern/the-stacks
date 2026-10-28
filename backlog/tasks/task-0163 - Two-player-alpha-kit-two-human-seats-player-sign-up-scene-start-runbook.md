---
id: TASK-0163
title: 'Two-player alpha kit: two human seats, player sign-up, scene-start runbook'
status: In Progress
assignee: []
created_date: '2026-10-28 04:12'
updated_date: '2026-10-28 05:39'
labels:
  - multiplayer
  - dev-tooling
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator and one other developer can play one scene together on hosted dev as a bug-tolerant alpha, with an AI DM.

Evidence (2026-10-28 survey of main at 1de4e6e):
- apps/server/seeds/greyhollow-ford.json has one human seat (tamsin); odo and kestrel are companions. POST /dm/sessions/:sessionId/start requires a user id per human seat, so a second human cannot be seated.
- The server issues and redeems invitations (POST /invitations, POST /invitations/redeem), but apps/web/app/routes.ts has no redeem page. The only path to a second account is create-operator.js with OPERATOR_USERNAME, which makes an operator.
- Scene start is an operator API call with a seed id and a seat map. No UI or runbook covers it.

Why: group sign-off, floor passing and presence (TASK-0049, TASK-0050, TASK-0051) are merged, but no table can seat two humans. This kit also serves TASK-0053, which needs several humans at one table.

Spec: specs/054-two-player-alpha-kit
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shipped seed seats at least two humans, loads through loadSeed, and has a test
- [ ] #2 A second person can get a player account through the web app from an operator-issued invitation, with no modal, and a test
- [ ] #3 docs/ops/dev-vm-104.md documents issuing an invitation, creating a session, and starting a scene with a seat per human on hosted dev
- [ ] #4 The runbook is run once on hosted dev with two accounts, and the result is recorded on this card
- [x] #5 Spec phase: Duo seed, seat rules and the seeds route (card AC #1)
- [x] #6 Spec phase: Two-human behaviour check and mutation guard (card AC #1)
- [x] #7 Spec phase: Redeem toggle and the invite section (card AC #2)
- [ ] #8 Spec phase: Start scene slide-out (card AC #3)
- [ ] #9 Spec phase: Runbook section and the DM API contract (card AC #3)
- [ ] #10 Spec phase: Local live run on this worktree's stack (card AC #2, #3)
- [ ] #11 Spec phase: Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3)
- [ ] #12 Spec phase: Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, in the M3 sweep chat, verbatim: "Add TASK-0163 to the M3 sweep runbook, right after TASK-0158 and before TASK-0159, TASK-0154 and the TASK-0053 demo." (Relayed first from the design-fork session: "I'd ratehr you hand the task off to the m3 sweep, frankly, but you use your judgement at this point since it's been a while".) AC #4's live run on vm-104 needs the operator's go on the exact command; the merge-on-green grant does not cover it. Runbook rows land on the TASK-0158 branch (Phase 5).

Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0163, branch task-0163-two-player-alpha-kit, cut from origin/main cc5e39b. Spec number 054 claimed with a stub. Spec 053 is held by TASK-0158 (PR #78), so this takes 054. Operator placed it after TASK-0158 (note cc5e39b).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (spec.md, 2caeccc) stopped with open questions Q1-Q6. Blocker found: crossCheckSeed refuses any seed whose human count is not exactly one; redeem already makes a signed-in player but the web app has no surface; no runbook section for scene start.

Operator ruling, 2026-10-28, verbatim (the reply button cut it at 300 characters): "TASK-0163: I accept the recommended defaults Q1 to Q6, including the greyhollow-ford-duo seed, the at-least-one-human seed rule, the inline redeem toggle on the sign-in card, the Settings invite section, the Start scene slide-out with the new GET /dm/seeds route, and the two of us playing AC #4 on d". Read as: Q1-Q6 defaults accepted; Q6 = the operator and the other developer play AC #4 on hosted dev with the real AI DM. The spend ceiling for that run and the go on each vm-104 command are still to come from the operator.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (merge e8befda, 143044b): greyhollow-ford-duo seed, at-least-one-human loader rule, listSeeds, GET /dm/seeds, one-user-one-seat refusal. T009: the implementer's TEST_DATABASE_URL export was denied by the auto-mode classifier; the orchestrator migrated the test DB and ran REQUIRE_DATABASE=1 pnpm ci:check on 143044b: exit 0, server 1250 passed, routes.integration 15/15 (the two new DB cases ran green; they were not run red first). From here the orchestrator runs every DB suite.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (a20de88, 68ff701): duo views 7/7 (no DB); loader mutation (a) caught. Orchestrator-run on 68ff701: duo.integration 4/4 passed (scene start, sign-off waits on B, absent B lets A commit, floor passes absent B to odo); mutation (b) duplicate-seat filter off -> 'refuses one user in two seats and accepts two users' fails, restored, diff empty, 15/15; REQUIRE_DATABASE=1 pnpm ci:check exit 0, server 1261 passed. Observation (not carded yet): the seat snapshot view has no own-character marker.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (aa9c370 bookkeeping, 49391e5 code): inline 'Have an invitation?' redeem on the sign-in card; operator-only Invite a player section on Settings (token shown once, copy). Web tests red then green (97 vitest, 236 node incl. no-dialog). No DOM library, so clicks are covered in Phase 6's browser run. Orchestrator-run REQUIRE_DATABASE=1 pnpm ci:check on 49391e5: exit 0, server 1261, web 97. T022 to be ticked by the next phase.

spec-bridge sync: Duo seed, seat rules and the seeds route (card AC #1): 9/9 · Two-human behaviour check and mutation guard (card AC #1): 5/5 · Redeem toggle and the invite section (card AC #2): 7/8 · Start scene slide-out (card AC #3): 0/6 · Runbook section and the DM API contract (card AC #3): 0/3 · Local live run on this worktree's stack (card AC #2, #3): 0/4 · Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3): 0/5 · Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go: 0/5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 (431a9af, e4d1fe0): operator Start scene slide-out on the table page (seed select, one present human per human seat, inline refusals, closes on 202). Web tests red then green (107 vitest, 245 node). Orchestrator-run REQUIRE_DATABASE=1 pnpm ci:check on e4d1fe0: exit 0, server 1261, web 107. T028 to be ticked by the next phase.

spec-bridge sync: Duo seed, seat rules and the seeds route (card AC #1): 9/9 · Two-human behaviour check and mutation guard (card AC #1): 5/5 · Redeem toggle and the invite section (card AC #2): 8/8 · Start scene slide-out (card AC #3): 5/6 · Runbook section and the DM API contract (card AC #3): 0/3 · Local live run on this worktree's stack (card AC #2, #3): 0/4 · Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3): 0/5 · Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go: 0/5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
