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
