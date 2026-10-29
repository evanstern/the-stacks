---
id: TASK-0165
title: Human DM can end an encounter or change table mode from the table
status: In Progress
assignee: []
created_date: '2026-10-28 07:53'
updated_date: '2026-10-29 02:17'
labels:
  - play-route
  - gate
milestone: m-3
dependencies:
  - TASK-0159
priority: high
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a seated human DM can end an encounter and change table mode from the play route, with no modal. Evidence: the TASK-0159 spec author (spec 055, 212a4f8, DC-1) found the play route gives a human DM no control for either. TASK-0159 keeps the table in turn mode when the scene changes (OQ-5 A). Why it matters: the M3 demo second run is ask mode with a human DM (checkpoint C7), and that DM may need to leave an encounter. Operator ruling 2026-10-28: "Card DC-1 (human DM ends an encounter or changes table mode) in m-3".

Spec: specs/060-human-dm-encounter-mode
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play route offers a seated human DM an end-encounter control built from a gate request, with no modal, and a test
- [ ] #2 The play route offers a seated human DM a table-mode control built from a gate request, with no modal, and a test
- [ ] #3 Spec phase: Frames, commands and fixture rows (card AC #1, #2; OQ-2)
- [ ] #4 Spec phase: The view, the panel and the header (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-5)
- [ ] #5 Spec phase: The DB test (FR-016; OQ-6)
- [ ] #6 Spec phase: DB suites, mutation guard and live check **[orchestrator]**
- [ ] #7 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0165, branch task-0165-human-dm-encounter-mode, cut from origin/main dbc06a4f. Spec 060 authored at 5968e469 (opus): OQ-1 to OQ-6 await the operator; DC-1 (human DM cannot start an encounter) applies only if OQ-3 is ruled (c).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-28 in chat, answering "Do you accept the recommended defaults (a) for TASK-0165's OQ-1 to OQ-6?": "Accept all (a)". Recorded in spec.md. DC-1 (human DM starts an encounter) is not carded: it applied only under OQ-3 (c).

Phase 1 (T001-T009) at b0d22371: encounterEndFrame, tableModeFrame and tableModeReason in frames.ts; TableCommands.endEncounter/setTableMode; localEncounterEndEvents/localTableModeEvents; live and fixture commands (planEncounterEnd, planTableMode). 13 new cases. ci:check without DB: only the 5 known adjudicate requireDb failures. Orchestrator rulings on the implementer readings: the contract shapes stand (end returns rows or null, mode returns one row or null); the blank-reason fallback lives in both the frame builder and the local builder; the follow-on free-mode request reuses the end reason; fixture rows use the engine event type encounter.ended, as the floor builder does.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
