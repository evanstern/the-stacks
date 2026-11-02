---
id: TASK-0212
title: Downed-character fallback repeats 'falls unconscious'
status: To Do
assignee: []
created_date: '2026-11-02 23:19'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: low
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the fallback names a life-state change once.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 191-196). The pot-helm goblin's hit took Kestrel 5 → 0 HP. The engine emitted life-state.changed (conscious → unconscious) and condition.applied (unconscious, hp-zero). The fallback rendered each as its own sentence: 'Kestrel is wounded. Kestrel falls unconscious. Kestrel falls unconscious.'

Where: apps/server/src/dm/fallback.ts — collapse a life-state change and its hp-zero condition into one sentence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A drop to zero renders 'falls unconscious' once, with a test replaying seq 189-196
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
