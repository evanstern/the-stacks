---
id: TASK-0358
title: Dev stack survives host restarts
status: In Progress
assignee: []
created_date: '2026-11-25T05:43:00Z'
updated_date: '2026-11-25T05:45:00Z'
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
- [x] #1 app and db in deploy/dev/compose.dev.yml set restart: unless-stopped
- [x] #2 docker compose config with both files validates
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added restart: unless-stopped to dev app and db in deploy/dev/compose.dev.yml. After a 2026-11-16 OOM kill and a 2026-11-18 host reboot, policy 'no' left dev down, and drift-dev reported 'observed unreachable' every hour.
<!-- SECTION:FINAL_SUMMARY:END -->
