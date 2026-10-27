---
id: TASK-0142
title: 'Actor-state gate: Seed NPCs carry minimal scene presence'
status: In Progress
assignee: []
created_date: '2026-10-27 03:53'
updated_date: '2026-10-27 18:44'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
priority: high
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every seed NPC is an actor in the snapshot with scene presence, so claims about it can be checked. Richer NPC records stay with the Codex (M4).

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U8). Dependencies as stated there: U1, U2.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A seed declares each NPC's initial scene presence per beat, with a schema test.
- [ ] #2 Seed NPCs appear in the snapshot with id, name, aliases, kind `NPC` and scene presence.
- [ ] #3 A seed NPC's scene presence changes only through U2's event, with a test over M2 seq 296-301 (Snag stays present without a roll).
- [ ] #4 A seed NPC that becomes a combatant keeps one identity across both.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0142, branch task-0142-seed-npc-presence, cut from origin/main 4fb8cbe. Spec number 050 claimed with a stub. Track C, first card after TASK-0050 (#74, 464b336).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
