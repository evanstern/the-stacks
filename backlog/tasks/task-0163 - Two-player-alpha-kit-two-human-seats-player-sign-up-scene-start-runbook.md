---
id: TASK-0163
title: 'Two-player alpha kit: two human seats, player sign-up, scene-start runbook'
status: Done
assignee: []
created_date: '2026-10-28 04:12'
updated_date: '2026-11-02 04:57'
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
- [x] #1 A shipped seed seats at least two humans, loads through loadSeed, and has a test
- [x] #2 A second person can get a player account through the web app from an operator-issued invitation, with no modal, and a test
- [x] #3 docs/ops/dev-vm-104.md documents issuing an invitation, creating a session, and starting a scene with a seat per human on hosted dev
- [x] #4 The runbook is run once on hosted dev with two accounts, and the result is recorded on this card
- [x] #5 Spec phase: Duo seed, seat rules and the seeds route (card AC #1)
- [x] #6 Spec phase: Two-human behaviour check and mutation guard (card AC #1)
- [x] #7 Spec phase: Redeem toggle and the invite section (card AC #2)
- [x] #8 Spec phase: Start scene slide-out (card AC #3)
- [x] #9 Spec phase: Runbook section and the DM API contract (card AC #3)
- [x] #10 Spec phase: Local live run on this worktree's stack (card AC #2, #3)
- [x] #11 Spec phase: Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3)
- [x] #12 Spec phase: Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go
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

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 5 (92c22de): docs/ops/dev-vm-104.md 'Run a two-player table' (19 steps, labels quoted from the shipped code); spec 031 dm-api.md additive GET /dm/seeds and seat rule 3 with the 2026-10-28 ruling note. T031: docs-only since e4d1fe0, whose DB ci:check passed; the next phase ticks T031 on that basis.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 6 (8767b51): local live run on stacks-task-0163 in script mode, two Brave contexts. Invite on Settings, redeem from the sign-in card, both at one table, Start scene seats operator as Tamsin and Player Two as Kestrel; opening narration reached both. Refusals: player GET /dm/seeds 403; one user two seats 400 seats.kestrel; second start 409; used token refused. 20 shots, no modal. Docs corrected (seed label carries the id; issue message is issues[0]). Orchestrator-run REQUIRE_DATABASE=1 pnpm ci:check on 8767b51: exit 0, server 1261, web 107 (T035). A leftover local test account player2 exists on this stack only. Observation: the table shows no chip for AI companions.

