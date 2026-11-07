---
id: TASK-0258
title: EP-1 R1 Fast Table
status: To Do
assignee: []
created_date: '2026-11-07 05:07'
updated_date: '2026-11-07 05:19'
labels:
  - replan-2026-11
  - epic
milestone: m-10
dependencies:
  - TASK-0258
  - TASK-0258
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Epic for milestone R1 Fast Table. No PR of its own.

Demo: One human plus three AI companions fight four goblins in the Greyhollow reed camp, in text with zone chips. Every attack, save and move resolves in code. Fact rows appear in under 1 s. Narration streams after and never blocks the next turn.

Exit criteria: p95 Intent-to-fact-rows under 1 s hosted; p50 first narration token under 10 s; full 4v4 round under 60 s; zero audit-regenerate fallbacks; attempt-1 schema failures under 1%; encounter can end, resume and drop a fled combatant; R1 playtest passes the auditor (N-13).

Children: N-01..N-13 (TASK-0266..0278), 0037, 0098, 0101, 0130, 0138, 0186, 0199, 0215, 0222, 0223, 0224, 0231, 0245, 0247.

Source: docs/design/replan-2026-11/plan-of-action.md §5 and board-rework-map.md §2.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
