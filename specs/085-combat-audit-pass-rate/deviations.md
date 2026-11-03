# Deviations: spec 085 against HEAD

Seam check on 2026-11-03 against main after TASK-0128 (#128). No seam changed meaning.

- **Versions.** Main holds narrate-v17, audit-v11, director-v6 (plan assumed v16, v10, v6). This task bumps narrate to v18, audit to v12, director to v7.
- **Assist facts (TASK-0128).** `describeChange` and `FactChange` gained an `assist` kind. `offTurn` reads rolls and actions only, so assist facts do not touch it.
- **audit-v11 rule 1.** TASK-0128 already added "Words, moves and feelings of every other character are the world's, never `player-agency`." Phase 2 appends only the `actor` sentence to rule 1.
- **Line positions.** RULES lines 36, 42 and 47 moved; edits match by text, not line number.
- **Check placement.** `offTurnActs` runs right after the `checkClaims` loop in `deterministicChecks`, before the agency checks. Order does not change any outcome: every issue blocks.

## Phase 2 decisions

- **Drop runs before the 0204 check, in `narrateAttempt`.** The audit sees the shortened prose, so a trailing "What do you do?" no longer costs a regenerate. TASK-0204's check in `deterministicChecks` stays and now uses `STOCK_ENDING`. It still blocks prose where no earlier sentence end precedes the phrase (the drop declines) and any clarify ending. The drop never weakens the block: it only rewrites prose the block would have refused, and what it cannot rewrite still reaches the block.
- **Clarify beats skip the drop.** When `facts.clarify` is non-empty, `narrateAttempt` leaves the prose whole. The clarify question must end the prose (0209), and 0204's tests pin that a clarify question ending on the literal phrase blocks.
- **Quoted stock line.** `dropStockEnding` also strips an opening quote left before the dropped sentence (`"What do you all do?"`).
- **Count-withheld note kind.** The advisory issue is `doctrine`, as plan D7 says. A note that `checkClaims` already refutes keeps its `ledger-mismatch` entry and gets no second one.
