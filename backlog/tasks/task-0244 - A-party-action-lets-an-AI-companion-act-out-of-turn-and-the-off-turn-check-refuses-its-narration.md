---
id: TASK-0244
title: >-
  A party action lets an AI companion act out of turn, and the off-turn check
  refuses its narration
status: In Progress
assignee: []
created_date: '2026-11-05 04:22'
updated_date: '2026-11-05 07:15'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in turn order, a party action that names a companion's act (a spell, an attack) waits for the companion's turn or is refused with a reason; and when an actor legitimately acts in a beat, the off-turn list does not name them.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 206-241). During Kestrel's turn the operator declared a party action 'Odo casts Cure Wounds on Tamsin.' It committed (group sign-off), resolved in the next beat during goblin-2's turn — spending Odo's slot and healing Tamsin — before Odo's turn came up. Odo then took his own turn and cast Healing Word: two actions for Odo in round 2. The narration audit refused all 3 attempts ('Brother Odo is on the Next line and has not acted yet… The narration shows him casting Cure Wounds') because the off-turn list (TASK-0214) still named Odo; the fallback shipped after 102 s.

Related: TASK-0214 (off-turn list), TASK-0205 (askUndeclared / party-scope rules), TASK-0208 (STEP_ACTOR_MISMATCH), TASK-0235.

Spec: specs/087-companion-own-turn
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In turn mode, a party action whose step's actor is a companion not currently active is held for that companion's turn or refused with a stated reason, with a test replaying seq 206-230
- [x] #2 The off-turn list excludes any actor with a resolved step in this beat, with a facts test
- [x] #3 Spec phase: Hold or refuse in the plan gate and resolve (US1; FR-001 to FR-005)
- [x] #4 Spec phase: Facts and the waiting line (US1, US2; FR-006 to FR-010)
- [x] #5 Spec phase: Replay seq 206-230 and contracts (US1; card AC #1, FR-011)
- [x] #6 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0244, branch task-0244-companion-own-turn, cut from origin/main 8128fb3a. Spec number 087 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 087 authoring, C1)

Spec 087 (ef631484). A party action whose only actor is an off-turn AI companion is held (stays committed, a Waiting: fact line) and released as that companion's turn action via a new 'held' job trigger; a mixed-actor party action naming an off-turn companion is refused STEP_ACTOR_MISMATCH (off-turn). Any actor a step names is on turn for the off-turn list. Defaults (a): OQ-1 hold, refuse only mixed; OQ-2 human PCs unchanged (carded separately); OQ-3 the hold lapses if the companion drops or the encounter ends; OQ-4 refuse, never split; OQ-5 the waiting line repeats. Footprint adds jobs.ts, worker.ts, prompts/narrate.ts; drops floor-state.ts.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 087 phases 1-2, grouped). narrate-v20. One existing test (opposition-and-help, unused assist) re-scripted: its party help named Kestrel off turn; Kestrel is an unseated, so AI-companion, character in that world, so the hold is correct (orchestrator verified).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 087 phases 3-4, grouped: replay and wiki)

Spec 087 built (tasks.md all ticked). AC #1: companion-own-turn.integration.test.ts holds the party cast for Odo's turn and Odo acts once in round 2 (initiative scripted Tamsin then Odo, a simplification of the seq 206-230 order); mixed-actor party action refused off-turn. AC #2: step actors are on turn in the off-turn list (facts test).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
