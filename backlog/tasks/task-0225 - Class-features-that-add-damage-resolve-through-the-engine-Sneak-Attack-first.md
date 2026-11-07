---
id: TASK-0225
title: Class features that add damage resolve through the engine (Sneak Attack first)
status: To Do
assignee: []
created_date: '2026-11-03 05:49'
updated_date: '2026-11-07 05:18'
labels:
  - engine
  - rules
  - dm
  - 'ws:engine'
milestone: m-12
dependencies:
  - TASK-0104
  - TASK-0058
priority: high
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: class features that add damage or change an attack, starting with the Rogue's Sneak Attack, resolve through the engine from the character's sheet and the SRD record, with their trigger rules (once per turn; finesse or ranged weapon; advantage, or an ally next to the target and no disadvantage).

Why: operator ruling 2026-11-02 on spec 082 (TASK-0104) OQ-1, in the operator's words: "I'm okay with stats-only as long as the rule for Sneak Attack is something that's going to come later. I don't want to miss it, and I think there's a better time to handle it (when we handle other abilities, maybe) but I do not want to lose it either". Spec 082 makes attack damage come only from the attack entry, so Kestrel's Sneak Attack, which the model's damage dice carried before, stops applying until this card lands.

When: with class abilities on PC sheets (TASK-0058, m-4), not before. Tripwire: every playtest after TASK-0104 merges records that Sneak Attack is off, and this card's status, until it is Done.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sneak Attack applies its SRD 5.2.1 damage through the engine when its trigger conditions hold, once per turn, with engine tests
- [ ] #2 At least one other damage-adding class feature resolves the same way, so the mechanism is general, not a Sneak Attack special case
- [ ] #3 Kestrel's seed sheet carries Sneak Attack, and a scripted attack replays it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
