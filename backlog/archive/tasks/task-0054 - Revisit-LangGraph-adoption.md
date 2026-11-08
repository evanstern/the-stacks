---
id: TASK-0054
title: Revisit LangGraph adoption
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-11-07 05:16'
labels:
  - revisit
  - ai
  - dm
  - replan-2026-11
milestone: m-4
dependencies: []
references:
  - 'https://docs.langchain.com/oss/javascript/langgraph/interrupts'
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a decision record that adopts or rejects LangGraph.js, made when its trigger fires.

Trigger (decision-0019): the second agent graph lands (the M4 campaign-prep agents: NPC-smith or the encounter builder), or any DM pipeline node needs dynamic routing among more than two branches or a cycle.

Why: decision-0019 rejected LangGraph for the First Scene. Its checkpointer duplicates the event log, interrupt() duplicates proposals-as-events, and its run scheduling duplicates the jobs queue. decision-0007 (no vendor SDK) pulls against its @langchain/core peer dependency. The nodes are plain async functions, so a StateGraph can wrap them if the answer changes.

Gate: the M4 milestone's first agent task waits on this card (docs/design/milestones.md M4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The revisit starts only when the stated trigger fires, and the record names which trigger fired.
- [ ] #2 A decision record adopts or rejects LangGraph.js, citing current LangGraph.js documentation.
- [ ] #3 The record states how the event log, proposals and jobs queue relate to the LangGraph checkpointer, interrupt() and run scheduling.
- [ ] #4 The record states whether the @langchain/core peer dependency is acceptable under decision-0007.
- [ ] #5 If adopted, the record names the first node set to wrap and the migration plan.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: P-18: no LangGraph.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
