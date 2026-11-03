# Deviations: spec 082

## Phase 0 seam check (T001, 2026-11-03)

Checked against the branch after its merge of `origin/main` at bed923f4: TASK-0208 (#117), TASK-0127
(spec 070, #118), TASK-0170 (spec 080, #119), TASK-0212 (#120), TASK-0207 (spec 081, #121). Read:
`nodes/schemas.ts`, `nodes/resolve.ts` (`case "check"`, `"move"`, `"attack"`, the `checkPlan` call),
`stakes.ts`, `facts.ts`, `fallback.ts`, `resume.ts`, `gates/plan-gate.ts`, `prompts/step-grammar.ts`,
`prompts/interpret.ts`, engine `commands/attacks.ts`, `schema/{commands,events}.ts`, `index.ts`, and
the deviations of specs 070, 080 and 081.

**Result: seams moved, none changed meaning.** Each amendment below is a name, a version, or an
explicit list of fields the plan already said to keep.

### Moved seams

1. **Prompt versions.** Main is interpret-v10, adjudicate-v7, narrate-v13, audit-v9 (specs 070,
   080 and 081 each bumped). This card bumps interpret to v11 and adjudicate to v8. Narrate and
   audit are not touched: they read ledger rows and facts, whose fields this card keeps. Plan R14
   and T026 amended.
2. **Check step as merged.** Beyond spec 070's fields, spec 080 made `stakes.success` required and
   added `reveals: ClueRefSchema.nullable().default(null)`. `onCost`, `onSevere` and `newRisk` carry
   `.default(...)`. D6 keeps all of them unchanged inside the new strict object. The spec's
   "check step" block amended to the merged shape.
3. **Reading-level refinement.** Spec 070 put the ability-check stakes rule in a shared
   `requireAbilityStakes(steps, ctx, base)`, called from the `superRefine` of both
   `InterpretReadingSchema` and `AdjudicateModelOutput`. D6's `onHit` damage refusal joins that
   helper instead of a refine on the attack option. Both outputs then enforce it, and the
   discriminated-union options stay plain strict objects. Plan D6 amended.
4. **Resolve `case "check"` carries more than the plan sketched.** The merged submission passes
   `houseRules: { outcomeBands, naturals }` from `seed.tableRules`, `autoSuccess` from
   `isFreeRetry(step, fresh.ledger)`, and `step.stakes` as `run.mech`'s fifth argument. After the
   submission it sets `sub.reveals` and `sub.revealedText` (spec 080 D3) and applies
   `effectsForBand(step, sub.band ?? sub.outcome)`. D7 keeps each of these; only `expression`,
   `mode` and `dc` change. `isFreeRetry` reads `kind`, `combatantId`, `ability`, `skill`, `newRisk`
   and `autoFail`, which this card keeps. Plan D7 amended to list them.
5. **Engine check handler order.** Merged `handleCheckRoll` parses the expression first. It then
   runs the named and unable checks, builds the `check.resolved` base (with `dc`), refuses
   `autoFail` with `autoSuccess`, returns the auto paths, and rolls through the exported
   `bandOf({ total, dc, natural, kind, houseRules })`. D3's DC resolution and derived modifier (or
   `STAT_UNDEFINED`) take the expression parse's slot, before the auto paths. `bandOf` receives the
   tier DC unchanged. Plan D3 amended.
6. **Engine exports.** `index.ts` already exports `bandOf` and the `OutcomeBand` type (spec 070).
   T008 appends to that list. `Ability` still has two local copies (`commands.ts:28`,
   `events.ts:52`), as D1 assumes.
7. **Plan gate.** Spec 070 added `stakeTexts(step)` (stakes and `newRisk`) to `stepTexts`, and
   `onCost`/`onSevere` to `stepIds` and `plannedDiff`. D8's `circumstance.reason` is one more
   `NamedText` in the same `stepTexts` cases. `stepIds`'s `attack` case guards a null `attackerId`;
   FR-014 makes the guard dead, so the build removes it. Plan D8 amended.
8. **Resume.** `refreshSubmission` gained `band` (spec 070); `findResumedPlans` is unchanged, so D10
   holds. Spec 080 R9 tolerates a 070-era checkpoint with `success: null`. D10's re-parse drops such
   a reading too, since `success` is now required. This is OQ-5 (a) over one more deploy, not a new
   rule.
9. **Spec 081's `say`** is a reading field, not a step field. D6 does not touch it. The interpret
   `EXAMPLE_OUTPUT` keeps `say: null`.
10. **Fallback and facts.** `outcomeSentence(name, outcome, band)` and `rollSentences` read the
    `FactRoll` name, reason, outcome, band, consequence and revealed. No step `expression`, `dc`,
    `targetAc` or `mode` reaches them. `facts.ts` reads `expression` from the engine's `dice.rolled`
    row, and `against` from `check.resolved.dc` and `attack.resolved.ac`. Both stay engine-written,
    so `fallback.ts` and `facts.ts` stay on "Not touched".
11. **Seed attack name.** The seed writes "Light crossbow". `getByName` matches through
    `normalizeName` (lowercased), so it resolves `light-crossbow` (ranged). Plan R3 and the spec
    assumption amended to the seed spelling.
12. **Script migration (R9, R10) re-checked.** The same 21 JSON files carry check or attack steps.
    Specs 070 and 080 added stakes, `onCost`, `onSevere`, `newRisk` and `reveals` to each check, and
    changed no expression, DC or mode. Each R9 check row holds as written. Each attack to-hit and
    each `onHit` damage expression equals the seed or SRD entry. The only non-normal mode is
    `approach-reed-camp.json`'s Kestrel Stealth disadvantage. The only condition effects are Pell's
    `restrained` removal (`free-pell.json`, `runbook-a-reed-camp.json`) and Tamsin's `prone`
    (`human-dm-roll-chain.json`, with no later attack on her). Plan R9 and R10 amended with this.
13. **Ledger fixtures stay.** `test/dm/fixtures/stakes-capture-*.json`, `claw-marks-*.json` and
    `test/playtest/fixtures/doctored/` carry `dc` on `check.resolved` rows. Those are engine rows,
    which keep `dc`. They are not migrated.
14. **`interpret-capture.test.ts`** asserts the captured v1 attempt fails at
    `readings.0.steps.0.onSuccess.0.condition`. Its step also carries `expression`, `mode` and `dc`,
    which the strict check step now refuses as well. The assertion uses `toContain`, so it is
    expected to stay green (not run at T001: the worktree has no `node_modules`). It joins Phase 3's
    file list as edit-only-if-red.
15. **TS tests that build steps.** Beyond plan Phase 3's list, `adjudicate.integration.test.ts` and
    `beat.integration.test.ts` build check steps by hand (spec 080 touched both). They join Phase 3.
    `stakes.test.ts` builds check-step literals through `Pick<>` types and joins Phase 3 as
    edit-only-if-red.

### Changed-meaning seams

None.

### Operator rulings recorded (2026-11-02)

- OQ-1 resolved (a). Sneak Attack is carded as TASK-0225 (m-4, after TASK-0058). Each playtest
  scenario carries a standing S-sneak-attack row (`docs/design/playtest-scenarios.md`).
- OQ-2, OQ-3 and OQ-7 resolved (a) and carded: TASK-0222, TASK-0223, TASK-0224.
- OQ-4, OQ-5 and OQ-6 resolved (a): defaults accepted.
