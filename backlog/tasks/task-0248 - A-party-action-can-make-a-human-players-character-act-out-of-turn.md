---
id: TASK-0248
title: A party action can make a human player's character act out of turn
status: To Do
assignee: []
created_date: '2026-11-05 06:42'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies: []
references:
  - specs/087-companion-own-turn/spec.md
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in turn order, a party action whose step names another human player's character who is not on turn is held or refused, as spec 087 does for AI companions, so no character acts twice in a round.

Why: spec 087 (TASK-0244) OQ-2 default leaves human-PC party actions unchanged: a party action naming an off-turn human PC still resolves at once, so that PC can act twice in a round (the TASK-0244 bug, for humans). Held back because a human holds their own turn and consent; the rule needs the operator's call (hold, refuse, or ask that player).

Related: TASK-0244 (spec 087), TASK-0205 (party scope), TASK-0199 (one chat stream asks players to confirm).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In turn order, a party action whose step's actor is an off-turn human PC is held, refused with a reason, or confirmed by that player, per the operator's ruling, with a test
- [ ] #2 No character resolves two turn actions in one round through a party action, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
