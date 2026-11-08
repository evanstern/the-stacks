---
id: TASK-0072
title: 'Maps and the Table View: VTT adapter port and the first live adapter'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - vtt
  - adapter
  - deferred
milestone: m-18
dependencies:
  - TASK-0070
references:
  - docs/design/architecture.md
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a table port in the server and one live external VTT adapter, chosen between Foundry VTT and Owlbear Rodeo by a decision record at the start of the card.

Why: decision-0013. Operators keep their favourite VTT, but our server keeps authority: the adapter sends talk, actions and approvals in and receives viewer-filtered events out, like any first-party client (architecture A13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record chooses Foundry VTT or Owlbear Rodeo, citing each one's current integration surface.
- [ ] #2 The table port defines the inbound messages and the outbound viewer-filtered events.
- [ ] #3 The adapter shows the session's map and tokens in the chosen VTT.
- [ ] #4 A token moved in the VTT becomes a proposal through the gate; a refused move snaps back.
- [ ] #5 The adapter never writes state directly, and a test proves hidden regions never reach it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. P-07 trigger; review at CP-15.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
