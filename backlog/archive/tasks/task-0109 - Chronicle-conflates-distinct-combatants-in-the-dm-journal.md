---
id: TASK-0109
title: Chronicle conflates distinct combatants in the dm journal
status: To Do
assignee: []
created_date: '2026-10-26 19:15'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - chronicle
  - replan-2026-11
milestone: m-3
dependencies: []
priority: medium
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the chronicle's journal entries name each combatant as the ledger does and never merge two creatures into one.

Evidence: TASK-0106 verification run 20261026T183818Z (specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/). Journal row 176, written by dm.chronicle (haiku), says 'a pot-helm goblin named Snag', merging Snag with the goblin in the pot-helm. The narration had them as two creatures, and the playtest auditor reported F32 as a ledger contradiction against the wrong journal. Operator ruling 2026-10-26: card it; it does not count against TASK-0106's narration bar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The chronicle prompt receives each combatant's id and display name, and a test proves two combatants are rendered as distinct
- [ ] #2 A regression test over row 176's inputs shows the journal names Snag and the pot-helm goblin separately
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 3 evidence (2026-11-02, session e8e8326d, seq 220): the chronicle called Snag 'the ferryman' (Snag is the goblin leader); seq 195 also mixed up which goblin acts next. Same family as this card's conflation.

Runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 41): the chronicle says 'Wenna Marsh revealed the true concern' for clawed prints Kestrel found (seq 40). Attribution, not combatant merging, but the same journal-accuracy family.

Run 1 seq 55: the chronicle calls Pell Wenna's 'son'; the seed and seq 13 say grandson.

Run 1 seq 201: chronicle says 'Brother Odo cast Cure Wounds on her' after Tamsin only asked in talk (seq 196); nothing was cast.

Run 1 seq 330, 351: narration says 'Pell still bound' after he was freed (seq 216-220) and 'calling her brother's name'; the chronicle invents 'Pell Marsh was complicit in the scheme to silence the ferry bell' and calls him 'the ferryman'. The chronicle is writing motives the fiction never established.

Merged into TASK-0084 by replan-2026-11. Chronicle keys entries on entity ids.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
