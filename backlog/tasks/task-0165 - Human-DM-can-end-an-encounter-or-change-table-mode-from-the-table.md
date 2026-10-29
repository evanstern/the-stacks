---
id: TASK-0165
title: Human DM can end an encounter or change table mode from the table
status: In Progress
assignee: []
created_date: '2026-10-28 07:53'
updated_date: '2026-10-29 02:46'
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
- [x] #1 The play route offers a seated human DM an end-encounter control built from a gate request, with no modal, and a test
- [x] #2 The play route offers a seated human DM a table-mode control built from a gate request, with no modal, and a test
- [x] #3 Spec phase: Frames, commands and fixture rows (card AC #1, #2; OQ-2)
- [x] #4 Spec phase: The view, the panel and the header (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-5)
- [x] #5 Spec phase: The DB test (FR-016; OQ-6)
- [x] #6 Spec phase: DB suites, mutation guard and live check **[orchestrator]**
- [x] #7 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0165, branch task-0165-human-dm-encounter-mode, cut from origin/main dbc06a4f. Spec 060 authored at 5968e469 (opus): OQ-1 to OQ-6 await the operator; DC-1 (human DM cannot start an encounter) applies only if OQ-3 is ruled (c).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-28 in chat, answering "Do you accept the recommended defaults (a) for TASK-0165's OQ-1 to OQ-6?": "Accept all (a)". Recorded in spec.md. DC-1 (human DM starts an encounter) is not carded: it applied only under OQ-3 (c).

Phase 1 (T001-T009) at b0d22371: encounterEndFrame, tableModeFrame and tableModeReason in frames.ts; TableCommands.endEncounter/setTableMode; localEncounterEndEvents/localTableModeEvents; live and fixture commands (planEncounterEnd, planTableMode). 13 new cases. ci:check without DB: only the 5 known adjudicate requireDb failures. Orchestrator rulings on the implementer readings: the contract shapes stand (end returns rows or null, mode returns one row or null); the blank-reason fallback lives in both the frame builder and the local builder; the follow-on free-mode request reuses the end reason; fixture rows use the engine event type encounter.ended, as the floor builder does.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (T010-T019) at 578c4ef2: table-mode.ts view, TableModePanel slide-out (Panel id table-mode-panel), TableHeader modeOpen/onMode and the DM-only "Table mode" button, view-model tableMode (null for a player); 030 ui-surfaces, live-frames and table-source amended additively. 9 new cases; equivalence and no-dialog unchanged. ci:check: only the 5 known adjudicate requireDb failures. Orchestrator ruling: thenFree follows view.mode === "turn", as OQ-2 (a) says.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 (T020-T024) at 93955186: human-dm-encounter.integration (4 cases: DM end then free; companion-active free then turn queues one companion job; human-active free then turn queues none; player refused NOT_AUTHORIZED, second end NO_ACTIVE_ENCOUNTER). Green with REQUIRE_DATABASE=1 on stacks-task-0165; no server source change.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Fix at cb0545bb (T019a): the T028 live check found that "Switch to free mode" and "Switch to turn mode" sent nothing with a blank reason (modeInput passed "", tableModeFrame refused it). modeInput now falls back to tableModeReason(target), where table-mode-control.md puts the default. New red/green case in table-mode-panel.test.tsx.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 [orchestrator] at f7a85ea7: T025 DB suites 6 files, 34 passed. T026 mutation guard: (1) thenFree skip fails use-fixture-table; (2) turnAfter without an encounter fails table-mode.test (the panel test stays green: it renders a hand-built view); (3) the header trigger fails table-view only with both the isDm check and the tableMode gate removed. T027 start-encounter.mjs. T028 Brave live check: the first run found the blank-reason mode-switch defect (fixed cb0545bb); the final run (session 8daf454b) passes quickstart steps 4-12, shots at 1280/390 light/dark, no modal, no job queued by the human DM requests. Evidence: specs/060-human-dm-encounter-mode/evidence/. DM_FAKE_SCRIPT removed, app recreated.

Phase 5 (T029-T034) at a140f97a: re-pinned play-route (Table mode section; tightened to its 8000-char budget, Start scene detail left to scene-panels), turn-floor and scene-panels; CAPSULES regenerated, INDEX sentence, runbook row (dispatch count corrected to impl ×5). Freshness OK (55 notes), spec-bridge exit 0.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

spec-bridge sync: Frames, commands and fixture rows (card AC #1, #2; OQ-2): 9/9 · The view, the panel and the header (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-5): 11/11 · The DB test (FR-016; OQ-6): 5/5 · DB suites, mutation guard and live check **[orchestrator]**: 4/4 · Wiki re-ground: 6/6 — status In Progress → Done

Merged: PR #85 merged 7c18b8ff by the operator ("I merged it"). AC #1 and #2 proven by the frame, fixture, view, panel and header tests, human-dm-encounter.integration, and the Brave live check (evidence/live-run.md). DoD #1: REQUIRE_DATABASE=1 pnpm ci:check exit 0 on the final tree. Worktree, branch and stack removed; env:prune --check: no orphans.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
