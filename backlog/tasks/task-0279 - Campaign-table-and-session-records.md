---
id: TASK-0279
title: 'Campaign, table and session records'
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
labels:
  - 'ws:codex'
  - replan-2026-11
  - ep-2
milestone: m-11
dependencies: []
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `campaigns`, `tables`, `sessions` tables. A session covers a seq range. `routes/tables.ts` reads the records. Absorbs TASK-0198.

Parent epic: TASK-0259.

Source: docs/design/replan-2026-11/board-rework-map.md (N-14).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 "Your campaigns" lists campaigns and their tables without scanning events.
- [ ] #2 Closing a session records its seq range.
- [ ] #3 Existing tables migrate into records.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
