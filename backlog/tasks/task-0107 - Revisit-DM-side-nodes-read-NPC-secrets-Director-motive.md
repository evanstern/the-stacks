---
id: TASK-0107
title: 'Revisit: DM-side nodes read NPC secrets (Director motive)'
status: To Do
assignee: []
created_date: '2026-10-26 18:11'
updated_date: '2026-11-02 05:22'
labels:
  - dm
  - revisit
dependencies: []
priority: low
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when a captured run or the M2 demo shows the Director making decisions that ignore an NPC's hidden motive, or when a seed needs a villain's secret to drive pacing.

Context: TASK-0106 (specs/034-narration-quality) moved Snag's motive from portrayal.want into hooks.secrets so player-facing prompts cannot leak it. No prompt reads hooks.secrets today, so the Director lost the motive too. Decide whether DM-side nodes (Director, adjudicate) should read NPC secrets through a DM-only seed view, and how to keep the Director's goalNote, which reaches narrate, from carrying them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision records whether DM-side nodes read NPC secrets, with the evidence that triggered the revisit
- [ ] #2 If yes, a DM-only seed view feeds them, and a test proves the goalNote path cannot carry a secret to player-facing prompts
- [ ] #3 a DM-only seed view type feeds the four DM-side prompts
- [ ] #4 narrate takes Director guidance only as structured fields, and `goalNote` reaches Interpret only
- [ ] #5 a type-level test proves no player-facing prompt builder accepts the DM-only view or Director free text
- [ ] #6 the 034 contract's "Who gets what" table is amended
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ADOPTED 2026-10-26 by decision-0026 (D18, TASK-0119 analysis, card K3); operator ruling 'K3 now' puts it in m-3 Track C now (floats; runbook amendment 1). Outcome: the Director, Interpret, Adjudicate and the audit read NPC `knows`, `secrets` and `relationships`; no player-facing prompt can receive them or Director free text.

Operator ruling 2026-11-02 (M3 planning, orchestrator session local_6a4a04a4): research, doctrine and low-priority revisits move out of m-3. Milestone cleared, revisit label added. Re-enter a milestone when its trigger fires.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
