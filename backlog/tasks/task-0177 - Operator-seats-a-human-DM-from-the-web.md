---
id: TASK-0177
title: Operator seats a human DM from the web
status: Done
assignee: []
created_date: '2026-10-29 03:01'
updated_date: '2026-10-29 06:12'
labels:
  - play-route
  - multiplayer
milestone: m-3
dependencies: []
priority: high
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: on hosted dev the operator can seat a human DM (themself or another account) and return the seat to the AI DM from the web app, with no modal, before or during a scene.

Why: the TASK-0176 spec author (spec 061, 8f8a6808, finding F-1) found that nothing on hosted dev sends `dm.seat`: `git grep "dm.seat" apps/web` is empty, `docs/ops/dev-vm-104.md` has no step for it, and only the local evidence script `specs/055-human-dm-scene-change/evidence/start-human-dm.mjs` sends it. The TASK-0053 demo second run (policy ask, a human DM beside three players) needs it. Operator ruling 2026-10-28 in chat, answering "Should I card F-1, seating a human DM from the web, in m-3 before the demo?": "Card it in m-3".

Spec: specs/062-human-dm-seat
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The play route offers the operator a control that seats a human DM from a gate request, with no modal, and a test
- [x] #2 The same control returns the DM seat to the AI DM, with a test
- [x] #3 docs/ops/dev-vm-104.md documents seating a human DM for an assisted table
- [x] #4 Spec phase: Frame, command and seat view (card AC #1, #2; OQ-2, OQ-3)
- [x] #5 Spec phase: The panel, the header and the Start scene check (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-6)
- [x] #6 Spec phase: The newly seated DM's resync (card AC #1; OQ-5)
- [ ] #7 Spec phase: The hosted-dev runbook (card AC #3)
- [ ] #8 Spec phase: Mutation guard, DB suites and live check **[orchestrator]**
- [ ] #9 Spec phase: Wiki re-ground
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, in the M3 sweep chat, verbatim: "Before we start on another slice of M-3 I'd like to pause -- after the next PR merges." Read as: the sweep finishes TASK-0176 through its PR merge, then stops; TASK-0177 does not start until the operator resumes.

Claimed 2026-10-29 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0177, branch task-0177-human-dm-seat, cut from origin/main 7e9ef92f. Spec number 062 claimed with a stub. Resumed by the operator on 2026-10-29 ("resume the sweep").

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec set db5fb8c4 (spec 062): six phases, OQ-1 to OQ-6 with (a) defaults, DC-1 and DC-2 candidates. No frozen contract changes under the (a) defaults. Waiting on the operator's ruling.

Operator ruled 2026-10-29 in the M3 sweep chat, verbatim: "TASK-0177: I accept the recommended defaults OQ-1 to OQ-6 (a), including the additive 030 amendments. Card DC-1 (server settles pending ai:dm proposals when the seat returns) in m-3; card DC-2 as a revisit." Carded TASK-0178 (DC-1, m-3) and TASK-0179 (DC-2, revisit).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 1 a2eff04c: dmSeatFrame, seatDm, dm-seat.ts with tests; web gates green. ci:check failed only on the server adjudicate DB test (no stack in the worktree); the orchestrator runs the DB suites in Phase 5.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 2 6b361c01: DmSeatPanel slide-out, operator DM seat header button, Start scene DM-holds-a-seat check, additive 030 blocks. Web gates green.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5

Phase 3 59c8ef21: shouldResync, useSession resync(), wired in use-live-table; additive 030 live-frames line. Phase 4 59b840c3: docs/ops/dev-vm-104.md "Seat a human DM" section.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Live check 082ed701 (Brave, script mode): steps 2-6 and 8-14 and both refusals pass, no modal in 17 shots. Step 7 defect: Start scene disables Start with the DM on a character seat but never shows "The DM cannot hold a character seat." (client issue not rendered). Fix dispatched as T019a.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

T019a 80e8adf1: Start scene renders the client DM-seat issue (test failed 16/1 before, 17/17 after). Live check run 2 596b21e9: every step passes, step 7 shows the issue inline, 0 dialogs.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 6 2a8b3d62: play-route, scene-panels, client-session-hook, hosted-dev NEEDS-REVIEW, amended and re-pinned; CAPSULES and INDEX updated; runbook log row. After merging origin/main (8c4fb476): REQUIRE_DATABASE=1 pnpm ci:check exit 0 (server 1350 passed, web 139), freshness OK 55 notes, spec-bridge check 0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Frame, command and seat view (card AC #1, #2; OQ-2, OQ-3): 7/7 · The panel, the header and the Start scene check (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-6): 11/11 · The newly seated DM's resync (card AC #1; OQ-5): 5/5 · The hosted-dev runbook (card AC #3): 2/2 · Mutation guard, DB suites and live check **[orchestrator]**: 3/3 · Wiki re-ground: 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
