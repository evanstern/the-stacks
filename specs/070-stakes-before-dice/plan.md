# Implementation Plan: Stakes before dice — outcome bands and pre-declared consequences

**Branch**: `task-0127-stakes-before-dice` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/070-stakes-before-dice/spec.md`, decision-0022 (D14) points 2, 3 and 6, and the
operator rulings on TASK-0127. This plan assumes OQ-1 (a) and OQ-2 (a). Runbook B builds it after
TASK-0113 merges.

Research, design and contracts live in this file, as in specs 064 and 065. No separate
research.md, data-model.md or quickstart.md.

## Summary

Interpret and adjudicate write `stakes` on every check step: one consequence text per outcome
band, plus `onCost` and `onSevere` effect lists and a `newRisk` field. The engine's `check.roll`
gains `houseRules` and `autoSuccess`. The engine computes `margin` and `band` and applies the
natural 20 and natural 1 rule. Resolve passes the seed's table rules, applies effects by band, and
turns a free retry into an `autoSuccess`. Narration facts carry band, margin and the applied
band's consequence. Narrate, audit and the fallback present the band as decided fact.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: Postgres event log (JSON payloads) and `jobs.result` JSON. **No migration.**
**Testing**: Vitest unit tests; engine scripted-dice tests; DB integration tests with
`REQUIRE_DATABASE=1`; the fake gateway and DM scripts (spec 053).
**Target Platform**: the 5e engine package, the server's DM runtime, one play-route formatter.
**Project Type**: monorepo web service.
**Performance Goals**: no new model call. Interpret output grows by about 4 short texts per check.
**Constraints**: frozen contracts unchanged (`ws-protocol.md` frames, `specs/029-proposal-gate/
contracts/`, `specs/030-play-route/contracts/proposal-seam.md`): `mechanics.command` is `unknown`
on the wire, and engine events gain only optional fields.
**Scale/Scope**: 19 source files (1 new), 23 test files (2 new) plus 1 new fixture, 14 JSON fixtures, 12 wiki notes.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no human-only path. Table rules are seed data an agent writes.
- [x] **II. Content contract**: the scene seed gains one optional Zod-validated object.
- [x] **III. Data planes**: session plane only. The seed is read as today.
- [x] **IV. Event sourcing**: no new event type. `check.resolved` v1 gains two optional fields;
      old rows parse. Stakes stay in `jobs.result`, never in a public row.
- [x] **V. Citations**: no rules claim. N/A.
- [x] **VI. 5e engine boundary**: margin, band, naturals and auto-success are computed in the
      engine and covered by scripted-dice tests. No model writes a number.
- [x] **VII. Structured first**: stakes are typed fields, not prose blobs.
- [x] **VIII. Operator-owned content**: no book text. Fixtures reuse captured project runs.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Where the band is computed.** `handleCheckRoll` (`packages/dnd5e-engine/src/commands/
  attacks.ts`) already holds total, DC and natural. Margin and band are numbers, so they go there
  (Constitution VI). Flags ride the command as `houseRules`, so the engine stays config-free and a
  human DM's paused proposal resolves with the flags it was proposed with.
- **R2 — Engine defaults.** `houseRules` defaults to both flags false: the engine stays SRD-pure for
  any caller that sends none (fixtures, recipes, the web DM). The DM runtime sends the seed's
  values, whose defaults are ON (OQ-1 (a)).
- **R3 — Old rows.** `check.resolved` is `v: 1`. `margin` and `band` are `.optional()`; readers
  derive the band from `outcome` when it is absent. No version bump, no catalog change.
  `CheckResolvedEvent` in `packages/session-model/src/projections/types.ts` is extracted from the
  engine union, so the ledger type follows with no edit.
- **R4 — Effects by band.** Resolve's `case "check"` picks `onSuccess` or `onFailure` from
  `sub.outcome` today (`resolve.ts` ~line 556). It reads `band` instead. `findLanded`,
  `outcomeOf` and `refreshSubmission` (`resume.ts`) read `outcome` from the same rows; each also
  reads `band`, so a reclaim or a resumed approval applies the same list.
- **R5 — Free retry (OQ-2 (a)).** `p.ledger` holds `check.resolved` outcome rows and `scene.changed`
  change rows in seq order (`sessionChangeRow`). "Current scene" is every row after the last
  `scene.changed`. A pure helper scans it.
- **R6 — Stakes to facts.** `buildNarrationFacts` receives `resolve.submissions`. Each check
  submission records `batchId` and, after this card, `stakes`. `collectFacts` links roll and outcome
  rows by `batchId`, so it can look up the stakes for the batch.
- **R7 — Captured run.** verify-20261026T183818Z seq 170–175 (`specs/034-narration-quality/
  evidence/`): Odo's Persuasion 10 vs DC 15 (natural 7, margin −5) fails, and the seq 175 prose
  invents its own consequence. It is the AC #6 replay. Seq 203–206 (Goblin-4, 14 vs DC 15) is the
  F6 dodge and the second fixture case.
- **R8 — Fixture blast radius.** 14 JSON fixtures and about 10 test files build check steps. The
  schema makes `stakes` required, so each needs one. A `checkStep()` builder in
  `apps/server/test/dm/helpers.ts` keeps the TS tests short.
- **R9 — Deterministic audit.** `deterministicChecks` pairs the actor with words opposite the
  recorded `outcome`. `success-at-cost` keeps outcome `success` and `severe-failure` keeps
  `failure`, so the check covers bands with no code change (spec US4 scenario 3 is a test only).
- **R10 — TASK-0113 shape.** 0113 reserves the outcome-band field on roll facts and adds an
  involuntary-effects list. This plan names the field `band` on `FactRoll`. If 0113 merged another
  name, use it and record the rename in this file.

## Design

### D1 — Step contract (`apps/server/src/dm/nodes/schemas.ts`)

```ts
const StakeText = z.string().min(1).max(200);
export const StakesSchema = z.object({
  success: StakeText.nullable(),   // TASK-0170 makes this required
  cost: StakeText.nullable(),      // required on an ability check
  failure: StakeText,              // always required (card AC #1)
  severe: StakeText.nullable(),    // required on an ability check
});
// check step gains:
//   stakes: StakesSchema,
//   onCost: z.array(EffectSchema).max(4).default([]),
//   onSevere: z.array(EffectSchema).max(4).default([]),
//   newRisk: z.string().min(1).max(200).nullable().default(null),
```

`StepSchema` stays a discriminated union. The ability-check rule (`cost` and `severe` non-null)
runs as a `superRefine` on `InterpretReadingSchema` and on `AdjudicateModelOutput`, walking their
steps. A failure there is `invalid-output` and gets the existing one repair re-ask.

### D2 — Engine (`packages/dnd5e-engine`)

`check.roll` command gains:

```ts
houseRules: z.object({ outcomeBands: z.boolean(), naturals: z.boolean() })
  .default({ outcomeBands: false, naturals: false }),
