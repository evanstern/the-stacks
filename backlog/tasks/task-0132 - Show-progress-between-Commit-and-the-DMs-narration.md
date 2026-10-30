---
id: TASK-0132
title: Show progress between Commit and the DM's narration
status: To Do
assignee: []
created_date: '2026-10-27 02:44'
updated_date: '2026-10-30 00:42'
labels:
  - web
  - dm
milestone: m-3
dependencies: []
references:
  - docs/design/m2-demo.md
  - docs/design/debug-view.md
priority: medium
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the table shows that the DM is working between a committed action and its narration.

Evidence: M2 demo record (docs/design/m2-demo.md, operator finding 2). Each turn took about 30-60 s with no indication, and the table looked stalled. Overlaps the debug view (TASK-0116, TASK-0117). Operator sign-off 2026-10-27: card in m-3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After a commit, every seat sees a visible in-progress state until the narration lands or the job fails
- [ ] #2 The indicator clears on narration, on job failure, and on reconnect
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two-browser alpha playtest 2026-10-28, run 2 item 2: a DM turn on hosted dev took 60 s or more with no indication, and the operator thought it was a fatal error. Repeat evidence beyond the M2 demo's 30-60 s.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
