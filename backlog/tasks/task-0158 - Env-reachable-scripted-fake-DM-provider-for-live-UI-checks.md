---
id: TASK-0158
title: Env-reachable scripted fake DM provider for live UI checks
status: In Progress
assignee: []
created_date: '2026-10-27 09:59'
updated_date: '2026-10-28 03:32'
labels:
  - dm
  - debug-view
  - dev-tooling
milestone: m-3
dependencies: []
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a worktree stack can run a full fake-gateway turn (director through narration) driven by a script chosen in the app's environment, so live UI checks show a happy-path turn. Evidence: TASK-0117 Phase 6 (spec 041, b4d0378, live-check.md) routed dm.* to the fake provider, which returns empty bodies. Scene-start and every turn failed invalid-output at the director, so job-to-event highlighting and a narrated turn could not be shown live. Tests script the fake through loadDmScript, which the running app cannot reach. Needed for the TASK-0117 merge condition (screenshots during a live fake-gateway turn) and for any later UI evidence. No provider key and no paid run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Setting one env value (a script path or name) makes the running app's fake provider replay a DM script, with a test
- [ ] #2 A documented quickstart runs a narrated turn on a worktree stack with no key
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0158, branch task-0158-env-fake-dm-script, cut from origin/main e631d45. Spec number 053 claimed with a stub. Spec 052 is held by TASK-0157 (PR #77), so this takes 053.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
