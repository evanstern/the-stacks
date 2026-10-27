---
id: TASK-0151
title: 'NPC and information: Conclusions and the clue economy in the seed'
status: To Do
assignee: []
created_date: '2026-10-27 03:59'
labels:
  - dm
  - npc
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0148
  - TASK-0127
priority: medium
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: seeds list conclusions and their clue paths, and a core conclusion cannot be lost to one failed roll.

Why: decision-0026 (D18, TASK-0119 research branch 2; analysis docs/research/NPCs-Social-and-Information/Analysis-NPC-and-Information-Contracts.md, card K5). Under decision-0025 (formulation 3) information and attitude are plot and move only through recorded facts. Operator rulings 2026-10-26: placement 'K3 now, K1-K6 after demo' (m-3, ordered after the Track C demo subset); attitude 'Per character'; clue lint 'Warn; fail only core'; 'SRD Influence DC'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the seed schema takes conclusions, each with clue ids and a core flag
- [ ] #2 a test over shipped seeds warns below three paths, and the loader refuses a core conclusion with none
- [ ] #3 a failed check on a core conclusion's clue resolves as success at a cost
- [ ] #4 a reveal fact names only seed clue ids
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
