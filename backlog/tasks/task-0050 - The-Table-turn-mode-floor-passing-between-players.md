---
id: TASK-0050
title: 'The Table: turn-mode floor passing between players'
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
labels:
  - multiplayer
  - gate
  - ui
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in turn mode, the floor passes between human players in initiative order. Only the active player commits for their turn. Everyone else talks and suggests.

Why: decision-0016, turn-mode row. M2 has one human, so the floor only passes between that human and AI actors. Several humans need visible turn ownership and a clean handoff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In turn mode, only the active player commits an action for their character's turn.
- [ ] #2 Other players comment on the active player's declared action and suggest alternatives.
- [ ] #3 Ending a turn passes the floor to the next actor in initiative order, human or AI.
- [ ] #4 The play route shows whose turn it is to every viewer.
- [ ] #5 The DM passes or reclaims the floor at any time.
- [ ] #6 Tests cover a round with two humans and one AI companion.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
