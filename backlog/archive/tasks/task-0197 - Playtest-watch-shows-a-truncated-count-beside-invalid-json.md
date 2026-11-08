---
id: TASK-0197
title: Playtest watch shows a truncated= count beside invalid-json=
status: To Do
assignee: []
created_date: '2026-11-02 06:33'
updated_date: '2026-11-07 05:18'
labels:
  - playtest
  - replan-2026-11
milestone: m-3
dependencies:
  - TASK-0192
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the playtest-run watch output counts truncated model calls separately from invalid-json.

Why: spec 067 (TASK-0192) adds the truncated outcome. Until the watch script knows it, a truncated call shows only in the not-ok count. Raised as OQ-3 by the spec 067 author, 2026-11-02.

Where: .claude/skills/playtest-run/ watch script.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The watch output prints truncated=<n> beside invalid-json=<n>
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0273 by replan-2026-11. Truncation observability.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
