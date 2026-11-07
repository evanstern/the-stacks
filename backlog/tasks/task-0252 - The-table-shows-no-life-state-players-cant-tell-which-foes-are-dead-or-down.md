---
id: TASK-0252
title: 'The table shows no life state: players can''t tell which foes are dead or down'
status: To Do
assignee: []
created_date: '2026-11-07 03:00'
labels:
  - ux
  - web
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
  - docs/design/mud-ux/decision.md
priority: high
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every player sees, at a glance and as text, which characters and foes are conscious, down, stable or dead, so nobody declares an action against a corpse.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc, seq 134 and 176-182). Tamsin killed the goblin with a pot-helm (seq 134, life-state dead), and the fallback narration was the only place that said so. Two beats later she declared 'I attack the goblin with a pot-helm with my sword' (seq 176); it resolved no-effect and the narration had to explain the goblin was already dead. Operator: 'The real issue is there's no way to easily tell what's dead or alive or where any character is in relation to another (the latter will come with the VTT)'. Code check: the play view never renders lifeState (only debug/components/state-column.tsx reads it); turn-order.tsx shows names and conditions only. Spec 090's margin covers party HP and AC, the turn order and conditions, but no life state for foes.

Positions are out of scope here: they come with the map (TASK-0239, m-6).

Related: TASK-0236/spec 090 (table margin), TASK-0164 (party slide-out), TASK-0239 (map), TASK-0247 (MUD stream).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The margin's turn order and the 390 px mini-strip mark each combatant's life state (down, stable, dead) in words, from session events
- [ ] #2 A dead or removed foe is visibly out of the fight (struck or listed apart) until the encounter ends
- [ ] #3 The stream carries a text line when a character's life state changes, for screen-reader parity (decision constraint)
- [ ] #4 Hidden information holds: a foe's HP numbers are not shown to players unless a ruling says so
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
