# Tasks: Declared outcome — success means the attempted task happens

**Input**: `specs/080-declared-outcome/` (spec.md, plan.md), spec 070 (D1, D4, D6), the operator rule
of 2026-10-28 on TASK-0170.

**Prerequisites**: TASK-0127 (spec 070) has merged. The operator has ruled OQ-1 to OQ-4 at C0, or
the defaults (a) stand. The tasks below implement each (a).

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir, spec
070's merged code and the branch commits. Tasks marked **[orchestrator]** are run by the
orchestrator. Each implementer phase starts by reading spec 070's merged `schemas.ts`, `stakes.ts`,
`facts.ts` and `narrate.ts`, and records any rename in plan.md (Risks). Each phase ends with
`pnpm ci:check` green and one commit led by `TASK-0170:`. DB suites run with `REQUIRE_DATABASE=1` on
the worktree's own stack in Phases 1 and 2. Touch only the files plan.md "Files the build touches"
lists for the phase. Stop and report if another file is needed.

## Phase 1: Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2)

- [x] T001 [US1] In `apps/server/src/dm/nodes/schemas.ts`, make `StakesSchema.success` required, add
      `ClueRefSchema`, and add `reveals` (nullable, default null) to the `check` step (plan D1).
- [x] T002 [US2] In `apps/server/src/dm/prompts/common.ts`, add `clueEntries(seed, beatId)` (plan D2).
      Render no DC.
- [x] T003 [US2] In `apps/server/src/dm/prompts/interpret.ts`, add the "Discoverable clues" section
      after "Scene seed", the FR-003 sentence in `OUTPUT_SHAPE`, and a success text with `reveals` in
      `EXAMPLE_OUTPUT`. Bump `PROMPT_VERSION` one past `main`.
- [x] T004 [US1] In `apps/server/src/dm/prompts/step-grammar.ts`, add `reveals` to the check line and
      extend the narrative-outcome sentence (plan D2).
- [x] T005 Bump `PROMPT_VERSION` in `apps/server/src/dm/prompts/adjudicate.ts` one past `main`.
- [x] T006 [US2] Amend ferry-house clue 1 in the three `apps/server/seeds/greyhollow-ford*.json`
      seeds and `specs/031-dm-runtime/data/greyhollow-ford.seed.json` (plan D6). Keep the base seed
      and the spec copy byte-identical.
- [x] T007 Give 070's `checkStep()` builder in `apps/server/test/dm/helpers.ts` a default success
      text. Fill every null `stakes.success` in the TS tests and the 19 JSON fixtures plan.md lists.
      Keep each text short, concrete and true to the fixture's reason.
