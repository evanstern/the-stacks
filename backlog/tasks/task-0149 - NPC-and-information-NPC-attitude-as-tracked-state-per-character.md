---
id: TASK-0149
title: 'NPC and information: NPC attitude as tracked state (per character)'
status: To Do
assignee: []
created_date: '2026-10-27 03:58'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - npc
  - rules-gate
  - 'ws:memory'
milestone: m-11
dependencies:
  - TASK-0140
  - TASK-0142
priority: medium
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: each seed NPC tracks an attitude toward each PC in the actor snapshot, changing only through recorded facts.

Why: decision-0026 (D18, TASK-0119 research branch 2; analysis docs/research/NPCs-Social-and-Information/Analysis-NPC-and-Information-Contracts.md, card K2). Under decision-0025 (formulation 3) information and attitude are plot and move only through recorded facts. Operator rulings 2026-10-26: placement 'K3 now, K1-K6 after demo' (m-3, ordered after the Track C demo subset); attitude 'Per character'; clue lint 'Warn; fail only core'; 'SRD Influence DC'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the seed takes one starting attitude per NPC, applied to every PC, default Indifferent
- [ ] #2 an `npc.attitude` fact names the NPC and the PC, moves that pair at most one step, and cites a check by that PC against that NPC or a recorded harmful act by that PC
- [ ] #3 a recorded harmful act by a PC sets Hostile toward that PC
- [ ] #4 the snapshot and the audit render attitude per PC
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
