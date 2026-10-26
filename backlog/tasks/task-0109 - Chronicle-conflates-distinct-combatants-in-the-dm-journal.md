---
id: TASK-0109
title: Chronicle conflates distinct combatants in the dm journal
status: To Do
assignee: []
created_date: '2026-10-26 19:15'
labels:
  - dm
  - chronicle
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
