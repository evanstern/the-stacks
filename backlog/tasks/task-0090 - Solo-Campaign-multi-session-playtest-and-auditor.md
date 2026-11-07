---
id: TASK-0090
title: 'Solo Campaign: multi-session playtest and auditor'
status: To Do
assignee: []
created_date: '2026-10-25 20:19'
updated_date: '2026-11-07 05:17'
labels:
  - solo
  - test
milestone: m-9
dependencies:
  - TASK-0088
priority: medium
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the playtest harness runs a scripted multi-session campaign and the auditor checks continuity across sessions, not only within one.

Why: long-run failures (forgotten threads, contradicted facts, drifting NPC voices) appear only across sessions. Evidence, not impressions (decision-0021 idea 6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness runs at least three scripted sessions of one campaign.
- [ ] #2 The auditor checks recaps, NPC portrayal and open threads across sessions, and writes a report.
- [ ] #3 The harness runs in CI against the fake gateway adapter, and on demand against a configured provider.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
