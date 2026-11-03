---
id: TASK-0211
title: Casting a spell spends no slot and uses model-written healing dice
status: In Progress
assignee: []
created_date: '2026-11-02 23:19'
updated_date: '2026-11-03 08:33'
labels:
  - dm
  - rules
  - playtest
  - engine
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: medium
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a DM-resolved spell spends its slot through the engine (spell-slot.expend), is refused when no slot is left, and takes its dice from the SRD spell record, not the model.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653). Odo cast Cure Wounds twice (seq 143 and seq 207, the second reviving Kestrel from 0 HP). The engine's life-state and condition handling was correct: unconscious and condition 'unconscious' (hp-zero) on the drop, then conscious and the condition removed (cause healed) on the heal. But: (1) neither cast emitted spell-slot.expend. Odo began with 2 first-level slots (seq 5) and still holds 2 after both casts, though interpret's own reason says 'Odo spends his last 1st-level slot'. Interpret's step schema has no slot-spend step (dm/nodes/schemas.ts), though the engine has spell-slot.expend. (2) Both heals rolled the model-written '1d8+3'. SRD 5.2.1 Cure Wounds (p. 121) is 2d8 + spellcasting modifier. The heals came out 5 and 8; by the rules they would be 2d8+3. The operator liked the beat and asked to check it 'all checks out behind the scenes'.

Related: TASK-0104 (engine-derived modifiers and DCs; the same model-written-number problem for spells), TASK-0058 (PC sheets / spell lists).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A spell step spends a slot of its level via the engine, and a cast with no slot left is refused, with a test replaying seq 204-210
- [ ] #2 A named SRD spell's dice come from its SRD record (Cure Wounds 2d8 + modifier), not a model expression, with a test
- [ ] #3 Narration never states a slot was spent unless the engine spent it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split with TASK-0105 (spec 083 OQ-1 a, 2026-11-03): 0105 delivers AC #2 (Cure Wounds 2d8 + modifier from the SRD record) and the slot spend with NO_SLOT_AVAILABLE refusal. 0211 keeps the seq 204-210 replay test (AC #1) and AC #3 (narration never states a slot was spent unless the engine spent it).

Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0211, branch task-0211-spell-slot-narration, cut from origin/main ff1eb0ed. No spec dir: signed escape line covers this task. Spine #16. Most of the card delivered by TASK-0105 (#124); remaining AC #1 replay and AC #3 under a card-ACs-drive line (see runbook amendment).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
