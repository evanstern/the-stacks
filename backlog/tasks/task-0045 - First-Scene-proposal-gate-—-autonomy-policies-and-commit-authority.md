---
id: TASK-0045
title: 'First Scene: proposal gate — autonomy policies and commit authority'
status: To Do
assignee: []
created_date: '2026-10-25 19:59'
labels:
  - first-scene
  - gate
milestone: m-2
dependencies:
  - TASK-0044
references:
  - docs/design/architecture.md
priority: high
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the one gate between intent and state. Every LLM output and every player action is a typed proposal; the gate applies a per-kind policy (auto, ask, suggest) and the commit authority of the current table mode, then calls the engine.

Why: one mechanism serves the AI DM (auto), the AI-assisted human DM (ask, suggest) and player sign-off (decision-0015, decision-0016). Pending proposals are events, so they survive restarts and are filtered per viewer. Refuse before write (decision-0021 idea 1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No code path writes LLM output to the log except through a typed proposal; a test enforces this.
- [ ] #2 A per-kind policy table maps each proposal kind to auto, ask or suggest.
- [ ] #3 Policy auto applies the proposal through the engine immediately.
- [ ] #4 Policy ask appends a DM-only proposal.created event and applies the proposal only after proposal.approved.
- [ ] #5 Policy suggest shows the proposal to the DM and applies nothing.
- [ ] #6 The gate enforces commit authority by table mode, as decision-0016 tabulates.
- [ ] #7 A human DM's command passes through the same engine as an already-approved proposal.
- [ ] #8 The gate refuses an illegal proposal before any write and returns the engine's error code.
- [ ] #9 A test restarts the server and shows pending proposals intact.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
