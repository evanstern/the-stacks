---
id: TASK-0081
title: 'The Dial: backup, restore and upgrade migrations'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:17'
labels:
  - release
  - infra
  - 'ws:platform'
milestone: m-13
dependencies:
  - TASK-0076
priority: medium
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a self-hoster backs up a campaign install, restores it, and upgrades between versions without losing data.

Why: self-hosters own their data (constitution VIII, IX). The event log and codex are the campaign; losing them on upgrade is not acceptable for a release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One command backs up the database volume and uploaded files.
- [ ] #2 One command restores a backup into a fresh install, and a test replays a session afterwards.
- [ ] #3 Migrations apply forward from every tagged pre-release version, and CI tests the upgrade path.
- [ ] #4 The docs describe backup, restore and upgrade.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Re-homed by replan-2026-11. Backup, restore, migrations needed once campaigns hold authored content.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
