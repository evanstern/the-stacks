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

## Phase 3

- **`stakes.ts` imports the engine type `OutcomeBand` only** (type import, no value). `effectsForBand`
  reads an unknown or missing band as `failure`, so an old row with only `outcome` still applies
  `onSuccess` or `onFailure` as before.
- **`world.ts` gained a `seed` option** on `createWorld` so integration tests can override the table
  rules (T026). Not on plan.md's file list; test helper only.
- **`assemble.test.ts` literal** gained `band: null, stakes: null` for the widened `Submission` type.

## Phase 4

- **`facts.ts` shape:** `margin`, `consequence` and `autoSuccess` are optional on `FactRoll`, and
  `band`/`margin`/`consequence` are set only when the outcome row carries a band. An old row stays
  byte-identical to before. `FactBand` stays the local literal type 0113 reserved. The stakes type
  is a type import from `nodes/schemas.js`; `consequenceFor` is the one value import (`stakes.ts`
  imports no engine value).
- **Auto-success without a roll:** `collectFacts` treats a rollless `check.resolved` with
  `autoFail: null` and outcome `success` as auto-success. Its line reads
  `<name> — <reason>: no roll needed: success`. The auto-fail line is unchanged.
- **`outcomeWord`** is a new export of `facts.ts`, shared by `renderRollLine` and the narrate
  `rollEntry`.
- **Fixture rows:** `stakes-capture-20261026T183818Z.json` holds seq 168-175 and 202-206 (202 is the
  dice row of the seq 203 check; tasks.md names 203-206 only).
- **Fallback:** `outcomeSentence` gained an optional band argument. The consequence is voiced only
  when `reasonSpeakable` passes it (digits, system words, dice words, death words, claim check).
  Other `fallback.ts` hunks untouched.
