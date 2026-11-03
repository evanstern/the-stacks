---
id: TASK-0206
title: >-
  An NPC the narration reveals stays absent and out of combat, so acting on it
  is refused
status: Done
assignee: []
created_date: '2026-11-02 22:42'
updated_date: '2026-11-03 03:13'
labels:
  - dm
  - playtest
  - presence
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when the DM puts an NPC on screen, the state agrees. The NPC becomes present, and an attack on a present hostile from the seed's encounter starts that encounter (or pulls the NPC in), instead of being refused.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653). The reed-camp seed starts Pell and Snag absent (seq 11-12, scene-presence removed). The Director then revealed both (seq 40: 'a goblin perched on a mud bank … Snag', 'lashed to the post … Pell'), but no event set either present and no encounter started. Kestrel's 'I take aim and shoot at Snag' (seq 45) was refused by the plan gate: UNKNOWN_COMBATANT, targetId snag, not-a-combatant. Snag is in the seed's reed-camp encounter (goblin-warrior). The chronicle then wrote 'Pell Marsh and Snag have since departed' (seq 51), read from the stale absent state. The operator's reading: the DM's idea of who is in the area, and who is in combat, is wrong, which limits valid targets.

Related: TASK-0194 (non-combatant targets, merged: it pulls present non-combatants into checks, but not absent NPCs or attacks), TASK-0142 (seed presence), TASK-0145 (Director legality over actor state), TASK-0172 (knowledge ledger), TASK-0201 (objects).

Spec: specs/078-revealed-npc-present
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Director or narration reveal of a seed NPC records it present (scene-presence event), with a test replaying seq 40
- [ ] #2 An attack on a present hostile NPC that belongs to a seed encounter starts that encounter (or joins it to initiative) and resolves, with a test replaying seq 45
- [ ] #3 The chronicle never calls a revealed, present NPC departed
- [x] #4 Spec phase: The Director's arrivals, resolve and the plan gate (card AC #1, #2)
- [x] #5 Spec phase: The chronicle and the run 1 seq 40–45 replay (card AC #1, #2, #3; merge condition)
- [x] #6 Spec phase: Wiki re-ground
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 seq 63-89: once the reed-camp encounter started (seq 76, after Odo's parley), Snag became a combatant and 'I shoot at Snag' resolved (miss 7 vs AC 15). The gap is the reveal before the encounter starts.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0206, branch task-0206-revealed-npc-present, cut from origin/main fbf4d1df. Spec number 078 claimed with a stub. Spine #6.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 078 authoring, C1)

spec-bridge sync: The Director's arrivals, resolve and the plan gate (card AC #1, #2): 0/9 · The chronicle and the run 1 seq 40–45 replay (card AC #1, #2, #3; merge condition): 0/7 · Wiki re-ground: 0/6

Spec 078 (4acaf437). Defaults (a) taken: OQ-1 reveal detected by a structured Director field (arrivals); OQ-2 code never starts an encounter on an attack (Director may, and that path now resolves); OQ-3 talk-turn reveals out of scope; OQ-4 narrate still lists offstage NPCs as gone. OQ-3 (b) and OQ-4 (b) are maybes: no card unless the playtest shows them. Implementation waits for TASK-0113 to merge (shared prompts/director.ts hunk; director-v6).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 078 phases 1-2)
Spine amendment: 0206 builds in parallel with 0205 (both touch plan-gate.ts in separate functions; runner.ts only 0205). 0205 merges first.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5 (spec 078 phase 3, wiki)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The Director's arrivals, resolve and the plan gate (card AC #1, #2): 9/9 · The chronicle and the run 1 seq 40–45 replay (card AC #1, #2, #3; merge condition): 7/7 · Wiki re-ground: 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
