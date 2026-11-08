---
id: TASK-0301
title: Self-hoster docker compose up migrates the database
status: To Do
assignee: []
created_date: '2026-11-08 20:38'
labels:
  - 'ws:platform'
  - replan-2026-11
  - ep-8
milestone: m-17
dependencies: []
priority: medium
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A self-hoster's plain `docker compose up` from a clean clone starts the app against an unmigrated database. Constitution XII requires `docker compose up` to produce a working install. Spec 095 (TASK-0098) fixes worktree stacks only and records this gap as OQ2. The fix may change the vm-104 deploy order, so every vm-104 command is checkpoint C9.

Parent epic: TASK-0265 (R8 Release 1.0). Source: specs/095-migrated-stacks/spec.md OQ2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clean-clone `docker compose up` applies every migration before the app serves traffic.
- [ ] #2 The app refuses to start, with a clear log line, when the database is behind the migration journal.
- [ ] #3 The vm-104 dev deploy still migrates exactly once per deploy.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
