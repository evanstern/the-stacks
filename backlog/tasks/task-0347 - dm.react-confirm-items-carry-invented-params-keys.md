---
id: TASK-0347
title: dm.react confirm items carry invented params keys
status: To Do
assignee: []
created_date: '2026-11-15T03:19:00Z'
labels:
  - playtest
  - ws:dm
milestone: m-10
dependencies: []
priority: high
ordinal: 331000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted run 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 3): dm.narrate dm.react-v6 confirm items for a move body carried params keys the Intent schema does not know ("skill"; "ready", "caution"). Schema mismatch on attempt 1 twice (calls 2184, 2188); attempt 2 passed. Attempt-1 failures rose to 4.1% (2/49) against the R1 target of under 1%. TASK-0336 fixed target shapes, not params.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirm item whose params hold unknown keys is repaired or stripped in code before validation, or the prompt schema states the allowed params per kind
- [ ] #2 A test covers a move confirm item with an invented params key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
