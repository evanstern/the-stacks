---
id: TASK-0242
title: >-
  A hit's damage roll renders as 'no result', so the audit refuses every
  wounding narration
status: To Do
assignee: []
created_date: '2026-11-05 04:07'
updated_date: '2026-11-05 04:10'
labels:
  - dm
  - narration
  - playtest
  - bug
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an attack's damage roll reaches NarrationFacts as damage dealt (amount, type, target), so the narrator may show the wound and the audit does not call it unsupported.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 163-170). The goblin by the fire hit Tamsin (18 vs AC 16) for 4 piercing (13→9). All three narration attempts were refused: 'Damage roll shows no result in facts, but narration states 4 hit points…' / 'The damage roll is recorded as no result in facts, but the prose narrates a wound'. The fallback shipped. Cause: TASK-0104 (spec 082) submits hit damage as its own submission at key '<key>:dmg' with outcome null; prompts/narrate.ts rollEntry renders a roll with no outcome as '-> no result'. The narrate rule says 'Never show a wound unless a fact records damage', and the audit reads the 'no result' line as no damage. The hp.changed row (seq 166) is in the ledger but the roll line contradicts it. Every damaging hit hits this.

Related: TASK-0104 (spec 082), TASK-0214 (audit pass rate).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A damage roll's fact line states the damage dealt (amount and target), not 'no result', with a facts test replaying seq 163-166
- [ ] #2 A narration showing that wound passes the audit, with a scripted-audit test over seq 163-170
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Narrowed by run 1 seq 172-192: a PC's hit (Tamsin on Snag, seq 176-183) rendered its damage and passed the audit on attempt 1. The 'no result' line hits NPC-turn hits only (seq 163-170 goblin-4, seq 185-192 lookout): the NPC turn's ':dmg' submission reaches npcTurn facts with no outcome. Look at the npcTurn roll path in facts.ts, not the PC action path.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
