---
id: TASK-0107
title: 'Revisit: DM-side nodes read NPC secrets (Director motive)'
status: To Do
assignee: []
created_date: '2026-10-26 18:11'
labels:
  - dm
  - revisit
milestone: m-3
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
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