autoSuccess: z.object({ reason: Reason }).nullable().default(null),
```

`check.resolved` event gains `margin: Int.nullable().optional()` and `band: OutcomeBand.optional()`,
with `OutcomeBand = z.enum(["success","success-at-cost","failure","severe-failure"])`, exported.

Band rule (pure function `bandOf` in `attacks.ts`, exported for tests):

1. `autoFail` → outcome `failure`, band `failure`, margin null.
2. `autoSuccess` (refused with `INVALID_COMMAND` beside `autoFail`) → outcome and band `success`,
   margin null, no dice event.
3. Else margin = total − DC.
4. `naturals` and natural 20 → `success`. `naturals` and natural 1 → `failure`, or
   `severe-failure` when bands apply and margin ≤ −5.
5. Else margin ≥ 0 → `success`.
6. Bands apply only when `outcomeBands` and `kind === "ability-check"`: −1..−2 →
   `success-at-cost` (outcome `success`); ≤ −5 → `severe-failure`; else `failure`.
7. Bands off: `failure`.

### D3 — Table rules (`apps/server/src/dm/seed/schema.ts`)

```ts
tableRules: z.object({
  outcomeBands: z.boolean().default(true),
  naturals: z.boolean().default(true),
  groupChecks: z.boolean().default(false),
}).default({ outcomeBands: true, naturals: true, groupChecks: false }),
```

Shipped seeds stay unchanged and take the defaults. `groupChecks` is read by nothing until
TASK-0128.

### D4 — Resolve (`apps/server/src/dm/nodes/resolve.ts`, new `apps/server/src/dm/stakes.ts`)

`stakes.ts` holds three pure functions, unit-tested alone:

- `effectsForBand(step, band)` → the ordered effect list (FR-013).
- `isFreeRetry(step, ledger)` → true per FR-014 over the current scene's rows.
- `consequenceFor(stakes, band)` → the declared text for a non-success band, else null.

In `case "check"`: build `houseRules` from `ctx.seed.tableRules`; set `autoSuccess` to
`{ reason: step.reason }` when `isFreeRetry`; submit; read `band` (falling back to `outcome`) and
run `effectsForBand`. `Submission` gains `band: string | null` and `stakes: Stakes | null`;
`findLanded`, `outcomeOf` and `resume.ts` `refreshSubmission` fill `band`. `presenceTargets`
walks `onCost` and `onSevere`.

### D5 — Plan gate (`apps/server/src/dm/gates/plan-gate.ts`)

`stepTexts` adds `stakes.success`, `stakes.cost`, `stakes.failure`, `stakes.severe` and `newRisk`
(non-null only) and the condition sources in `onCost` and `onSevere`. The id walk adds `onCost`
and `onSevere` targets. Refusals keep the existing codes.

### D6 — Facts and narration

`FactRoll` gains `band: OutcomeBand | null`, `margin: number | null`, `consequence: string | null`
and `autoSuccess: boolean`. `facts.ts` imports no engine value (its import-closure test); it
declares the band as a local string-literal type. `collectFacts` takes an optional
`stakesByBatch` map; `buildNarrationFacts` builds it from `resolve.submissions`. An auto-success
outcome row with no roll renders like auto-fail: "`<name> — <reason>: no roll needed: success`".

- `renderRollLine` writes the band word (`success at a cost`, `severe failure`) in place of the
  outcome word when the band differs from the outcome.
- `prompts/narrate.ts`: `rollEntry` adds the band and `consequence: <text>`. A new rule line: "A
  roll's band and consequence are decided. Tell that consequence; invent no other." Version bumps
  one past `main`.
- `prompts/audit.ts`: the same rule as an audit criterion, kind `ledger-mismatch`. Version bumps.
- `fallback.ts`: `outcomeSentence` takes the band (`… pulls it off, at a cost.`, `… fails badly.`).
  It appends the consequence only when `checkClaims` passes it.
- `prompts/interpret.ts`: `EXAMPLE_OUTPUT` gains stakes; `OUTPUT_SHAPE` gains the three rules of
  FR-005. `prompts/step-grammar.ts` documents the new fields. `prompts/adjudicate.ts` bumps its
  version (it shares the grammar).

### D7 — Play route (`apps/web/app/play/ledger-format.ts`)

`check.resolved` with a `band` other than the outcome reads `Success at a cost (10 vs DC 12)` or
`Severe failure (6 vs DC 12)`. An auto-success reads `Success (no roll)`.

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Engine (Phase 1)**
- `packages/dnd5e-engine/src/schema/commands.ts`
- `packages/dnd5e-engine/src/schema/events.ts`
- `packages/dnd5e-engine/src/commands/attacks.ts`
- `packages/dnd5e-engine/src/index.ts` (export `OutcomeBand`, `bandOf`)
- `packages/dnd5e-engine/README.md`
- `packages/dnd5e-engine/test/commands/attacks.test.ts`

**Step contract, prompts, seed, plan gate, fixtures (Phase 2)**
- `apps/server/src/dm/nodes/schemas.ts`
- `apps/server/src/dm/prompts/step-grammar.ts`
- `apps/server/src/dm/prompts/interpret.ts`
- `apps/server/src/dm/prompts/adjudicate.ts`
- `apps/server/src/dm/seed/schema.ts`
- `apps/server/src/dm/gates/plan-gate.ts`
- `apps/server/test/dm/helpers.ts` (`checkStep()` builder)
- `apps/server/test/dm/interpret.test.ts`
- `apps/server/test/dm/interpret-prompt.test.ts`
- `apps/server/test/dm/seed.test.ts`
- `apps/server/test/dm/plan-gate.test.ts`
- `apps/server/test/dm/adjudicate.integration.test.ts`
- `apps/server/test/dm/beat.integration.test.ts`
- `apps/server/test/dm/first-stage.test.ts`
- `apps/server/test/dm/presence-effect.test.ts`
- `apps/server/test/dm/rules-terms.test.ts`
- `apps/server/test/dm/runner.test.ts`
- `apps/server/test/dm/world.ts`
- `apps/server/test/dm/assemble.test.ts`
- `apps/server/dm-scripts/greyhollow-human-dm.json`
- `apps/server/dm-scripts/greyhollow-live.json`
- `apps/server/dm-scripts/greyhollow-plan-approach.json`
- `apps/server/test/dm/scripts/audit-advisory.json`
- `apps/server/test/dm/scripts/audit-fallback.json`
- `apps/server/test/dm/scripts/audit-regenerate.json`
- `apps/server/test/dm/scripts/encounter-end-bargain.json`
- `apps/server/test/dm/scripts/exploration-check.json`
- `apps/server/test/dm/scripts/greyhollow-ford-full.json`
- `apps/server/test/dm/scripts/human-dm-approval.json`
- `apps/server/test/dm/scripts/human-dm-roll-chain.json`
- `apps/server/test/dm/scripts/plan-approach.json`
- `apps/server/test/dm/scripts/social-adjudicated.json`
- `apps/server/test/playtest/fixtures/downed-seat.json`

**Resolve (Phase 3)**
- `apps/server/src/dm/stakes.ts` (new)
- `apps/server/src/dm/nodes/resolve.ts`
- `apps/server/src/dm/resume.ts`
- `apps/server/test/dm/stakes.test.ts` (new)
- `apps/server/test/dm/resolve.integration.test.ts`
- `apps/server/test/dm/resume.test.ts`

**Facts, narration, audit, fallback, web (Phase 4)**
- `apps/server/src/dm/facts.ts`
- `apps/server/src/dm/prompts/narrate.ts`
- `apps/server/src/dm/prompts/audit.ts`
- `apps/server/src/dm/fallback.ts`
- `apps/web/app/play/ledger-format.ts`
- `apps/server/test/dm/facts.test.ts`
- `apps/server/test/dm/fallback.test.ts`
- `apps/server/test/dm/narrate.test.ts`
- `apps/server/test/dm/audit.test.ts`
- `apps/server/test/dm/stakes-audit.test.ts` (new)
- `apps/server/test/dm/fixtures/stakes-capture-20261026T183818Z.json` (new; seq 168–175 and
  203–206 rows copied from `specs/034-narration-quality/evidence/verify-20261026T183818Z-
  greyhollow-ford-provider/`)
- `apps/web/test/play/ledger-format.test.mjs`

**Contract amendments (Phase 5)**, each marked "Amended by specs/070-stakes-before-dice"
- `specs/026-dnd5e-engine/contracts/commands.md` (`check.roll` `houseRules`, `autoSuccess`)
- `specs/026-dnd5e-engine/contracts/events.md` (`check.resolved` `margin`, `band`)
- `specs/031-dm-runtime/contracts/nodes.md` (check step stakes)
- `specs/031-dm-runtime/contracts/resolve.md` (effects by band, free retry)
- `specs/034-narration-quality/contracts/narration-facts.md` (`FactRoll` fields)

**Runbook log (Phase 5)**
- the runbook B file that dispatches this build (execution-log row)

**Wiki (Phase 5)**
- `docs/wiki/dnd5e-engine.md`, `dm-runtime.md`, `dm-narration-quality.md`,
  `dm-failure-and-gates.md`, `dm-turn-jobs.md`, `play-route.md`, `output-claim-gate.md`,
  `seed-npc-presence.md`, `srd-data.md`, `dm-talk-triggers.md`, `turn-floor.md`, `ai-gateway.md`
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`

**Not touched**: `packages/session-model/` (types follow the engine union), `apps/server/seeds/`
(defaults apply), `nodes/audit.ts` (R9), `doctrine/doctrine.ts` (TASK-0130), every frozen contract.

**Migrations**: none. **New runtime dependencies**: none.

## What TASK-0170 adds after this card

- `stakes.success` becomes required on a check from a player action (its AC #1).
- `FactRoll.consequence` carries the success text too, as the applied outcome (its AC #2).
- The narrate prompt presents every band's text as settled fact (its AC #3).
- The auditor fails undelivered success outcomes; the claw-marks replay (its AC #4).
- Information checks name seed information in `stakes.success` (its AC #5, ties to TASK-0148).

## Risks

- **Interpret output size.** Four texts per check add about 120 output tokens. TASK-0192 raises
  the budget and records `truncated`; watch the ledger on the next playtest.
- **Model fills `cost` with a failure.** The audit rule and the band word in the facts constrain
  the prose. TASK-0130 rewrites the fail-forward doctrine.
- **Overlap with runbook A.** 0193 and 0194 edit `facts.ts`, `narrate.ts`, `resolve.ts` and
  `plan-gate.ts`. Runbook B starts after they merge, so the build adapts to their merged shape.
