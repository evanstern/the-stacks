# Tasks: Stakes before dice — outcome bands and pre-declared consequences

**Input**: `specs/070-stakes-before-dice/` (spec.md, plan.md), decision-0022 (D14).

**Prerequisites**: TASK-0113 has merged (it reserves the band field on roll facts). Runbook A's
TASK-0193 and TASK-0194 have merged. The operator has ruled OQ-1 and OQ-2; the tasks below
implement both at (a).

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Each implementer phase
ends with `pnpm ci:check` green and one commit led by `TASK-0127:`. DB suites run with
`REQUIRE_DATABASE=1` on the worktree's own stack in Phases 2 and 3. Touch only the files plan.md
"Files the build touches" lists for the phase. Stop and report if another file is needed.

## Phase 1: Engine bands, naturals and auto-success (card AC #2, #4, #7; US1, US2)

- [x] T001 [US2] In `packages/dnd5e-engine/src/schema/commands.ts`, add `houseRules`
      (`outcomeBands`, `naturals`, default both false) and `autoSuccess` (`{ reason }` or null,
      default null) to `check.roll` (plan D2).
- [x] T002 [US1] In `packages/dnd5e-engine/src/schema/events.ts`, add `OutcomeBand` and the optional
      `margin` and `band` fields to `check.resolved` (plan D2, R3).
- [x] T003 [US1] In `packages/dnd5e-engine/src/commands/attacks.ts`, add the pure `bandOf` and use
      it in `handleCheckRoll`. Refuse `autoSuccess` beside `autoFail` with `INVALID_COMMAND`. An
      auto-success emits one `check.resolved` and no `dice.rolled` (plan D2 rules 1–7).
- [x] T004 [US1] Export `OutcomeBand` and `bandOf` from `packages/dnd5e-engine/src/index.ts`.
- [x] T005 [US1] In `packages/dnd5e-engine/test/commands/attacks.test.ts`, add scripted-dice
      tests: margins 0, −1, −2, −3, −4, −5 with bands on; the same with bands off; a saving throw at
      margin −2 and −6 with bands on (band `failure`); natural 20 below the DC and natural 1 above it,
      naturals on and off; natural 1 at margin −6 with bands on (`severe-failure`); `autoSuccess`;
      `autoSuccess` with `autoFail` refused; `autoFail` band and null margin; no `houseRules` gives
      SRD behaviour.
- [x] T006 Update `packages/dnd5e-engine/README.md` with one paragraph on bands and the flags.
- [x] T007 Run `pnpm ci:check`.

## Phase 2: Step contract, prompts, table rules, plan gate, fixtures (card AC #1, #3; US1, US2)

- [x] T008 [US1] In `apps/server/src/dm/nodes/schemas.ts`, add `StakesSchema` and the check-step
      fields `stakes`, `onCost`, `onSevere`, `newRisk` (plan D1). Add the ability-check
      `superRefine` to `InterpretReadingSchema` and `AdjudicateModelOutput`.
- [x] T009 [US1] In `apps/server/src/dm/prompts/step-grammar.ts`, document the new fields and the
      band meanings in one line each.
- [x] T010 [US1] In `apps/server/src/dm/prompts/interpret.ts`, add stakes to `EXAMPLE_OUTPUT` and the
      three FR-005 rules to `OUTPUT_SHAPE`. Bump `PROMPT_VERSION` one past `main`.
- [x] T011 [US1] Bump `PROMPT_VERSION` in `apps/server/src/dm/prompts/adjudicate.ts` one past `main`.
- [x] T012 [US2] In `apps/server/src/dm/seed/schema.ts`, add the `tableRules` object with defaults
      (plan D3).
- [x] T013 [US1] In `apps/server/src/dm/gates/plan-gate.ts`, claim-check the stakes texts and
      `newRisk`, and walk `onCost` and `onSevere` ids and condition sources (plan D5).
- [x] T014 Add a `checkStep(over)` builder to `apps/server/test/dm/helpers.ts` that fills valid
      stakes and empty new lists.
