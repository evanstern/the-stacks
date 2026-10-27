---
id: TASK-0153
title: 'Revisit: exact pre-turn snapshot S0 across a reclaimed turn'
status: To Do
assignee: []
created_date: '2026-10-27 04:10'
labels:
  - revisit
  - dm
  - rules-gate
dependencies: []
priority: low
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when TASK-0143 (claim gate) or TASK-0147 (resolve batch gate) needs the exact pre-turn S0 rather than S0 rebuilt from the log at reclaim time. Context: TASK-0140 (specs/040-actor-snapshot) rebuilds S0 from the log on a reclaim, so the S0-to-S1 diff misses rows the first attempt already landed; NarrationFacts still reports them. decision-0025 and docs/design/actor-state-gate.md do not settle it. Carded 2026-10-27 by the M3 sweep orchestrator under decision-0020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision states whether S0 is checkpointed at assemble and how a reclaimed turn's diff is computed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
