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

## Phase 2

- **`Submission.reveals` / `revealedText` are optional** (`?:`), not required: an older checkpoint holds
  neither field, and the optional type keeps hand-built `Submission` literals compiling unchanged.
- **`collectFacts` gains a fifth parameter** `revealedByBatch` (batch id to clue text) beside 070's
  `stakesByBatch`, instead of widening `stakesByBatch`'s value type. Both are filled from submissions
  in `collectBeatFacts`.
- **`consequenceFor` reads a null `success` as null** (a checkpoint saved under 070 may hold it).
