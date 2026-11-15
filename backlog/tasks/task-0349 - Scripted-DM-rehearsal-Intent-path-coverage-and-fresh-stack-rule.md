---
id: TASK-0349
title: 'Scripted-DM rehearsal: Intent path coverage and fresh-stack rule'
status: To Do
assignee: []
created_date: '2026-11-15T03:29:00Z'
labels:
  - playtest
  - ws:tooling
milestone: m-10
dependencies: []
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 rehearsal (docs/playtests/2026-11-14-combat-smoke-rehearsal.md) and hosted log (docs/playtests/2026-11-14-combat-smoke-hosted.md findings 7, 9). No shipped DM script exercises the Intent path (/attack, /move). Strict scripts desync on leftover or retried jobs, so each rehearsal needs a fresh stack; playtest-run section 3 does not say so. PW_ACTION_ID must match scripted action ids. local-table.mjs cannot post party-scope actions or comments. runbook-b2-reed-camp act-cast fails at interpret (party scope, actor null). A second connected seat breaks act-rush. dm.companion logs errorKind config under DM_FAKE_SCRIPT.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shipped DM script plays a reed-camp fight through typed /move, /attack and /end Intents
- [ ] #2 playtest-run section 3 states that a strict script needs a fresh stack per rehearsal
- [ ] #3 local-table.mjs can post party-scope declares and comments, or the b2 act-cast step is rewritten to a path it can post
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
