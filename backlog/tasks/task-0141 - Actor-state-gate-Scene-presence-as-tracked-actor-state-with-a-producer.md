---
id: TASK-0141
title: 'Actor-state gate: Scene presence as tracked actor state, with a producer'
status: In Progress
assignee: []
created_date: '2026-10-27 03:53'
updated_date: '2026-10-27 12:48'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0112
priority: high
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an actor's scene presence (`present`, `yielded`, `absent`) is a logged fact, and only a resolved step can change it.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U2). Dependencies as stated there: U1.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.

Spec: specs/048-scene-presence
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A catalogued event records a scene presence change with actor id, new value and reason (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`).
- [ ] #2 The snapshot reads scene presence from the log.
- [ ] #3 No Director field writes scene presence, with a test.
- [ ] #4 The declare gate refuses an absent character with CHARACTER_UNABLE (details.reason absent) and a test (decision-0025 §3.1; moved from TASK-0112 by the 2026-10-27 operator ruling, Option A)
- [ ] #5 A plan gate refuses a step whose actor or target is absent in S0, with a test and its engine/refusal code ruled in this card (decision-0025 §3.2; moved from TASK-0112, Option A)
- [ ] #6 A presence effect lets interpret and adjudicate propose a presence change, including under a roll outcome; the gate applies it only through a scene-presence proposal (policy ask), with tests (OQ-1 (a), OQ-2 (a), operator ruling 2026-10-27).
- [ ] #7 An `absent` combatant leaves the encounter order through an engine command (`initiative.leave`, which keeps its state) (OQ-3 (a), operator ruling 2026-10-27).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope added 2026-10-27 by the operator's TASK-0112 ruling (sequencing Option A): both absent checks move here; depends on TASK-0112.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0141, branch task-0141-scene-presence, cut from origin/main a17d0b9. Spec number 048 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C6 (runbook amendment 1); carries the two absent checks moved from TASK-0112 (Option A).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
The spec author stopped after spec.md (95b1b52). DEVIATION: spec.md was written by hand to the Spec Kit template, not through speckit-specify, because the spec dir already existed. plan and tasks must use the skills. Finding: the engine's combatant.remove refuses an encounter member (COMBATANT_IN_ENCOUNTER) and deletes state, so AC #3 cannot be met as worded.
OPERATOR RULINGS NEEDED (defaults first):
OQ-1: (a) new event scene-presence.changed v1 {actorId, before, after, reason, actionId}, written through a new DM proposal kind scene-presence (policy ask). Amends frozen 029 proposals.md, policy-and-authority.md and gate-api.md §1, plus 028 additively. / (b) engine-held presence via mechanics / (c) a field on action.resolved.
OQ-2: (a) a presence effect usable in effect steps and under onSuccess/onFailure/onHit / (b) a new step kind.
OQ-3: (a) new engine command initiative.leave that keeps combatant state, with AC #3 amended to 'through an engine command' / (b) let combatant.remove drop an encounter member.
OQ-4: (a) reuse UNKNOWN_COMBATANT with plan-gate reason absent / (b) new engine code ACTOR_ABSENT (28 codes) / (c) reuse ACTOR_UNABLE.
OQ-5 (no ruling needed): yielded cannot return to present in this card.

Operator ruling 2026-10-27 (in chat, verbatim; the message ended after OQ-2): "TASK-0141 OQ-1 (a) scene-presence.changed via a new scene-presence proposal kind including the frozen 029 and 028 amendments, OQ-2 (a)". OQ-1 resolved (a). OQ-2 resolved (a). OQ-3 and OQ-4 not yet ruled; plan.md waits on them.

Operator ruling 2026-10-27 (in chat, verbatim): "TASK-0141: I accept OQ-3 (a) engine initiative.leave with AC #3 reworded to \"through an engine command\", and OQ-4 (a) reuse UNKNOWN_COMBATANT with reason absent." All OQ-1 to OQ-4 resolved (a). AC #3 reworded per the ruling. AC #2 reworded to match OQ-2 (a) (a presence effect, not a step kind). Both moved to the end of the list by the CLI. AC #7 code: UNKNOWN_COMBATANT, reason absent (OQ-4 (a)).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
