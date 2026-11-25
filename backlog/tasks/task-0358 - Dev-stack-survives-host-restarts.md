---
id: TASK-0358
title: Dev stack survives host restarts
status: To Do
assignee: []
created_date: '2026-11-25T05:43:00Z'
labels:
  - ops
  - bug
dependencies: []
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
drift-dev fails hourly since 2026-11-16 (observed unreachable): stacks-dev app/db were killed (exit 137) and the host rebooted 2026-11-18; restart policy is 'no', so dev never came back. Add restart: unless-stopped to app and db in deploy/dev/compose.dev.yml.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 app and db in deploy/dev/compose.dev.yml set restart: unless-stopped
- [ ] #2 docker compose config with both files validates
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
