---
id: TASK-0241
title: 'Party characters carry pronouns, and narration uses them'
status: To Do
assignee: []
created_date: '2026-11-05 04:03'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - narration
  - seed
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: each seed party character (and NPC) states the pronouns to use, the narrate and companion prompts receive them, and narration never guesses.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 131): the narration called Kestrel 'he' twice; the seed gives no pronoun, so the model guessed. A player's character's pronouns are the player's to set.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The seed character and NPC schema carry an optional pronouns field, the shipped seeds fill it, and the player-facing seed views pass it to narrate and companion prompts, with a test
- [ ] #2 With no pronouns set, the narrate prompt instructs the narrator to use the character's name (or they/them), never to guess, with a prompt test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 seq 220: Kestrel 'he/him' three more times.

Merged into TASK-0058 by replan-2026-11. Pronouns on the PC entity.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
