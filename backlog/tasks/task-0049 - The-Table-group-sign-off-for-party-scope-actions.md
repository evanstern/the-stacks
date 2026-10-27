---
id: TASK-0049
title: 'The Table: group sign-off for party-scope actions'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 05:25'
labels:
  - multiplayer
  - gate
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a party-scope action (for example "we take the left tunnel" or "we long rest") commits only after the party signs off, in any table mode. Each player approves or objects. The DM may commit or override at any time.

Why: decision-0016 commit-authority table, party-scope row. In M2 a single human makes every party call; with several humans the gate needs a sign-off policy. It reuses the proposal gate (decision-0015); it is a policy, not a new mechanism.

Spec: specs/044-group-signoff
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The gate classifies an action as party-scope or character-scope, and the classification is recorded on the event.
- [ ] #2 A party-scope action commits only after every present player approves.
- [ ] #3 Any player objects to a party-scope action, and the objection is visible to the table.
- [ ] #4 The DM (human or AI) commits or overrides a party-scope action at any time.
- [ ] #5 The play route shows sign-off state per player and an approve or object control.
- [ ] #6 Gate tests cover approval, objection and DM override with several players.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0049, branch task-0049-group-signoff, cut from origin/main adb4527. Spec number 044 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
