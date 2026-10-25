---
id: TASK-0068
title: 'Maps and the Table View: MapPlan contract and map-planner agent'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-10-25 20:19'
labels:
  - maps
  - ai
  - agent
milestone: m-6
dependencies:
  - TASK-0067
references:
  - docs/design/architecture.md
priority: medium
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator or the AI DM asks for a map in plain words and gets a Zod-validated MapPlan (rooms, walls, doors, terrain, furniture, grid dimensions), linked to a codex location.

Why: architecture A8 and constitution VII (structured before styled). Grid, walls and fog stay correct by construction because the plan is data before pixels. The agent follows TASK-0054's framework decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared Zod MapPlan contract covers rooms, walls, doors, terrain, furniture and grid dimensions.
- [ ] #2 The agent turns a plain-words request into a valid MapPlan, and the plan links to a codex location.
- [ ] #3 A validator rejects plans with unreachable rooms or walls off the grid.
- [ ] #4 The agent's output is a proposal that the operator accepts, edits or rejects.
- [ ] #5 The plan stores its prompt, provider and seed (constitution VII).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
