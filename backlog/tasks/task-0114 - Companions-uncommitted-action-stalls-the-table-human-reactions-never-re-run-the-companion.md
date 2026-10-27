---
id: TASK-0114
title: >-
  Companion's uncommitted action stalls the table; human reactions never re-run
  the companion
status: In Progress
assignee: []
created_date: '2026-10-27 01:25'
updated_date: '2026-10-27 03:28'
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
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0114, branch task-0114-companion-react, cut from origin/main a4aab3c. Spec number 036 claimed with a stub. Track B1.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
