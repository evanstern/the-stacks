---
id: TASK-0345
title: Failed commit, intent and ruling turns tell the player nothing
status: To Do
assignee: []
created_date: '2026-11-14T07:15:00Z'
labels:
  - bug
  - ws:narration
milestone: m-10
dependencies: []
priority: medium
ordinal: 329000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while specifying TASK-0336 (spec 114 OQ-1). Spec 114 makes a failed talk (dm.react) turn append a public ai:dm out-of-character notice. A failed commit, intent or ruling turn still writes only the DM-only failure notice, so the player sees silence. Scope: the same public notice for those triggers, without duplicating a notice the talk path already wrote.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failed commit, intent or ruling turn appends one public notice telling the player the DM could not answer, with a test per trigger
- [ ] #2 No turn writes two public failure notices for one failure
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
