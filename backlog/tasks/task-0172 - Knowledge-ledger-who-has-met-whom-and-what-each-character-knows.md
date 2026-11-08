---
id: TASK-0172
title: 'Knowledge ledger: who has met whom and what each character knows'
status: To Do
assignee: []
created_date: '2026-10-28 19:40'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - rules
  - 'ws:memory'
milestone: m-11
dependencies:
  - TASK-0148
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: high
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the session tracks, per character, who that character has met and which information items they know. Narration and adjudication read it, so the DM treats known NPCs as known, introduces strangers, and scales what a check reveals by what the actor already knows.

Why: two-browser alpha playtest 2026-10-28, items 6 and 7 (operator idea). Wenna was used as a familiar figure without an introduction. The operator asked for a basic DM tool: a list of what each character knows, which informs narration, actions and outcomes.

Builds on TASK-0148, which adds ids to seed information and an info.revealed fact with recipients and the party's known set. This card adds:
- a met fact (an actor becomes known to a character or the party),
- starting knowledge per PC in the seed (known items, NPCs already met),
- known sets per character as projections, not only per party,
- readers: the narrator's fiction view and the scene-start opening (TASK-0171) see who has met whom; interpret sees the acting character's known set when it writes a check's outcomes (TASK-0170).

Operator rulings 2026-10-28: prior knowledge changes the content of a result, and may grant advantage when clearly relevant; it never changes the DC (TASK-0104 owns DCs). NPC learning during play is in scope as its own card, which depends on this one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A met fact records that an actor became known to named characters or the party, and a projection holds each character's met set, with tests
- [ ] #2 The seed lets each party character declare starting known items and NPCs already met, and the loader validates the ids
- [ ] #3 A projection holds each character's known information set from info.revealed recipients and seed starting knowledge, with a test
- [ ] #4 The narrator's fiction view marks each present NPC as met or unmet by the party, and a test shows an unmet NPC gets introduced
- [ ] #5 Interpret receives the acting character's known set, and a check's declared success outcome can give more detail when the actor already holds a related item, with a test
- [ ] #6 A clearly relevant known item may set the roll mode to advantage, and never changes the DC, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
