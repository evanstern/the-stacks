---
id: TASK-0150
title: 'NPC and information: Influence as an engine shape'
status: To Do
assignee: []
created_date: '2026-10-27 03:58'
labels:
  - dm
  - npc
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0104
  - TASK-0128
  - TASK-0127
  - TASK-0149
priority: medium
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: social requests resolve per the SRD 5.2.1 Influence action.

Why: decision-0026 (D18, TASK-0119 research branch 2; analysis docs/research/NPCs-Social-and-Information/Analysis-NPC-and-Information-Contracts.md, card K4). Under decision-0025 (formulation 3) information and attitude are plot and move only through recorded facts. Operator rulings 2026-10-26: placement 'K3 now, K1-K6 after demo' (m-3, ordered after the Track C demo subset); attitude 'Per character'; clue lint 'Warn; fail only core'; 'SRD Influence DC'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interpret reads willing, unwilling or hesitant, with a cited seed field for willing
- [ ] #2 code refuses willing for a Hostile NPC
- [ ] #3 hesitant rolls against a code-derived DC of 15 or the NPC's Intelligence score, whichever is higher, with Advantage or Disadvantage from attitude
- [ ] #4 a failed check records a lockout, and the same request to the same NPC is refused for the rest of the scene
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
