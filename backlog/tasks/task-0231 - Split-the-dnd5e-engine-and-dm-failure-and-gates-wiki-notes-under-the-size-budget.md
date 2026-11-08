---
id: TASK-0231
title: >-
  Split the dnd5e-engine and dm-failure-and-gates wiki notes under the size
  budget
status: Done
assignee: []
created_date: '2026-11-03 08:28'
updated_date: '2026-11-08 20:21'
labels:
  - wiki
  - docs
  - 'ws:tooling'
milestone: m-10
dependencies: []
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) pushed both notes past the 8000-character budget (8582 and 8430); each took a size_budget_exempt line. Split each into two notes by concept so neither needs the exemption, and remove the exemption lines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dnd5e-engine and dm-failure-and-gates each fit the 8000-character budget with no size_budget_exempt line, and the freshness gate passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0231, branch task-0231-wiki-split, cut from origin/main a8bda4ab. No spec dir: signed escape line covers this task.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5
Commit e71ba783: dnd5e-engine split into +derived-rolls, +reactions; dm-failure-and-gates split into +dm-plan-gate. Verbatim moves, pins kept. Orchestrator re-ran gates: freshness OK 60 notes, exit 0; plan prints nothing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split dnd5e-engine (into +derived-rolls, +reactions) and dm-failure-and-gates (into +dm-plan-gate) by concept, verbatim, pins kept; both exemption lines dropped. Merged in PR #145 (f0d0b491). Freshness OK 60 notes.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
