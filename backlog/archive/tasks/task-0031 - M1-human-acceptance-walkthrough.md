---
id: TASK-0031
title: M1 human acceptance walkthrough
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-11-07 05:16'
labels:
  - acceptance
  - replan-2026-11
milestone: m-1
dependencies:
  - TASK-0028
  - TASK-0029
  - TASK-0030
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator requirement: before M1 closes, stand the app up and have the operator drive it, checking every M1 acceptance criterion by hand. AI sets up, prompts, and tears down; the human decides pass or fail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A script stands up a clean self-hosted stack from a fresh clone
- [ ] #2 AI prompts the operator through each M1 acceptance criterion one at a time and records pass, fail, or note
- [ ] #3 The run produces a committed checklist with results, operator name, date, and commit
- [ ] #4 Teardown leaves no orphaned containers, networks, or volumes, proven by env prune --check
- [ ] #5 A failed criterion blocks M1 close and becomes a board card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-stale) by replan-2026-11: M1 closed in practice; retrieval demo superseded by the table.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
