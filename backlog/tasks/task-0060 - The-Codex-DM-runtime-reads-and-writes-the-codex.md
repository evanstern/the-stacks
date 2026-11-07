---
id: TASK-0060
title: 'The Codex: DM runtime reads and writes the codex'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
updated_date: '2026-11-07 05:16'
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

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: the DM runtime's assemble node loads codex neighbours for the scene, and chronicle proposes codex updates. Scenes start from codex entities instead of the M2 scene seed.

Why: architecture A11 names codex neighbours as assemble input; M2 used a seed because the codex did not exist (decision-0009). Chronicle writes codex updates as proposals (decision-0017).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A scene starts from a codex location and its linked NPCs, encounter and items.
- [ ] #2 Assemble loads the scene entities and their linked neighbours within a stated token budget.
- [ ] #3 Chronicle proposes codex updates, and the gate applies them under the configured policy.
- [ ] #4 The scene seed loader is removed, and the M2 playtest harness runs from codex fixtures.
- [ ] #5 A test proves the narrator plays an NPC from its portrayal section.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. `compile()` replaces seeds; delete seed files and loader; absorbs 0107, 0108.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
