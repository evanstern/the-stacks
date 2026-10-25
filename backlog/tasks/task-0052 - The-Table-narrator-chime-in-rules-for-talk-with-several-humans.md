---
id: TASK-0052
title: 'The Table: narrator chime-in rules for talk with several humans'
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
labels:
  - multiplayer
  - dm
  - ai
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the narrator chimes into table talk at a sensible rate and on clear triggers when several humans talk. Talk still never changes state and never triggers a DM turn.

Why: decision-0016 lets the narrator answer talk (for example when mentioned). With one player that is rare; with several, an eager narrator floods the table and a silent one feels absent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The narrator replies to talk only on stated triggers, including a direct mention.
- [ ] #2 A configurable rate limit bounds narrator talk per minute.
- [ ] #3 Narrator talk never rolls dice and never proposes a state change; a test enforces this.
- [ ] #4 Each chime-in names its trigger in the event, so the playtest auditor can check it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
