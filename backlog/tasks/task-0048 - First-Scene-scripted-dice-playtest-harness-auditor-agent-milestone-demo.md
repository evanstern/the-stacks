---
id: TASK-0048
title: 'First Scene: scripted-dice playtest harness, auditor agent, milestone demo'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 09:43'
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

Spec: specs/032-playtest-harness
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness runs a playtest with scripted dice and scripted players, and saves the transcript and the ledger.
- [ ] #2 An auditor agent checks the transcript against the ledger and the doctrine's right/wrong pairs, and writes a report.
- [ ] #3 The harness runs in CI against the fake gateway adapter, and on demand against a configured provider.
- [ ] #4 One human player plus AI companions play a scene with exploration, a social beat and a fight to its end.
- [ ] #5 The demo record lists every audit failure and how it was resolved.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 5) after TASK-0046 (#49) and TASK-0047 (#47) merged. Worktree .worktrees/task-0048, branch task-0048-playtest, cut from origin/main 718d738. Spec number 032 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
