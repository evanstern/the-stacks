---
id: TASK-0324
title: 'Revisit: stream talk replies (dm.react)'
status: To Do
assignee: []
created_date: '2026-11-13T00:01:00Z'
updated_date: '2026-11-14T02:15:00Z'
labels:
  - ws:narration
  - revisit
milestone: m-11
dependencies:
  - TASK-0298
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 108 OQ-3. TASK-0298 streams turn narration only; dm.react talk replies (quiet ring confirm/answer) arrive whole. Trigger: the CP-7 playtest shows talk replies over 10 s to first visible text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dm.react prose streams through the narration-stream frame under the same per-sentence check.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Trigger met in the 2026-11-13 test drive (session 0106e608): a talk reply landed 18.5 s after the post (10 s ring plus an 8.4 s dm.react call, no streaming).
<!-- SECTION:NOTES:END -->
