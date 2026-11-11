---
id: TASK-0309
title: A clarify question can be an either-or, which the slot rules forbid
status: To Do
assignee: []
created_date: '2026-11-11T02:16:00Z'
labels:
  - playtest
  - ws:narration
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-10-r1-lane-playtest.md
priority: low
ordinal: 293000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found verifying TASK-0307 on vm-104 (2026-11-10, session 86abad65 seq 203). A clarify reply shipped the question 'Wenna's still shut up at the ferry-house across the reeds — do you head back there to ask her, or call out from here?' as the code-settled ask (sheet.ask). Contract §5.1 forbids an either-or for a model-written ask (EITHER_OR_END), but parseSlots copies sheet.ask verbatim, so the interpret clarify question bypasses that rule. The question comes from the interpret node's clarify field.

Low priority: the reply is otherwise correct (no labels, State line 'Nothing has happened yet …').
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clarify question is one open question, never an either-or, enforced where the clarify text is produced, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
