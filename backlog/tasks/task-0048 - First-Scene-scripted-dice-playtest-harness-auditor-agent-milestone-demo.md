---
id: TASK-0048
title: 'First Scene: scripted-dice playtest harness, auditor agent, milestone demo'
status: To Do
assignee: []
created_date: '2026-10-25 19:59'
labels:
  - first-scene
  - test
  - acceptance
milestone: m-2
dependencies:
  - TASK-0046
  - TASK-0047
references:
  - 'https://github.com/bradbushSFAI/tabletop-dm'
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: proof that the First Scene plays well and plays honestly. A harness runs a DM against scripted players with scripted dice. An auditor agent checks the transcript against the roll ledger and the DM doctrine. The milestone demo runs on it.

Why: decision-0021 idea 6. Play quality is judged from evidence, not impressions. The parked combat rules (TASK-0055) are decided from this card's evidence.

Demo: one human player plus AI companions play a scene with exploration, a social beat and a fight, to its end.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness runs a playtest with scripted dice and scripted players, and saves the transcript and the ledger.
- [ ] #2 An auditor agent checks the transcript against the ledger and the doctrine's right/wrong pairs, and writes a report.
- [ ] #3 The harness runs in CI against the fake gateway adapter, and on demand against a configured provider.
- [ ] #4 One human player plus AI companions play a scene with exploration, a social beat and a fight to its end.
- [ ] #5 The demo record lists every audit failure and how it was resolved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
