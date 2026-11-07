---
id: TASK-0148
title: 'NPC and information: Seed information ids and the reveal fact'
status: To Do
assignee: []
created_date: '2026-10-27 03:58'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - npc
  - rules-gate
  - 'ws:codex'
milestone: m-11
dependencies:
  - TASK-0140
  - TASK-0143
priority: medium
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Info ids become codex clue/secret ids; `info.revealed` generalised per P-10.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: `hooks.knows`, `hooks.secrets` and beat `clues` entries carry stable ids, and an `info.revealed` fact records what the party learned.

Why: decision-0026 (D18, TASK-0119 research branch 2; analysis docs/research/NPCs-Social-and-Information/Analysis-NPC-and-Information-Contracts.md, card K1). Under decision-0025 (formulation 3) information and attitude are plot and move only through recorded facts. Operator rulings 2026-10-26: placement 'K3 now, K1-K6 after demo' (m-3, ordered after the Track C demo subset); attitude 'Per character'; clue lint 'Warn; fail only core'; 'SRD Influence DC'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the seed schema and loader require ids and reject duplicates
- [ ] #2 a reveal fact names an item id, a source and recipients, and a projection holds the known set
- [ ] #3 a reveal by an NPC must name that NPC's own item
- [ ] #4 the output gate refuses player-facing text that states a DM-only item with no reveal fact, and a test drives it with a paraphrased secret
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Info ids become codex clue/secret ids; `info.revealed` generalised per P-10.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
