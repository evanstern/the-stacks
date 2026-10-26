---
id: TASK-0047
title: 'First Scene: play route — composer, commit control, ledger, DM approvals'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 03:33'
labels:
  - first-scene
  - ui
milestone: m-2
dependencies:
  - TASK-0045
references:
  - docs/design/architecture.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the play route a player and a DM use at the table. One composer sends talk or declares an action. A declared action shows comments and a commit control. The route shows the table mode, the roll ledger and, for the DM, pending proposals to approve.

Why: decision-0016 (talk versus action, table modes) and decision-0015 (DM approval surface for ask) need a human surface. This is the in-app table view's first slice (decision-0013); maps arrive in M6.

No modals: slide-out panels or autocomplete dropdowns only. Work can start against fixtures before TASK-0045 merges.

Spec: specs/030-play-route
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One composer sends talk or declares an action, and the player chooses which.
- [ ] #2 A declared action shows its comments and a commit control for whoever holds commit authority.
- [ ] #3 The route shows the current table mode, and in turn mode it shows the active player.
- [ ] #4 A ledger panel lists every roll with its reason and every state change with before and after values.
- [ ] #5 A DM approval panel lists pending proposals, and the DM approves or rejects each one.
- [ ] #6 The route uses slide-out panels and autocomplete dropdowns only, never modals.
- [ ] #7 The route renders from fixtures and from the live log through the same components.
- [ ] #8 The route is client-only, per decision-0008.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 3) after TASK-0044 merged (#46). Worktree .worktrees/task-0047, branch task-0047-play-route, cut from origin/main 8a8bb81. Spec number 030 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