- [x] T008 [US1] In `apps/server/test/dm/interpret.test.ts`, add: a check with `stakes.success: null`
      is rejected (card AC #1); a check with no `stakes.success` is rejected; `reveals` defaults to
      null; a malformed `reveals` (`"ferry-house"`, `"ferry-house#9"`) is rejected.
- [x] T009 [US2] In `apps/server/test/dm/interpret-prompt.test.ts`, assert the new version strings,
      the FR-003 sentence, and over the duo seed with `beatId: "ferry-house"`: three clue lines
      `ferry-house#1..3`, no DC digits in them, no `the-keeper` clue, no location or NPC secret. With
      `beatId: null`, assert no clue line.
- [x] T010 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`.

## Phase 2: Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2)

- [ ] T011 [US1] In `apps/server/src/dm/stakes.ts`, widen `consequenceFor` to every band and add
      `clueFor(seed, ref)` (plan D3).
- [ ] T012 [US2] In `apps/server/src/dm/nodes/resolve.ts` `case "check"`, record `reveals` and
      `revealedText` on the submission and log `dm.reveals.unknown` for an unknown reference. Add both
      fields to `Submission` (plan D3).
- [ ] T013 [US1] In `apps/server/src/dm/facts.ts`, add `FactRoll.revealed` and fill `consequence` for
      every band and `revealed` on a success band (plan D4). Import no engine value.
- [ ] T014 [US1] In `apps/server/test/dm/stakes.test.ts`, assert `consequenceFor` per band, success
      included, a null `severe` falling back to `failure`, and `clueFor` for a valid, an out-of-range
      and an unknown-beat reference.
- [ ] T015 [US2] In `apps/server/test/dm/resolve.integration.test.ts`, add: a check with
      `reveals: "ferry-house#1"` records the clue text on its submission; an unknown reference records
      null, logs `dm.reveals.unknown` and still applies the band's effects.
- [ ] T016 [US1] In `apps/server/test/dm/facts.test.ts`, assert `consequence` is the success text on
      band `success` (card AC #2), the cost text on `success-at-cost`, `revealed` set on both success
      bands and null on both failure bands (card AC #5), and null `consequence` for an old submission
      with `success: null`.
- [ ] T017 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1`.

## Phase 3: Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3)

- [ ] T018 [US1] In `apps/server/src/dm/prompts/narrate.ts`, render `outcome (settled)` and
      `learned (settled)` in `rollEntry` and replace 070's rule line (plan D5). Bump `PROMPT_VERSION`.
- [ ] T019 [US3] In `apps/server/src/dm/prompts/audit.ts`, extend criterion 2 with the delivery rule
      (plan D5). Bump `PROMPT_VERSION`.
- [ ] T020 [US3] In `apps/server/src/dm/fallback.ts`, append the success outcome text and the revealed
      fact, each only when `checkClaims` passes it.
- [ ] T021 [US1] In `apps/server/test/dm/narrate.test.ts` and `apps/server/test/dm/audit.test.ts`,
      assert the new versions, the rule lines, and the `outcome (settled)` and `learned (settled)`
      entries (card AC #3).
- [ ] T022 [US3] In `apps/server/test/dm/fallback.test.ts`, assert the success text and the revealed
      sentence ship, and that a text failing the claim check is dropped.
- [ ] T023 [US2] In `apps/server/test/dm/player-facing-prompts.test.ts`, add one case: a narrate
      prompt carries the named clue on a success, and no other DM-only seed text.
- [ ] T024 [US3] Create `apps/server/test/dm/fixtures/claw-marks-20261028-reconstructed.json` (plan
      D7, OQ-3 (a)). Copy row shapes from run 5 seq 199–204 in
      `specs/034-narration-quality/evidence/run5-20261026T171359Z-greyhollow-ford-provider/transcript.jsonl`.
      State "reconstructed" and both sources in the header.
- [ ] T025 [US3] Create `apps/server/test/dm/declared-outcome-audit.test.ts` with the five steps of
      plan D7 (card AC #4; runbook merge condition "names the creature on success").
- [ ] T026 Run `pnpm ci:check`.

## Phase 4: Contracts and wiki re-ground

- [ ] T027 Amend `specs/031-dm-runtime/contracts/nodes.md` and `resolve.md`, and
      `specs/034-narration-quality/contracts/narration-facts.md` and `audit-criteria.md`. Mark each
      "Amended by specs/080-declared-outcome".
- [ ] T028 Re-ground the NEEDS-REVIEW notes against the diff: `docs/wiki/dm-narration-quality.md`,
      `dm-runtime.md`, `dm-failure-and-gates.md`, `seed-npc-presence.md` (seed clue text),
      `dm-turn-jobs.md` (`resolve.ts`). Give every other note that lists a touched file a computed
      re-pin only when its claims did not change.
- [ ] T029 Update `docs/wiki/CAPSULES.md` and the `docs/wiki/INDEX.md` state paragraph with one
      sentence for TASK-0170 (specs/080).
- [ ] T030 **[orchestrator]** Add the TASK-0170 execution-log row to
      `docs/design/m3-runbook-b-resolution-quality.md`: dispatches, test counts, prompt versions, no
      migration, no frozen contract change.
- [ ] T031 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 first: Phase 2 reads `reveals` and the required success text.
- Phase 2 before Phase 3: narrate, audit and the fallback read `consequence` and `revealed`.
- Phase 4 last.

## Parallel opportunities

- Within Phase 1, T006 (seeds) and T007 (fixtures) touch disjoint files from T001–T005.
- Within Phase 3, T024 (fixture) may be written beside T018–T020.

## Implementation strategy

- MVP is Phases 1–2: every check carries a success outcome, and the facts hand it to the narrator.
- Phase 3 makes the narrator and the auditor deliver it. It is the card's user-facing outcome and
  must land in the same PR.

## Card AC to task map

| Card AC | Tasks |
|---|---|
| #1 | T001, T003, T004, T008 |
| #2 | T011, T013, T014, T016 |
| #3 | T018, T021 |
| #4 | T019, T020, T024, T025 |
| #5 | T002, T003, T006, T009, T012, T015, T016, T023, T025 |
