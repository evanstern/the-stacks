---
id: TASK-0173
title: NPCs learn what the party tells and shows them during play
status: To Do
assignee: []
created_date: '2026-10-28 19:40'
labels:
  - dm
  - rules
milestone: m-3
dependencies:
  - TASK-0172
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: medium
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a party character tells, shows or gives an NPC something during play, an NPC-recipient knowledge fact records it. That NPC's later dialogue, decisions and attitude follow from what it actually knows. An NPC never acts on something the party never revealed to it.

Why: two-browser alpha playtest 2026-10-28, item 7. The operator ruled that NPC knowledge must be carded now, not deferred: longer campaigns with more characters will depend on it.

Shape: extends TASK-0172's knowledge ledger to NPC recipients. Interpret or resolve proposes a knowledge fact when a party character's talk or action conveys information to a present NPC (who heard it, what, from whom). Witnesses count: an NPC present for a public conversation can learn from it. The Director, interpret and the companion and NPC voice read each NPC's known set (seed hooks.knows plus learned items). The claim gate refuses NPC speech that relies on information the NPC has not learned.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A knowledge fact can name NPC recipients, a source character and the conveyed content, and a projection holds each NPC's learned set, with tests
- [ ] #2 Resolve proposes a knowledge fact when party talk or action conveys information to a present NPC, including NPCs present for public talk, with a test over a captured run
- [ ] #3 DM-side prompts that voice or decide for an NPC receive that NPC's seed knowledge plus its learned set
- [ ] #4 The output claim gate refuses NPC speech that states party information the NPC has not learned, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
