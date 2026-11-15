---
id: TASK-0348
title: Talk chain cap swallows the read after a text-less declared Intent
status: To Do
assignee: []
created_date: '2026-11-15T03:26:00Z'
labels:
  - playtest
  - ws:dm
milestone: m-10
dependencies: []
priority: high
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted run 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 4): after two DM narrations, a second /move stage (seq 26) queued no read and no confirm row. capReached (apps/server/src/dm/talk-triggers.ts) counts ai:dm narrations since the last human transcript row, and a declared Intent with no text adds no transcript row. A player who walks stage by stage stalls until they say something.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A human declared mechanical Intent resets the chain cap the same way a human talk row does
- [ ] #2 A test covers two narrated moves followed by a third declared /move, which queues a read
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
