---
id: TASK-0347
title: dm.react confirm items carry invented params keys
status: In Progress
assignee: []
created_date: '2026-11-15T03:19:00Z'
updated_date: '2026-11-15T05:47:00Z'
labels:
  - playtest
  - ws:dm
milestone: m-10
dependencies: []
priority: high
ordinal: 331000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted run 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 3): dm.narrate dm.react-v6 confirm items for a move body carried params keys the Intent schema does not know ("skill"; "ready", "caution"). Schema mismatch on attempt 1 twice (calls 2184, 2188); attempt 2 passed. Attempt-1 failures rose to 4.1% (2/49) against the R1 target of under 1%. TASK-0336 fixed target shapes, not params.

Spec: specs/116-react-confirm-params
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirm item whose params hold unknown keys is repaired or stripped in code before validation, or the prompt schema states the allowed params per kind
- [ ] #2 A test covers a move confirm item with an invented params key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0347, branch task-0347-react-params, cut from origin/main 3525683f. Spec number 116 claimed with a stub.

Spec 116 authored (24ef840d). Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5
Hosted attempt-1 reply text is unrecoverable (dm_model_calls stores none; log lines lost on the 2026-11-15 04:51 UTC restart). Replay fixtures are reconstructed from finding 3's exact keys.

Phase 1 (T001-T009) landed 455687fa; ci:check green (1879 passed). Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
<!-- SECTION:NOTES:END -->
