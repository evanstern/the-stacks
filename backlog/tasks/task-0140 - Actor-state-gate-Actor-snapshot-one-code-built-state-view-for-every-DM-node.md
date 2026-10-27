---
id: TASK-0140
title: 'Actor-state gate: Actor snapshot: one code-built state view for every DM node'
status: To Do
assignee: []
created_date: '2026-10-27 03:53'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies: []
priority: high
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: code builds an `ActorSnapshot` from the projections and the seed, and every DM node renders state from it. This is the first implementation card (TASK-0135 AC #4).

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U1). Dependencies as stated there: none. Scene presence fields are present but default to `present` until U2.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An `ActorSnapshot` type carries, per actor, id, display name, aliases, kind, controller, HP, life state, conditions, initiative, resources and scene presence; and the stage.
- [ ] #2 `assemble` builds S0 and `resolve` builds S1 plus the S0-to-S1 diff, with tests.
- [ ] #3 Director, interpret, adjudicate, narrate, audit, companion and chronicle prompts render state from the snapshot; `projectionEntries` and `npcNames` are retired.
- [ ] #4 Under the token cap, dead and absent actors compress to one line; no actor is dropped, with a test over a large party and encounter.
- [ ] #5 A snapshot that cannot fit fails the node loudly, with a test.
- [ ] #6 Existing dm tests and the scripted CI playtest stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
