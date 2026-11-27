---
id: TASK-0226
title: Spells with concentration or roll bonuses (Bless, Guidance)
status: To Do
assignee: []
created_date: '2026-11-03T08:00:00Z'
updated_date: '2026-11-27T03:38:26Z'
labels:
  - engine
  - rules
  - dm
  - ws:engine
  - exp:d24-control
milestone: m-12
dependencies:
  - TASK-0105
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) OQ-2: spells that grant roll bonuses or need concentration are refused SPELL_UNRESOLVED. Odo's Bless and Guidance are refused in play until this lands. Model concentration (one at a time, breaks on damage per SRD 5.2.1) and the bonus die on the target's rolls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bless and Guidance resolve through the engine with concentration tracked and broken per SRD 5.2.1, with engine tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) CONTROL arm. Spec allocated by PM: specs/124-spell-concentration-bless-guidance. Owner: Rules Engine Engineer (Sonnet, cc/claude-sonnet-5-5[1m]). Record D24 metrics (CI-first-push, review findings, rework cycles, tokens/cost, claim→PR-ready wall time, gate violations, Dispatch: line) in final summary.
<!-- SECTION:NOTES:END -->
