---
id: TASK-0190
title: Narration sets NPC dialogue apart from the prose
status: To Do
assignee: []
created_date: '2026-11-02 04:03'
labels:
  - web
  - ux
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: spoken lines inside DM narration read as dialogue at a glance, as a novel or a script would set them.

Why: alpha run 3 (2026-11-01), finding 4. Narration is one italic muted paragraph; Wenna's quoted lines ('No blood spilled,' she mutters ...) are hard to pick out. The operator suggested a different font, color or size, or novel-style separate lines, or a script layout.

Options to weigh: render quoted spans in narration with upright, full-contrast text; break each quoted line onto its own line; or have narration carry structured speaker spans (larger change, touches the narration schema). Pick in the spec.

Related: TASK-0133 (dice lines distinct from prose), TASK-0187 (transcript width), TASK-0180 (NPC replies ship as narration, OQ-6 (a)).

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Quoted dialogue in narration is visually distinct from the surrounding prose in light and dark themes
- [ ] #2 The change works at 1280 px and 390 px with no modal
- [ ] #3 A web test covers a narration with a quoted line
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
