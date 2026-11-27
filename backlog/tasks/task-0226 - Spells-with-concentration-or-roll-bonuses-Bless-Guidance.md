---
id: TASK-0226
title: Spells with concentration or roll bonuses (Bless, Guidance)
status: In Progress
assignee:
  - '@rules-engine-engineer'
created_date: '2026-11-03T08:00:00Z'
updated_date: '2026-11-27T04:26:24Z'
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

Spec: specs/124-spell-concentration-bless-guidance
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bless and Guidance resolve through the engine with concentration tracked and broken per SRD 5.2.1, with engine tests
- [ ] #2 Spec phase: Engine concentration and roll bonuses (FR-001–FR-008; AC #1)
- [ ] #3 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) CONTROL arm. Spec allocated by PM: specs/124-spell-concentration-bless-guidance. Owner: Rules Engine Engineer (Sonnet, cc/claude-sonnet-5-5[1m]). Record D24 metrics (CI-first-push, review findings, rework cycles, tokens/cost, claim→PR-ready wall time, gate violations, Dispatch: line) in final summary.

Claimed 2026-11-27 by Rules Engine Engineer (D24 control, Sonnet). Branch task-0226-spell-concentration cut from main b69a9265. Spec: specs/124-spell-concentration-bless-guidance

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->
