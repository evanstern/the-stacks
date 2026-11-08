---
id: TASK-0089
title: 'Solo Campaign: assisted fallback when the AI is out of its depth'
status: To Do
assignee: []
created_date: '2026-10-25 20:19'
updated_date: '2026-11-07 05:17'
labels:
  - solo
  - dial
  - 'ws:dm-console'
milestone: m-16
dependencies: []
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when the AI DM flags low confidence on a ruling or a scene, the table can switch the dial toward ask, and back.

Why: the vision keeps the assisted table as the fallback when the automaton is out of its depth. In solo play the operator may act as their own DM for a moment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adjudicate and audit emit a DM-only low-confidence event with a reason.
- [ ] #2 The player switches the session's dial preset during play, recorded as an event.
- [ ] #3 A playtest shows a flagged ruling resolved under ask and play resuming under auto.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
