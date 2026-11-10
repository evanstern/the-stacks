---
id: TASK-0259
title: EP-2 R2 Living Codex
status: To Do
assignee: []
created_date: '2026-11-07 05:07'
updated_date: '2026-11-10 03:11'
labels:
  - replan-2026-11
  - epic
milestone: m-11
dependencies:
  - TASK-0259
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Epic for milestone R2 Living Codex. No PR of its own.

Demo: The Greyhollow scene runs from codex entities. Seed JSON files and loader are deleted. Two sessions of one campaign run back to back; an NPC told a secret in session 1 acts on it in session 2.

Exit criteria: apps/server/seeds and dm/seed/load.ts gone; campaign/table/session rows exist; gate load flat across 5000 events; reveals are events; two-session solo run passes the auditor with the knowledge check.

Children: N-14, N-15 (TASK-0279, 0280), 0056, 0057, 0058, 0060, 0148, 0149, 0152, 0172, 0173.

Source: docs/design/replan-2026-11/plan-of-action.md §5 and board-rework-map.md §2.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 100 OQ-5 — object stats (doors, posts) for feature zones belong to the codex.
<!-- SECTION:NOTES:END -->
