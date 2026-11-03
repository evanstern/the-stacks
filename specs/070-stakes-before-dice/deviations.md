# Deviations from plan.md (build-time seam check, 2026-11-02)

Seam check against HEAD 28302d0d: plan.md's seams hold. `FactBand` and `FactRoll.band?` exist in
`facts.ts` as 0113 reserved them (R10: no rename). Current prompt versions: interpret-v7,
adjudicate-v5, narrate-v10, audit-v6; the bumps are v8, v6, v11, v7. The check step and
`StepSchema` are unchanged by 0208 (it added a `move` step only).

## Phase 1

- **`houseRules` and `autoSuccess` are `.optional()`, not `.default(...)`** (plan D2). A Zod default
  makes the field required on the inferred output type, which broke the typed literal commands in
  `packages/session-model/src/fixtures/recipes.ts`. The handler falls back to both flags false, so
  behaviour matches the plan (SRD-pure when none are sent).
- **Two files outside plan.md's list:** `packages/session-model/src/fixtures/dm-approvals.ts` and
  `free-mode-action.ts`. Recipes regenerate `check.resolved` rows, which now carry `margin` and
  `band`; the recorded rows gain `margin: 3, band: "success"`. Plan "Not touched" said
  session-model types follow the engine union (true), but these recorded fixtures do not.

## Phase 2

- **`checkStep()` builder:** `apps/server/test/dm/helpers.ts` has no check-step builder, but
  `world.ts` already exports `checkStep()` (used by the plan-gate and resolve tests). T014 adds the
  stakes to that builder instead of creating a second one in `helpers.ts`. `helpers.ts` is untouched.
- **Fixtures beyond the plan.md list:** `dm-scripts/runbook-a-reed-camp.json` and the test scripts
  `approach-reed-camp.json`, `free-pell.json`, `reveal-snag.json`, `shoot-snag.json` also carry check
  steps (runbook A added them after spec 070). They gain stakes too. Fixture stakes texts are
  generic; saving throws carry null `cost` and `severe`.
- **Test files beyond the list:** the `checkStep()` change reaches `clarify-keeps-turn`,
  `no-undeclared-method`, `opportunity-attack`, `resolve.human-seat` integration tests through
  `world.ts`; none needed an edit.
- **`nodes/schemas.ts`:** a `Stakes` type export (`Stakes`) was added to `schemas.ts`
  for Phase 3 (`stakes.ts`).
