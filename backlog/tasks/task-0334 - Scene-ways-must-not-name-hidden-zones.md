---
id: TASK-0334
title: Scene ways must not name hidden zones
status: To Do
assignee: []
created_date: '2026-11-13T20:28:00Z'
labels:
  - playtest
  - ws:table-ux
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-13-r1-spine-test-drive.md
priority: medium
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the 2026-11-13 R1 spine test drive (session 0106e608, seq 2). The public scene.changed 'ways' list on greyhollow-ford includes 'ladder to the loft' with draft '/do I climb the ladder to the loft'. Loft is a hidden zone, and the same turn's narrate check dropped a sentence for naming it (seq 16, fogged-zone leak). TASK-0247's seed check refuses only '/move #zone' ways that target a hidden zone, so a '/do' way whose label or draft names a hidden zone passes and the chip leaks it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The seed check refuses a way whose label or draft names a hidden zone, unless the zone is revealed, with a test.
- [ ] #2 Ways shown to players are filtered by fog, so a way to a hidden zone appears only after the zone is revealed, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
