---
id: TASK-0060
title: 'The Codex: DM runtime reads and writes the codex'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
updated_date: '2026-11-07 05:24'
labels:
  - codex
  - dm
  - 'ws:codex'
milestone: m-11
dependencies:
  - TASK-0057
references:
  - docs/design/architecture.md
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: `compile()` replaces seeds; delete seed files and loader; absorbs 0107, 0108.

Intent: `compile(codex, sceneRef, viewer) → SceneContext` loads the scene location, present NPCs, active encounter and in-scope clues by graph neighbourhood. It splits a DM view from a player view and replaces `PlayerSeedView` and the seed loader. DM-side nodes read NPC secrets and motives from the DM view (absorbed TASK-0107). Transcript lines name characters from compiled entities, not user ids (absorbed TASK-0108). Delete `apps/server/seeds/` and `dm/seed/load.ts` (R2 exit criterion 1). Chronicle write-back moves to TASK-0084 (R7).

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): assemble loads codex neighbours for the scene and chronicle proposes codex updates; scenes start from codex entities instead of the M2 scene seed (A11, decision-0009, decision-0017).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 compile() returns a SceneContext with location, present NPCs, active encounter and in-scope clues by graph neighbourhood.
- [ ] #2 compile() returns separate DM and player views; the player view holds no DM-only block, with a test.
- [ ] #3 apps/server/seeds/, dm/seed/load.ts and PlayerSeedView are deleted, and scenes start from codex entities.
- [ ] #4 Director and interpret read NPC secrets and motives from the compiled DM view.
- [ ] #5 Interpret and director transcript lines name characters from compiled entities, never user ids, with a test.
- [ ] #6 Assemble loads the compiled context inside a stated token budget, and a test shows an NPC played from its portrayal.
- [ ] #7 The playtest harness and Greyhollow scenarios run from codex fixtures.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. `compile()` replaces seeds; delete seed files and loader; absorbs 0107, 0108.

Merged from TASK-0107 (Revisit: DM-side nodes read NPC secrets (Director motive)) by replan-2026-11: `compile()` DM view feeds DM-side nodes.

Merged from TASK-0108 (Revisit: Director and interpret transcript lines name characters, not user ids) by replan-2026-11: Names come from entities in the compiled context.

AC re-authored by replan-2026-11.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
