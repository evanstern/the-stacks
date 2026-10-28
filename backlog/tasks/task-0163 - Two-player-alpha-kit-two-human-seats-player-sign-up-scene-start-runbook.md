---
id: TASK-0163
title: 'Two-player alpha kit: two human seats, player sign-up, scene-start runbook'
status: To Do
assignee: []
created_date: '2026-10-28 04:12'
labels:
  - multiplayer
  - dev-tooling
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator and one other developer can play one scene together on hosted dev as a bug-tolerant alpha, with an AI DM.

Evidence (2026-10-28 survey of main at 1de4e6e):
- apps/server/seeds/greyhollow-ford.json has one human seat (tamsin); odo and kestrel are companions. POST /dm/sessions/:sessionId/start requires a user id per human seat, so a second human cannot be seated.
- The server issues and redeems invitations (POST /invitations, POST /invitations/redeem), but apps/web/app/routes.ts has no redeem page. The only path to a second account is create-operator.js with OPERATOR_USERNAME, which makes an operator.
- Scene start is an operator API call with a seed id and a seat map. No UI or runbook covers it.

Why: group sign-off, floor passing and presence (TASK-0049, TASK-0050, TASK-0051) are merged, but no table can seat two humans. This kit also serves TASK-0053, which needs several humans at one table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shipped seed seats at least two humans, loads through loadSeed, and has a test
- [ ] #2 A second person can get a player account through the web app from an operator-issued invitation, with no modal, and a test
- [ ] #3 docs/ops/dev-vm-104.md documents issuing an invitation, creating a session, and starting a scene with a seat per human on hosted dev
- [ ] #4 The runbook is run once on hosted dev with two accounts, and the result is recorded on this card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
