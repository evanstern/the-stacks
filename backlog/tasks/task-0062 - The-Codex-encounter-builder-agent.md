---
id: TASK-0062
title: 'The Codex: encounter builder agent'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
labels:
  - codex
  - ai
  - agent
  - engine
milestone: m-4
dependencies:
  - TASK-0061
  - TASK-0058
  - TASK-0055
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator asks for an encounter and gets a contract-valid encounter entity with monsters from the engine's records, sized for the party.

Why: the second campaign-prep agent. Encounters touch combat balance, so this card follows the parked-rules decision (TASK-0055) and uses PC sheets (TASK-0058) for party strength.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator requests an encounter in plain words, and the agent returns a contract-valid encounter.
- [ ] #2 Every monster in the encounter resolves to an engine record.
- [ ] #3 The agent states the encounter's difficulty for the current party, computed by code, not by the model.
- [ ] #4 The agent's output is a proposal that the operator accepts, edits or rejects.
- [ ] #5 Any fight-budgeting rule adopted by TASK-0055 is used, or the card notes that none was adopted.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
