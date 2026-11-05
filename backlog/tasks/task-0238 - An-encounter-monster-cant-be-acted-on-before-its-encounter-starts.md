---
id: TASK-0238
title: An encounter monster can't be acted on before its encounter starts
status: Done
assignee: []
created_date: '2026-11-05 03:56'
updated_date: '2026-11-05 08:04'
labels:
  - dm
  - playtest
  - presence
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a seed encounter's monsters (goblin-2/3/4 in reed-camp) can be targeted, opposed or talked to before the encounter starts, once the fiction puts them on screen: they become present actors the plan gate can resolve and pull in.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 52-60). The narration put 'the lookout by the fire' on screen (seq 51). Odo declared a parley with it. Interpret made a Persuasion check opposed by 'goblin-lookout' (influence rule, TASK-0128). The plan gate refused the whole action: UNKNOWN_COMBATANT, field difficulty.opposedBy, id goblin-lookout, reason not-in-snapshot. The seed's lookout is encounter monster goblin-3 ('Goblin lookout'); encounter monsters are not snapshot actors until the encounter starts, so there was no id interpret could name. The narration then voiced the parley's failure anyway (seq 60) though nothing resolved. TASK-0206 makes seed NPCs present on a reveal, and TASK-0210 pulls present non-combatants in, but neither covers encounter monsters.

Related: TASK-0206, TASK-0210, TASK-0128, TASK-0201 (objects as targets).

Spec: specs/088-pre-encounter-monster
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A revealed encounter monster is a snapshot actor interpret can name by its combatantId (or the gate maps a display name to it), with a test replaying seq 52-58
- [x] #2 Acting on it before the encounter starts resolves (pull-in or encounter start per the Director), and the opposition check rolls, with a test
- [x] #3 When the plan gate refuses an action, the narration does not voice the refused attempt's outcome as if it resolved, with a test
- [x] #4 Spec phase: Seam check (no source change)
- [x] #5 Spec phase: Monster arrivals, runnable encounters and the interpret section (card AC #1, #2)
- [x] #6 Spec phase: A refused action is not narrated as done (card AC #3)
- [x] #7 Spec phase: The run 1 replays (merge condition; card AC #1, #2, #3)
- [x] #8 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 seq 73-92: Odo's second parley (coin to the lookout) refused UNKNOWN_COMBATANT although the Director started the reed-camp encounter in the same beat (seq 90: goblin-3 'Goblin lookout' became a combatant). Same-beat encounter start does not make the monsters nameable for that beat's plan gate. Spec 078 fixed this for seed NPCs (arriving ids not absent) but not for encounter monsters. The narration voiced the refused coin toss (seq 94).

Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0238, branch task-0238-pre-encounter-monster, cut from origin/main 8128fb3a. Spec number 088 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 088 authoring, C1)

Spec 088 (072a4054). Reuses spec 078 arrivals: the Director may arrive a not-yet-appeared encounter monster (free mode); resolve adds it as a combatant before actions run; the plan gate accepts it via joining; held by combatantId afterwards (snapshot/build.ts untouched). Encounter startability becomes 'has the encounter run', so an early monster does not block reed-camp. Seq 73-92: interpret gets an 'Arriving this beat' section. AC #3: refused fact line says it did not happen; narrate rule; fallback adds no change line. Defaults (a) on OQ-1..OQ-4; the (b) alternatives are carded as one revisit task.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 088 phases 1-3, grouped). Seam check: no seam moved. director-v9, interpret-v15, narrate-v21. Fix: a seed NPC that is also an encounter monster (snag) stays on the 078 path.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 088 phases 4-5, grouped: replays and wiki)

Spec 088 built (tasks.md all ticked). Replays seq 52-58 and 73-92 (unseen, arrived earlier, one-beat) roll the opposed check with no UNKNOWN_COMBATANT; control keeps the refusal and narrates 'it did not happen'. Mutation guard D10 #2 (fresh load before encounter start) is not killable: the arrivals loop's existing duplicate-add skip already covers it; recorded in the commit. Seq 73-92 refused id stays inferred (plan R2). Orchestrator re-ran REQUIRE_DATABASE=1 ci:check on the final tree: green (1838 passed).

spec-bridge sync: Seam check (no source change): 5/5 · Monster arrivals, runnable encounters and the interpret section (card AC #1, #2): 9/9 · A refused action is not narrated as done (card AC #3): 5/5 · The run 1 replays (merge condition; card AC #1, #2, #3): 6/6 · Wiki re-ground: 6/6 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #138 (6ab16240), runbook B2 spine #5. All spec 088 tasks complete (Seam check 5/5 · Monster arrivals 9/9 · Refused action not narrated 5/5 · Run 1 replays 6/6 · Wiki 6/6). Derived Done by spec-bridge sync. A revealed encounter monster arrives through the Director's arrivals and is nameable by combatantId; an encounter stays startable until it has run; a refused action is told as not done. Revisit TASK-0249.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
