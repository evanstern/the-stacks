---
id: TASK-0208
title: >-
  A player's move rolls an enemy's opportunity attack as the player's own step,
  with no reaction rule
status: Done
assignee: []
created_date: '2026-11-02 23:11'
updated_date: '2026-11-03 03:57'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an opportunity attack happens only by the engine's reaction rule (leaving a hostile's reach, with its reaction unspent), on the enemy's side, and the player reads it as the enemy's reaction, not as their own action 'striking home'.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 151-161). Kestrel declared 'I run to Pell and attempt to free him.' The Director's goal note said 'charge costs an opening (reaction swing) before she arrives'. Interpret then made the action's only step an attack by goblin-2 on Kestrel (1d20+4 → 19 = 23 vs AC 14, hit, 4 slashing), and parked the actual free as a followUp. So: (1) the opportunity attack was a model choice, not an engine rule; no reaction was tracked, and nothing checked that Kestrel left the goblin's reach; (2) it took the place of the player's action, and the free never resolved; (3) the fallback read 'Kestrel dashes … Kestrel strikes home. Kestrel is wounded.', giving the hit to the wrong subject; (4) the next NPC turn's narration (Snag, seq 166) then showed 'Kestrel's blade finds the rope … a strand parting', a free that never resolved. The operator asked: 'was that a ruling that the pot-helm goblin got an attack of opportunity?'

Related: TASK-0104 (engine-derived numbers), TASK-0205 (DM invents the player's method), TASK-0193 (fallback wording).

Spec: specs/079-engine-opportunity-attack
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opportunity attacks come from an engine reaction rule (leaving reach, reaction unspent), never from an interpret step on the mover's own action, with a test
- [ ] #2 A player's action resolves its own declared step (here, the free attempt); an enemy reaction is a separate event
- [ ] #3 The fallback names the attacker as the subject of an attack's outcome ('The pot-helm goblin strikes home'), with a test replaying seq 154-161
- [ ] #4 Narration never shows a followUp ('not yet attempted') as done, in a later beat either
- [x] #5 Spec phase: The engine owns reactions (card AC #1, engine part; US1 scenarios 3 and 4)
- [x] #6 Spec phase: A move away draws the engine's reaction (card AC #1 and #2, merge condition; US1, US2)
- [x] #7 Spec phase: The reader sees whose attack it was (card AC #2 and #3; US2 scenario 4, US3)
- [x] #8 Spec phase: A followUp stays undone in later beats (card AC #4; US4)
- [ ] #9 Spec phase: Wiki upkeep
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0208, branch task-0208-engine-opportunity-attack, cut from origin/main fbf4d1df. Spec number 079 claimed with a stub. Spine #7.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 079 authoring, C1)

spec-bridge sync: The engine owns reactions (card AC #1, engine part; US1 scenarios 3 and 4): 0/8 · A move away draws the engine's reaction (card AC #1 and #2, merge condition; US1, US2): 0/12 · The reader sees whose attack it was (card AC #2 and #3; US2 scenario 4, US3): 0/11 · A followUp stays undone in later beats (card AC #4; US4): 0/8 · Wiki upkeep: 0/5

Spec 079 (01ca6abd). Defaults (a) taken: OQ-1 interpret names the hostiles left (leavesReachOf), no engagement fact; OQ-2 code always takes an NPC's reaction; OQ-3 no reaction taken for a party member (carded); OQ-4 reuse spec 077's refusal path, else STEP_ACTOR_MISMATCH; OQ-5 no fallback change for open followUps, the playtest watches it; OQ-6 spell and trait reactions out of scope (carded).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 079 phases 1-2)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 079 phases 3-4)
OQ-4 result: STEP_ACTOR_MISMATCH added (plan-gate only); spec 077 had no refusal to reuse.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5 (spec 079 phase 5, wiki)
AC #4 coverage note: the open-followUp line is unit-tested at the facts and narrate-prompt seam (follow-ups.test.ts, facts, narrate). No DB turn-level test. Runbook B's playtest scenario adds a row for a followUp left open across beats (spec 079 OQ-5 watch item).

Phase 5: haiku pass stopped after one note (prose judgment over 12 stale notes); re-dispatched at the default tier.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 079 phase 5, wiki)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The engine owns reactions (card AC #1, engine part; US1 scenarios 3 and 4): 8/8 · A move away draws the engine's reaction (card AC #1 and #2, merge condition; US1, US2): 12/12 · The reader sees whose attack it was (card AC #2 and #3; US2 scenario 4, US3): 11/11 · A followUp stays undone in later beats (card AC #4; US4): 8/8 · Wiki upkeep: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
