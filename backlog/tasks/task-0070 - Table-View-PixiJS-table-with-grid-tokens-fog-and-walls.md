---
id: TASK-0070
title: 'Maps and the Table View: PixiJS table with grid, tokens, fog and walls'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-10-25 20:19'
labels:
  - table-view
  - ui
  - session
milestone: m-6
dependencies:
  - TASK-0069
references:
  - docs/design/architecture.md
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the in-app table view shows the session's map with grid, tokens and fog of war. Walls block reveal. Token moves and reveals are session events.

Why: decision-0013 (own table view first) and architecture A13. The view projects the log; hidden regions stay server-side until revealed (constitution IV).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play route shows the current map with grid and tokens, client-only per decision-0008.
- [ ] #2 Token moves are proposals through the gate, and the view updates from the resulting events.
- [ ] #3 Unrevealed regions never reach a player client; a test inspects the player's event stream.
- [ ] #4 Walls block line-of-sight reveal, computed on the server from the MapPlan.
- [ ] #5 Reconnect replays the log and restores the same map state.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
