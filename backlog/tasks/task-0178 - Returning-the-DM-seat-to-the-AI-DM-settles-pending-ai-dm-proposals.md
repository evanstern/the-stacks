---
id: TASK-0178
title: 'Returning the DM seat to the AI DM settles pending ai:dm proposals'
status: To Do
assignee: []
created_date: '2026-10-29 05:09'
updated_date: '2026-11-07 05:18'
labels:
  - play-route
  - proposal-gate
  - 'ws:dm-console'
milestone: m-12
dependencies:
  - TASK-0177
priority: medium
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when the operator returns the DM seat to the AI DM, the server settles every pending ai:dm proposal (for example, the AI DM re-plans it under auto), so no action stalls.

Why: spec 062 (TASK-0177) OQ-4 (a) sends only dm.seat and shows a non-blocking warning. A proposal left pending stalls its action: the AI DM's beat skips it, and a pending scene start keeps "Scene start waiting for the DM.". Deferral DC-1 of specs/062-human-dm-seat/spec.md. Operator ruling 2026-10-29 in the M3 sweep chat: "Card DC-1 (server settles pending ai:dm proposals when the seat returns) in m-3". Amends frozen 029 gate-api.md step 5: needs an operator ruling on the contract change before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Returning the DM seat to the AI DM settles each pending ai:dm proposal on the server, with a DB test
- [ ] #2 The 029 gate-api.md amendment is ruled by the operator and recorded on this card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
