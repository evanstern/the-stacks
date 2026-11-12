---
id: TASK-0318
title: Speaker listbox returns focus to the Speaker button
status: To Do
assignee: []
created_date: '2026-11-12T06:34:00Z'
labels:
  - web
  - ws:table-ux
  - a11y
milestone: m-10
dependencies:
  - TASK-0315
ordinal: 302000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the TASK-0315 live check (PR #171, specs/105-one-composer-web/evidence/live-check.md). After the keyboard picks an option in the composer's Speaker listbox, focus drops to body instead of returning to the Speaker button. Keyboard users lose their place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After a keyboard pick in the Speaker listbox, focus returns to the Speaker button, with a test.
- [ ] #2 The Mention listbox is checked for the same behavior, and fixed if it has it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