spec-bridge sync: Duo seed, seat rules and the seeds route (card AC #1): 9/9 · Two-human behaviour check and mutation guard (card AC #1): 5/5 · Redeem toggle and the invite section (card AC #2): 8/8 · Start scene slide-out (card AC #3): 6/6 · Runbook section and the DM API contract (card AC #3): 3/3 · Local live run on this worktree's stack (card AC #2, #3): 3/4 · Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3): 0/5 · Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go: 0/5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 7: merge 13f64ae (clean), wiki a8457a9 (10 notes re-pinned, CAPSULES regenerated), runbook 853ce1d, ticks 1e00c55. Freshness OK (54), spec-bridge ok. Orchestrator-run REQUIRE_DATABASE=1 pnpm ci:check on 1e00c55: exit 0, server 1261, web 107.

spec-bridge sync: Duo seed, seat rules and the seeds route (card AC #1): 9/9 · Two-human behaviour check and mutation guard (card AC #1): 5/5 · Redeem toggle and the invite section (card AC #2): 8/8 · Start scene slide-out (card AC #3): 6/6 · Runbook section and the DM API contract (card AC #3): 3/3 · Local live run on this worktree's stack (card AC #2, #3): 4/4 · Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3): 5/5 · Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go: 0/5

Merged as #79 at 6d6982e under the operator's merge-on-green grant (TASK-0117). Worktree, branch and stack removed; env:prune clean. The card stays In Progress: AC #4 and spec Phase 8 (T041-T045, hosted-dev alpha run) wait on the operator's spend ceiling and go on each vm-104 command.

Operator, 2026-10-28, in the M3 sweep chat, verbatim: "Spending Ceiling: Since we're essentially using my subscription to Claude through 9router, dollar-wise it's fuzzy. I'm pretty happy with doing as high as you'd like -- maybe cap it at $50 and if that causes any issues we can scale down. I'm not actually being charged $50 so it's okay." Read as: a $50 ceiling for the hosted-dev alpha run (AC #4), by the debug page's cost slide-out.
Operator, 2026-10-28, verbatim: "You have a go on those commands" — the four Phase 8 commands T041-T043: curl /health; gh workflow run deploy-dev.yml + gh run watch only if stale; node scripts/deploy-dev.mjs status; node scripts/deploy-dev.mjs backup --name pre-task-0163-alpha.

Phase 8 preflight, 2026-10-28, under the operator's go: T041 /health status ok, database reachable, commit da31a11f (contains #79's 6d6982e), so no manual deploy ran. The push of board commits then auto-deployed 9be9de4f (board-only on top of da31a11f). T042 deploy-dev.mjs status: running commit 9be9de4f, /health ok, exit 0. T043 backup: /home/stacks/dev/backups/manual-pre-task-0163-alpha.dump, exit 0. T044 waits on the operator and the other developer playing. The spec ticks for T041-T045 land with the next task branch.

Operator, 2026-10-29, verbatim: "TASK-0163 AC #4: you have my go on the three preflight commands: the /health curl, `node scripts/deploy-dev.mjs status`, and `node scripts/deploy-dev.mjs backup --name pre-task-0163-alpha-2`, each over ssh from the runner checkout."

Preflight 2026-10-29 under that go: /health status ok, database reachable, commit af74f7cb (contains #89 a998fe7c, TASK-0177). deploy-dev.mjs status: running af74f7cb, exit 0. Backup /home/stacks/dev/backups/manual-pre-task-0163-alpha-2.dump, exit 0. T044 waits on the operator and the other developer playing.

AC #4 run 2 (2026-10-29, about 00:23-01:00 UTC, hosted dev at af74f7cb, session 166b8e59), from the merged log docs/playtests/2026-10-28-two-browser-alpha.md (PR #90, 6b07e16c). Result: ended early on a showstopper; AC #4 not met. Checklist: A passed (invite, redeem, Start scene, both windows; the scene opened in 10 s). F spot-checked. D seen in passing (Odo answered after each beat). G tried (Retry ran four times, none succeeded). B, C and E not reached. Blocker: TASK-0181, DM calls on hosted dev fail on a <think></think> prefix; one action failed four turns in a row and stalled the table. New cards: TASK-0180, TASK-0181, TASK-0182. Evidence added to TASK-0132. Operator ruling 2026-10-29: TASK-0181 goes ahead of AC #4 (fix, merge on green, confirm the vm-104 deploy, then stop for run 3); TASK-0053 stays after AC #4.

Alpha run 3, 2026-11-02 (session e8e8326d-0344-4fac-a4d4-3e4bcd82e2d5, hosted dev 84b130a0 then b481e308): the operator played both seats of greyhollow-ford-duo from two Brave accounts (operator and Billy Bob) on hosted dev with the real AI DM. Invite, sign-in, Start scene and both windows worked. Play ran through talk, a cut plan, stealth, an encounter, an absence pass (30 s), a stall commit (120 s), persuasion, flight, encounter end, and the scene goal (Pell freed). Spend $2.55 of the $50 ceiling. Deterministic auditor verdict pass (0 fail, 0 warn, 8 notes). One in-run blocker (interpret truncation, TASK-0181) was fixed by raising vm-104 dm.interpret maxTokens. New cards TASK-0187 to TASK-0194. Log: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (lands by PR). This meets AC #4: the runbook ran once on hosted dev with two accounts, and the result is recorded here. A second human was not used (the operator played both seats, as in runs 1 and 2).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Duo seed, seat rules and the seeds route (card AC #1): 9/9 · Two-human behaviour check and mutation guard (card AC #1): 5/5 · Redeem toggle and the invite section (card AC #2): 8/8 · Start scene slide-out (card AC #3): 6/6 · Runbook section and the DM API contract (card AC #3): 3/3 · Local live run on this worktree's stack (card AC #2, #3): 4/4 · Merge main, wiki re-ground and runbook rows (card AC #1, #2, #3): 5/5 · Hosted-dev alpha run (card AC #4) — orchestrator-run, after operator go: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
