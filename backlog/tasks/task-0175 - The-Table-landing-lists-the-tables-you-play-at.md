---
id: TASK-0175
title: The Table landing lists the tables you play at
status: To Do
assignee: []
created_date: '2026-10-29 01:52'
labels:
  - web
  - server
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: medium
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: /play lists the tables the signed-in account has a seat at (as a player or the DM), newest activity first, each with its scene title and a link. The operator also sees the tables they started. Start fresh and Join by link stay.

Why: two-browser alpha playtest 2026-10-28, item 8. After a system reboot the operator could not find the table again. /play (apps/web/app/routes/table.tsx) offers only 'start a fresh table' (a random id) and 'join by pasting a link or id'. Nothing lists past tables, so the only way back was browser history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A read route returns the sessions the signed-in account has a seat at or started, with scene title and last activity, and an integration test covers a player and the operator
- [ ] #2 /play lists those tables newest activity first, each linking to play/:sessionId, in light and dark mode
- [ ] #3 A player never sees a table they have no seat at, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
