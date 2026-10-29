---
id: TASK-0167
title: Operator header stops offering Start scene once a scene start is queued
status: In Progress
assignee: []
created_date: '2026-10-28 07:59'
updated_date: '2026-10-29 01:46'
labels:
  - play-route
milestone: m-3
dependencies: []
priority: medium
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: after the operator starts a scene, the table header stops offering "Start scene" while the scene-start suggestion is pending. Evidence: the TASK-0159 spec author (spec 055, 573cafc) found that TASK-0163 canStart checks model.scene === null. With a human DM the scene-start suggestion stays pending, so the header still shows "Start scene" and "Scene start queued.", and a second start gets 409. Why it matters: the TASK-0163 alpha run and the TASK-0053 human-DM run both start scenes this way.

Spec: specs/059-start-scene-queued
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The header hides or disables Start scene once the session has a queued or pending scene start, with a test
- [x] #2 Spec phase: The server predicate, the 409 and the read route (card AC #1; OQ-1)
- [ ] #3 Spec phase: The live source and the header (card AC #1; OQ-2, OQ-4)
- [ ] #4 Spec phase: DB suites and the live check **[orchestrator]**
- [ ] #5 Spec phase: Wiki re-ground
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0167, branch task-0167-start-scene-queued, cut from origin/main ba18aaf7. Spec 059 authored at 21be5ba9: one server predicate sceneStartState (none | queued | pending | started) drives both the start route 409 and a new operator-only GET /dm/sessions/:id/start that the header reads; TableView drops its local startQueued flag. The author found that with a human DM a second start is accepted today (no 409) and re-proposes the opening moves; T003 is a red-first DB test for it. No frozen contract change, no new frame, no modal. Open questions OQ-1 to OQ-4 go to the operator.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-28, verbatim: "Accept all (a)", in answer to "Do you accept the recommended defaults (a) for TASK-0167's OQ-1 to OQ-4?". So: OQ-1 (a) the start route refuses with 409 while the scene suggestion is pending (amend 031 dm-api.md); OQ-2 (a) the header polls the GET every 5 s while queued or pending, plus fetch on catch-up and after each start result; OQ-3 (a) after a Dismiss the state is none and the operator may start again; OQ-4 (a) two texts, "Scene start queued." and "Scene start waiting for the DM."

Phase 1 (T001-T010) at a09be525: pure sceneStartState in dm/scene-start.ts, the POST refuses every state but none, operator-only GET /dm/sessions/:id/start, 031 dm-api.md amended. Orchestrator DB run on the stacks-task-0167 test DB: human-dm-scene.integration, routes.integration, scene-start.test: 3 files, 36 passed. T003 red run with routes/dm.ts at 21be5ba9: case (e) fails "expected 202 to be 409", so today a second human-DM start is accepted; restored, diff empty. Orchestrator ruling on the implementer reading: humanDmWorld writes no scene-start job row, so (e) asserts the scene-start job count is unchanged by the refused POST; that is the intent of T003.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (T011-T022) at aad6f308: fetchStartState/nextStartView/shouldPollStart, TableSource.sceneStart, operator-only 5 s poll in use-live-table, TableView drops startQueued, TableHeader startNote with the two OQ-4 texts; 030 table-source.md, ui-surfaces.md and 054 web-surfaces.md amended additively; dev-vm-104 step 17 note. ci:check without DB: only the 5 known adjudicate requireDb failures.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 [orchestrator] T023 at aad6f308 on the stacks-task-0167 test DB: routes.integration, human-dm-scene.integration, human-dm-roll-resume, duo, scene.integration, worker, scene-start.test: 8 files, 66 passed. T003 red run recorded above (202 at 21be5ba9). T024 mutation guard (rule 3 off at scene-start.ts:39): 3 fail, (e), (f) and the pure pending case; restored, diff empty. T025/T026 live checks wait: the app image cannot build because Docker Desktop cannot pull docker/dockerfile:1 (DeadlineExceeded) after its restart.

Phase 4 (T027-T032) at f67daa51: re-pinned scene-panels, play-route (also repaired a truncated Start scene section fused with the Scene panels heading on main), dm-runtime, hosted-dev, debug-view, server-entrypoint-and-app; CAPSULES regenerated, INDEX sentence, runbook row. Freshness OK (55 notes), spec-bridge exit 0. dm-runtime sits at its 8000-char budget; the implementer dropped "never prompt text" from its GET /turns line to fit.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
