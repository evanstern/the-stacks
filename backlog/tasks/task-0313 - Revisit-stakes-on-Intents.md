---
id: TASK-0313
title: 'Revisit: stakes on Intents'
status: To Do
assignee: []
created_date: '2026-11-11T19:51:00Z'
updated_date: '2026-11-13T13:32:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - revisit
milestone: m-11
dependencies: []
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 097 OQ-5 and spec 104 OQ-6: band effects and the free retry (autoSuccess) run beside the Intent path, model-written, which conflicts with constitution II/III. Putting stakes on Intents is an Intent contract minor (C-CON). Trigger: the beside path blocks a card, or TASK-0299 needs stakes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stakes ride the Intent contract (minor version, C-CON recorded) and the planner plans band effects in code.
- [ ] #2 The beside path in resolve.ts is deleted.
- [ ] #3 Band effect amounts derive from an SRD hazard record or a stat, never model dice (spec 109 OQ-1).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 107 OQ-3 (operator 'Accept all', 2026-11-12): companion acts in free mode stay prose plus interpret, because check stakes still need the beside fields the model writes. Stakes on Intents would let those acts skip interpret too.

2026-11-13: claimed by mistake by the R1 sweep after TASK-0312 and released unworked. Branch task-0313-stakes-on-intents and its spec 111 stub were deleted. The card is still R2 (m-11), and its revisit trigger has not fired.
<!-- SECTION:NOTES:END -->
