---
id: TASK-0194
title: >-
  A step that frees a captive NPC is refused as UNKNOWN_COMBATANT in an
  encounter
status: To Do
assignee: []
created_date: '2026-11-02 04:31'
labels:
  - dm
  - gate
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: during an encounter a PC can act on a non-combatant NPC (free a captive, hand them something, drag them clear); the plan gate does not refuse the whole action because the target is not in the initiative order.

Why: alpha run 3 (2026-11-02, seq 118-133). Tamsin: 'I run to Pell and attempt to free him.' Pell is a captive seed NPC, present but not a combatant. After interpret was fixed the action resolved refused, UNKNOWN_COMBATANT (plan gate: not-a-combatant). The narration still showed Tamsin reaching the post, so the fiction and the ledger disagree, and the player lost the turn for a reasonable move.

Where: dm/gates/plan-gate.ts checkPlan id check (docs/wiki/dm-failure-and-gates.md); which step kinds may target a present non-combatant actor.

Related: TASK-0141 (absent actors), TASK-0142 (seed aliases), TASK-0182.

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A plan step may name a present non-combatant NPC as its target for non-attack steps (check, presence, condition) without UNKNOWN_COMBATANT
- [ ] #2 An attack or damage step on a non-combatant is still refused
- [ ] #3 A test replays run 3 seq 118 and resolves the free-Pell action
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
