---
id: TASK-0303
title: >-
  Deploy image and CI regressions from TASK-0270: space package missing from the
  Dockerfile; space timing test flakes
status: In Progress
assignee: []
created_date: '2026-11-09 14:03'
updated_date: '2026-11-09 14:08'
labels:
  - 'ws:platform'
  - replan-2026-11
  - ep-1
  - hotfix
milestone: m-10
dependencies: []
priority: high
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two regressions from TASK-0270 (PR #150).

1. The Dockerfile copies each workspace package by name and omits packages/space. The engine now imports @the-stacks/space, so the runtime image cannot start. vm-104 deploys failed at 05:56, 06:04 and 13:48 on 2026-11-09 and rolled back to 583a0686; TASK-0270, TASK-0098 and TASK-0302 are not live. CI never builds or boots the image, so it did not catch this. packages/intent will hit the same gap when the server imports it (TASK-0268).

2. packages/space test/graph.test.ts 'path and band on 64 zones take under 1 ms each' (SC-005) flakes on CI runners: 1.22 ms measured on PR #149's run. It turns unrelated PRs red.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The runtime image includes every workspace package the server depends on, including packages/space and packages/intent.
- [x] #2 A test fails when a workspace package the server depends on is missing from the Dockerfile's copy lines.
- [ ] #3 A vm-104 deploy of the fix serves the new commit on /health.
- [x] #4 The SC-005 timing test is stable on CI runners while still guarding the 1 ms budget.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0303, branch task-0303-deploy-image-hotfix, cut from origin/main 840fac4f. No spec dir: signed escape line covers this task.

Escape line E8 (operator, 2026-11-09, in chat, answering the request for a spec escape line on the hotfix: 'I approve it'): no spec set; the card's AC drive. Tier: haiku for the Dockerfile and test edits.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5
9ba26e09: space package.json + dist in the image; intent package.json in deps/runtime. Intent dist is not copied: the server does not import intent yet and the build stage does not build it; the new guard (scripts/check-dockerfile-packages.mjs, in check:scripts) fails CI the moment it does. Docker runtime build passed and the engine imported inside the container. 46ae0a12: SC-005 timing test uses warm-up and the median of 9 batches; 1 ms kept; 5/5 local runs pass. Orchestrator: guard exits 0; full ci:check exit 0 after merging main (server 1389, intent 244, web 157). AC #3 reads on the vm-104 deploy.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
