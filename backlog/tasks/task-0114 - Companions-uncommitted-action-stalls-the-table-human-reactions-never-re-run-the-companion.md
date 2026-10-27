---
id: TASK-0114
title: >-
  Companion's uncommitted action stalls the table; human reactions never re-run
  the companion
status: Done
assignee: []
created_date: '2026-10-27 01:25'
updated_date: '2026-10-27 09:19'
labels:
  - dm
  - companions
milestone: m-3
dependencies: []
priority: high
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a companion's declared-but-uncommitted action always reaches a resolution. A human's comment, approval or objection on it re-runs that companion, which can then commit, revise or withdraw the action, so the table never waits on a companion that will not act again.

Evidence: M2 demo (TASK-0048), session e8c848ec-11e9-442d-9bfa-8c26a0d84fcd, recurring. Odo declared act-odo-1 at seq 35 without committing; the human's comment and approval (seq 37-38) changed nothing, and the card showed 'Waiting for Brother Odo to commit' indefinitely. Companion jobs run only after a DM turn ('prompt') or when a hold ends (apps/server/src/dm/companion.ts, apps/server/src/dm/worker.ts:300). Workaround: the human commits their own action to start the next turn. Operator ruling 2026-10-26: keep playing with the workaround; card it in m-3. Preferred fix offered: a 'react' companion job enqueued on a human reaction to a companion's pending action.

Spec: specs/036-companion-react
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A human comment, approval or objection on a companion's pending declared action enqueues that companion, with an integration test
- [ ] #2 The re-run companion commits, revises or withdraws, and a test shows the table no longer waits indefinitely
- [ ] #3 The companions contract (specs/031-dm-runtime/contracts/companions.md) records the new trigger
- [ ] #4 Spec phase: Trigger and coalescing (US1, US3; AC #1) — DISPATCH (sonnet)
- [ ] #5 Spec phase: Resolution, the M2 repro and the contract (US2, US3, US4; AC #2, #3) — DISPATCH (sonnet)
- [ ] #6 Spec phase: Withdraw lifecycle (US2; AC #2) — DISPATCH (sonnet), ONLY AFTER CHECKPOINT W = W-A
- [ ] #7 Spec phase: Wiki (re-ground) — DISPATCH (sonnet)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0114, branch task-0114-companion-react, cut from origin/main a4aab3c. Spec number 036 claimed with a stub. Track B1.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 036, commit f81c2ab; ~185k tokens; served verified from transcript.)

OPERATOR RULING 2026-10-26 (checkpoint W, in chat): 'W-A: add withdraw'. New action.withdraw proposal kind and action.withdrawn event; revise = withdraw + new declaration; humans can use it too. Amends the frozen specs/029-proposal-gate contract in Phase 3. Orchestrator defaults on the spec's other open questions: only human reactions trigger a re-run (as the card says); the 3 s quiet window and 10 s max wait stay code constants; the outlives-a-fight risk stays a listed risk.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 1, T010-T014, commit 6688ab7; migration 0005_lean_cable (react queued index). TASK-0116 also generates a 0005 on its branch: whichever merges second regenerates after merging main.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 2, T020-T027; failing repro f99b4df (evidence/T021-failing-on-phase1-tip.txt), fix 2932c20; merge condition T021 met; prompt dm.companion-v3.)

PROMPT VERSION COLLISION (orchestrator, 2026-10-27): TASK-0140's spec also bumps dm.companion to v3; whichever merges second bumps to the next free version after merging main.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 3 withdraw (W-A), T030-T037, commit 530c418; action.withdraw kind + action.withdrawn event; 029/028/031 contracts amended citing the W ruling; dm.companion-v4.)
ORCHESTRATOR RULING 2026-10-27: the active companion in turn mode that withdraws its only open action must still end its turn (same stall class as this card: the table must never wait on a companion). Fixed in-task as Phase 3b, not deferred.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 3b T037b, commit 3d8f3a8: an active companion that withdraws still declares and commits its hold act, so the turn advances; Phase 4 wiki, commit e4d5108: 7 NEEDS-REVIEW + 2 RE-PIN-ONLY notes; ci:check green first run.) Brave screenshots of the Withdraw control not captured: agents cannot drive Brave (not a merge condition for this card).

Reconcile after TASK-0116 (PR #62) merged: react queued index regenerated as migration 0006_fearless_jamie_braddock (0005_lean_cable dropped; 0005 is main's unknown_lizard).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(reconcile after #62: merge 2b58684, fixes 9e3fd3f; migration regenerated as 0006_fearless_jamie_braddock; main's worker test gained pending: []; 7 notes re-pinned (2 NEEDS-REVIEW); ci:check exit 0, server 900 passed.)

Merged in PR #63 (773d4e4); stack down, worktree and branch removed. Board stays In Progress until specs/036-companion-react/tasks.md T038 is annotated not-applicable (it applied only under W-B; the operator ruled W-A). That annotation rides the next task branch (TASK-0140), then spec-bridge sync moves this card to Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Trigger and coalescing (US1, US3; AC #1) — DISPATCH (sonnet): 5/5 · Resolution, the M2 repro and the contract (US2, US3, US4; AC #2, #3) — DISPATCH (sonnet): 8/8 · Withdraw lifecycle (US2; AC #2) — DISPATCH (sonnet), ONLY AFTER CHECKPOINT W = W-A: 10/10 · Wiki (re-ground) — DISPATCH (sonnet): 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
