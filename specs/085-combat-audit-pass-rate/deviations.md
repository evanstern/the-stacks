# Deviations: spec 085 against HEAD

Seam check on 2026-11-03 against main after TASK-0128 (#128). No seam changed meaning.

- **Versions.** Main holds narrate-v17, audit-v11, director-v6 (plan assumed v16, v10, v6). This task bumps narrate to v18, audit to v12, director to v7.
- **Assist facts (TASK-0128).** `describeChange` and `FactChange` gained an `assist` kind. `offTurn` reads rolls and actions only, so assist facts do not touch it.
- **audit-v11 rule 1.** TASK-0128 already added "Words, moves and feelings of every other character are the world's, never `player-agency`." Phase 2 appends only the `actor` sentence to rule 1.
- **Line positions.** RULES lines 36, 42 and 47 moved; edits match by text, not line number.
- **Check placement.** `offTurnActs` runs right after the `checkClaims` loop in `deterministicChecks`, before the agency checks. Order does not change any outcome: every issue blocks.
