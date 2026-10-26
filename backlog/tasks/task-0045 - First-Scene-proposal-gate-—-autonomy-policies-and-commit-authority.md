---
id: TASK-0045
title: 'First Scene: proposal gate — autonomy policies and commit authority'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 03:53'
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

Spec: specs/029-proposal-gate
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
- [ ] #10 Spec phase: Setup and foundational — proposal contracts in code (US2, US7; AC #2)
- [ ] #11 Spec phase: Pure decision core — permissions, routing, commit authority, planner (US1, US3, US4; AC #2, #6, #7, #8)
- [ ] #12 Spec phase: Fixtures for the play route and the gate (US7; TASK-0047 contract)
- [ ] #13 Spec phase: Server gate and seam (US1, US2, US3, US4; AC #3, #4, #5, #6, #7, #8)
- [ ] #14 Spec phase: WebSocket delivery, send path and restart (US2, US5; AC #4, #9)
- [ ] #15 Spec phase: Write boundary and full gate (US6; AC #1)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Input from the TASK-0044 spec (specs/028-session-model, 2026-10-25): until this task lands, events with visibility 'dm' reach no WebSocket connection. This task adopts the session-model canSee() rule in apps/server/src/ws/registry.ts, so a DM's live connection receives DM-only events such as proposal.created (AC #4).

Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 3) after TASK-0044 merged (#46). Worktree .worktrees/task-0045, branch task-0045-proposal-gate, cut from origin/main 8a8bb81. Spec number 029 claimed with a stub.

Spec authoring by opus-implementer: 28969e2, ~294k tokens. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Operator rulings 2026-10-26 on the spec's open questions:
(1) The WS error frame gains an optional code field.
(2) The uncatalogued WS send path stays for now and is carded as TASK-0099 (m-3, after TASK-0045 and TASK-0047).
(3) The DM view goes only to the user holding the logged human DM seat (AI by default, changed only by the operator). Operator role alone does not grant it.
(4) The spec's default policy table stands: with a human seat, ask for talk, action.comment, action.commit, mechanics, narration, table-mode, party and tracker; suggest for scene; auto for action.resolve and journal. With an AI seat, everything is auto.
(5) A party-scope commit with more than one human is refused with GROUP_SIGNOFF_REQUIRED until TASK-0049.
Implementation dispatch grouping: P1 | P2+P3 | P4 | P5 | P6.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
