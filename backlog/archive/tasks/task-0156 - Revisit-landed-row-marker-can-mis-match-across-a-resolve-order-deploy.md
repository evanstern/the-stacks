---
id: TASK-0156
title: 'Revisit: landed-row marker can mis-match across a resolve-order deploy'
status: To Do
assignee: []
created_date: '2026-10-27 09:28'
updated_date: '2026-11-07 05:17'
labels:
  - revisit
  - dm
  - replan-2026-11
dependencies: []
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: a turn job checkpointed under the old resolve order resumes on new code and matches a landed row to the wrong step, or the turn-jobs contract's accepted-risk note is challenged. Context: TASK-0110 (spec 045) reorders resolve groups (decision-0025 §4). The landed-row marker <jobId>#<n> counts submissions, so one in-flight job per session during a deploy could misalign. Accepted risk and recorded in turn-jobs.md. Options when triggered: also match the event type on landed-row lookup, or add an order version to the checkpoint and fail a mismatch loudly.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: TASK-0267 removes the resolve-order path.
<!-- SECTION:NOTES:END -->
