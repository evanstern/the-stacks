---
id: TASK-0158
title: Env-reachable scripted fake DM provider for live UI checks
status: To Do
assignee: []
created_date: '2026-10-27 09:59'
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
