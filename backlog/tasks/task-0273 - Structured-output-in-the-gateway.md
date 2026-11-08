---
id: TASK-0273
title: Structured output in the gateway
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-08 20:10'
labels:
  - 'ws:narration'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a structured-output mode (tool call or JSON schema) per purpose in `apps/server/src/ai`. Log truncation separately from invalid JSON. Absorbs TASK-0203, 0256, 0197.

Prerequisite checkpoints: CP-1 (plan-of-action §7).

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-08).

Spec: specs/093-structured-output
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each DM purpose declares its output schema in config.
- [ ] #2 Attempt-1 schema failures are under 1% over the R1 playtest.
- [ ] #3 The playtest watch shows a `truncated=` count.
- [ ] #4 The vm-104 log shapes from TASK-0203 are regression fixtures.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0197 (Playtest watch shows a truncated= count beside invalid-json=) by replan-2026-11: Truncation observability.

Merged from TASK-0203 (Haiku dm.audit and dm.chronicle return invalid-json on the first attempt) by replan-2026-11: Structured output; keep log shapes as fixtures.

Merged from TASK-0256 (dm.interpret hits its output cap and truncates on attempt 1) by replan-2026-11: Interpret truncation.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0273, branch task-0273-structured-output, cut from origin/main a8bda4ab. Spec number 093 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