- [x] T015 Add stakes to every check step in the 14 JSON fixtures plan.md lists (3 `dm-scripts`,
      10 test scripts, `downed-seat.json`). Keep each text short and true to the fixture's reason.
- [x] T016 Update the TS tests plan.md lists for Phase 2 to use `checkStep()` or carry stakes.
- [x] T017 [US1] In `apps/server/test/dm/interpret.test.ts`, add: a check with no `stakes.failure`
      is rejected (card AC #1); an ability check with null `cost` is rejected; a saving throw with
      null `cost` and `severe` parses; `newRisk` defaults to null.
- [x] T018 [US1] In `apps/server/test/dm/interpret-prompt.test.ts`, assert the new version strings
      and that the prompt carries the FR-005 rules and a stakes example.
- [x] T019 [US2] In `apps/server/test/dm/seed.test.ts`, assert the defaults on a seed with no
      `tableRules` and an override of each flag (card AC #3, group checks included).
- [x] T020 [US1] In `apps/server/test/dm/plan-gate.test.ts`, add a contradicting stakes text refused
      with `REASON_CONTRADICTS_STATE` and an unknown id in `onSevere` refused with
      `UNKNOWN_COMBATANT`.
- [x] T021 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`.

## Phase 3: Resolve by band and the free retry (card AC #2, #3, #5; US1, US2, US3)

- [x] T022 [US1] Create `apps/server/src/dm/stakes.ts` with `effectsForBand`, `isFreeRetry` and
      `consequenceFor` (plan D4).
- [x] T023 [US1] Create `apps/server/test/dm/stakes.test.ts`: each band's effect order; free retry
      true and false for each FR-014 condition (combatant, ability, skill, `newRisk`, `autoFail`,
      saving throw, earlier scene); `consequenceFor` per band.
- [x] T024 [US1] In `apps/server/src/dm/nodes/resolve.ts` `case "check"`, send `houseRules` from
      `ctx.seed.tableRules`, send `autoSuccess` on a free retry, and apply `effectsForBand`. Add
      `band` and `stakes` to `Submission`. Fill `band` in `findLanded` and `outcomeOf`. Walk
      `onCost` and `onSevere` in `presenceTargets`.
- [x] T025 [US1] In `apps/server/src/dm/resume.ts` `refreshSubmission`, fill `band` from the
      approved batch.
- [x] T026 [US2] In `apps/server/test/dm/resolve.integration.test.ts`, add: margin −2 applies
      `onSuccess` then `onCost`; margin −6 applies `onFailure` then `onSevere`; bands off applies
      only `onFailure`; naturals off on a seed override resolves a natural 20 by total (card AC #3).
- [x] T027 [US3] In `apps/server/test/dm/resolve.integration.test.ts`, add the free retry: a failed
      check, then the same check with `newRisk: null`, gives one `check.resolved` with band
      `success`, no new `dice.rolled` row, and the success effects (card AC #5). A second case with
      `newRisk` set rolls.
- [x] T028 In `apps/server/test/dm/resume.test.ts`, assert a refreshed approved check carries its
      band.
- [x] T029 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`.

## Phase 4: Facts, narration, audit, fallback, ledger view (card AC #2, #6; US1, US4)

- [x] T030 [US1] In `apps/server/src/dm/facts.ts`, add `band`, `margin`, `consequence` and
      `autoSuccess` to `FactRoll`. Fill them in `collectFacts` from the outcome row and a
      `stakesByBatch` map that `buildNarrationFacts` builds from `resolve.submissions`. Render the
      band word and the auto-success line in `renderRollLine` (plan D6). Use the field name TASK-0113
      reserved (plan R10). Import no engine value.
- [x] T031 [US4] In `apps/server/src/dm/prompts/narrate.ts`, add the band and consequence to
      `rollEntry` and the decided-consequence rule. Bump `PROMPT_VERSION`.
- [x] T032 [US4] In `apps/server/src/dm/prompts/audit.ts`, add the band-delivery criterion as
      `ledger-mismatch`. Bump `PROMPT_VERSION`.
- [x] T033 [US4] In `apps/server/src/dm/fallback.ts`, make `outcomeSentence` band-aware and append
      the consequence only when `checkClaims` passes it.
- [x] T034 [P] [US1] In `apps/web/app/play/ledger-format.ts`, show the band label and the
      auto-success label (plan D7). Test it in `apps/web/test/play/ledger-format.test.mjs`, old rows
      included.
- [x] T035 [US1] In `apps/server/test/dm/facts.test.ts`, assert band, margin and consequence for each
      band, `consequence: null` on success, an old row with no `band`, and the auto-success line.
- [x] T036 [US4] In `apps/server/test/dm/narrate.test.ts` and `apps/server/test/dm/audit.test.ts`,
      assert the new versions, the prompt lines, and that the deterministic check refuses a
      `success-at-cost` actor paired with a failure word (spec US4 #3).
- [x] T037 [US4] In `apps/server/test/dm/fallback.test.ts`, assert the band sentences and that a
      consequence failing the claim check is dropped.
- [x] T038 [US4] Create `apps/server/test/dm/fixtures/stakes-capture-20261026T183818Z.json` from the
      seq 168–175 and 203–206 rows of
      `specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/`.
- [x] T039 [US4] Create `apps/server/test/dm/stakes-audit.test.ts` (card AC #6): build facts for
      seq 171 with the declared severe consequence of spec US4; assert the audit prompt carries
      band and consequence; run the audit node with a fake gateway that returns `fail`
      (`ledger-mismatch`) for the captured seq 175 prose and `pass` for a second draft; assert one
      regenerate and that the second draft ships. Repeat for seq 203 (`failure`, the F6 dodge).
- [x] T040 Run `pnpm ci:check`.

## Phase 5: Contracts and wiki re-ground

- [ ] T041 Amend `specs/026-dnd5e-engine/contracts/commands.md` and `events.md`,
      `specs/031-dm-runtime/contracts/nodes.md` and `resolve.md`, and
      `specs/034-narration-quality/contracts/narration-facts.md`. Mark each "Amended by
      specs/070-stakes-before-dice".
- [ ] T042 Re-ground the NEEDS-REVIEW notes against the diff: `docs/wiki/dnd5e-engine.md`,
      `dm-runtime.md`, `dm-narration-quality.md`, `dm-failure-and-gates.md`, `dm-turn-jobs.md`,
      `play-route.md`, `output-claim-gate.md`, `seed-npc-presence.md`, `srd-data.md`,
      `dm-talk-triggers.md`, `turn-floor.md`, `ai-gateway.md`. Re-pin each honestly; a note whose
      claims did not change gets a computed re-pin only.
- [ ] T043 Update `docs/wiki/CAPSULES.md` and the `docs/wiki/INDEX.md` state paragraph with one
      sentence for TASK-0127 (specs/070).
- [ ] T044 **[orchestrator]** Add the TASK-0127 execution-log row to the runbook B file: dispatches,
      test counts, prompt versions, no migration, no frozen contract change.
- [ ] T045 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 first: Phase 3 sends the new engine fields. Phases 1 and 2 touch disjoint files.
- Phase 2 before Phase 3: resolve reads the new step fields and the seed's table rules.
- Phase 3 before Phase 4: facts read `Submission.stakes` and the band.
- Phase 5 last.

## Parallel opportunities

- T034 (web) touches no server file and may run beside T030–T033.
- Within Phase 2, T015 (JSON fixtures) and T017–T020 (new tests) touch disjoint files.

## Implementation strategy

- MVP is Phases 1–3: bands decide effects in the ledger, with flags and the free retry.
- Phase 4 makes the narrator and the auditor use the band. It is the card's user-facing outcome
  and must land in the same PR.

## Card AC to task map

| Card AC | Tasks |
|---|---|
| #1 | T008, T017 |
| #2 | T002, T003, T005, T024, T030, T035 |
| #3 | T012, T019, T024, T026 |
| #4 | T003, T005 |
| #5 | T022, T024, T027 |
| #6 | T031, T032, T038, T039 |
| #7 | T003, T005 |
