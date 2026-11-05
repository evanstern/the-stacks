---
id: TASK-0246
title: >-
  The off-turn code check misses non-attack verbs, so the model audit blocks
  them instead
status: To Do
assignee: []
created_date: '2026-11-05 05:12'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an off-turn actor shown making a non-attack turn move (turning its head, shifting its grip, drawing back for another try) is caught by the deterministic off-turn check before the model audit, so the regenerate is targeted and costs no audit call; and a passive verb that is not a turn action (watches, waits) is not blocked at all.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 96-124 and later; recorded on TASK-0214). The off-turn check (claims.ts, TURN_ACT_VERBS in audit-words.ts, TASK-0214 / spec 085) knows only strike/shoot/cast-class verbs. 'turning its head', 'draws back for another try' and 'shifts its grip' slipped past it, and the model audit then refused those narrations, burning attempts. Carded as amendment A1 of docs/design/m3-runbook-b2-playtest-fixes.md (operator sign-off 2026-11-05: 'Signed off, start').

Related: TASK-0214 (spec 085), TASK-0240 (reflex list, same file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The off-turn check blocks an off-turn actor shown readying or repositioning for its next action (e.g. 'draws back for another try', 'shifts its grip'), with a test per run 1 phrase
- [ ] #2 A passive or perceptual verb (watches, waits, turns its head toward the noise) on an off-turn actor is allowed by the code check and the audit prompt states it is not a turn action, with a test
- [ ] #3 A replay of the run 1 refusals that named these phrases passes or regenerates without a model-audit call, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
