---
id: TASK-0323
title: 'Revisit: durable fact-rows row before narration'
status: To Do
assignee: []
created_date: '2026-11-13T00:01:00Z'
labels:
  - ws:narration
  - revisit
milestone: m-11
dependencies:
  - TASK-0298
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 108 OQ-1. TASK-0298 meets 'fact rows before prose' with a short-lived rows part on the narration-stream frame plus late-joiner replay, not a separate durable row, because a real split breaks findLandedNarration, checkpoint seqs and playtest segments. Trigger: the CP-7 playtest shows a viewer missing fact rows (reconnect, replay, transcript export).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fact rows land as their own durable event before the narration row, and checkpoint seqs and playtest segments still hold.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
