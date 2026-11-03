# Deviations from plan.md (build-time seam check, 2026-11-02)

Seam check against merged spec 070 (origin/main): the seams moved, none changed meaning.
`StakesSchema`, `consequenceFor` (stakes.ts), `FactRoll.consequence` (optional), `Submission.stakes`
and `stakesByBatch` (facts.ts) exist as plan.md D1-D4 assume. Versions on main: interpret-v8,
adjudicate-v6, narrate-v11, audit-v7; bumps are v9, v7, v12, v8.

## Phase 1

- **Fixture files beyond plan.md's list:** `test/dm/stakes-audit.test.ts`, `stakes.test.ts`,
  `plan-gate.test.ts`, `facts.test.ts`, `world.ts` (the shared `checkStep()` builder, not helpers.ts)
  also held `success: null`; each gains a concrete success text. `stakes.test.ts` and `facts.test.ts`
  null assertions on `success` are rewritten in Phase 2.
- **Clue reference example** in the prompt uses `ford-crossing#1` (a generic example, not a seed id).
