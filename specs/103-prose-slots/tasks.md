# Tasks: Narration as prose slots; retire the audit loop

**Spec**: `specs/103-prose-slots/spec.md` | **Plan**: `specs/103-prose-slots/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only.

## Phase 1: Check module and helper moves

- [x] T001 Move `namedActorIds` from `apps/server/src/dm/claims.ts` to `apps/server/src/dm/snapshot/aliases.ts`. Keep the unique-alias, whole-word rule. Re-point `nodes/resolve.ts`.
- [x] T002 Rename `apps/server/src/dm/audit-words.ts` to `apps/server/src/dm/narration-words.ts`. Re-point every importer, including `playtest/auditor/checks.ts`.
- [x] T003 Write `apps/server/src/dm/narration-check.ts` per plan D1: `checkNarration`, `dropSentences`, `CheckInput`, `CheckIssue`.
- [x] T004 Write `apps/server/test/dm/narration-check.test.ts`. Cover each leak kind and each contradiction kind, with a pass case for quotes, negation and "no sign of". Port each still-valid leak or contradiction case from `claims.test.ts` and `audit.test.ts`.

## Phase 2: `why` rows and the digit drop

- [x] T005 Move `spellDigits` from `apps/server/src/dm/fallback.ts` into `apps/server/src/dm/fact-sheet.ts`.
- [x] T006 Add `"why"` to `FactRow.kind` and `planFacts?` to `FactSheetInput`. Type it as `IntentRecorded["facts"][number]`.
- [x] T007 Write `renderWhyRows` per spec 098 contract §6. Render after change rows, before the State line. `unserved` renders no row.
- [x] T008 In `parseSlots`, drop each describe or ask sentence that holds a digit.
- [x] T009 Write `apps/server/test/dm/why-rows.test.ts`: one case per `PlanFact.kind`. Extend `fact-sheet.test.ts`: every digit in `composeReply` output lies in a row or the State line (constitution VII gate).

## Phase 3: Turn pipeline swap and deletions

- [ ] T010 Write `apps/server/src/dm/nodes/check.ts` per plan D2. Rename node `audit` to `check` in `pipeline/context.ts`, `pipeline/runner.ts` and `worker.ts` `DEFAULT_NODES`.
- [ ] T011 In `nodes/narrate.ts`: remove `prior` from `narrateAttempt`; return empty slots on a call error; collect `planFacts` from the beat's `intent.recorded` rows (spec OQ-8); rewrite `withholdRefusedInputs` on `checkNarration` (plan D3).
- [ ] T012 In `prompts/narrate.ts`: remove the regenerate section; render `why` rows; bump to `dm.narrate-v24`.
- [ ] T013 In `nodes/resolve.ts`: `submitNarration` takes `CheckOutput` and submits each correction as an AI-DM `talk` proposal. Remove the `audit-flag` journal entry.
- [ ] T014 In `jobs.ts`: checkpoint `narration.check: CheckRecord`; move `AuditRecord` there as `LegacyAuditRecord` for old rows.
- [ ] T015 In `talk-turn.ts` and `prompts/react.ts`: remove the second react call and the `prior` section; run `checkNarration`; bump to `dm.react-v3`.
- [ ] T016 In `gates/plan-gate.ts`: delete the spec 058 reason check and `REASON_CONTRADICTS_STATE` (spec OQ-1). Delete its tests.
- [ ] T017 Remove `dm.audit` from `purposes.ts` and any AI config purpose list (`git grep dm.audit`).
- [ ] T018 Delete `dm/claims.ts`, `dm/fallback.ts`, `dm/nodes/audit.ts`, `dm/prompts/audit.ts` and the test files plan.md lists. `git grep -E "claims\.js|fallback\.js|nodes/audit|prompts/audit"` returns nothing.
- [ ] T019 Write `apps/server/test/dm/check-node.test.ts`: one `dm.narrate` call and no `dm.audit` call per turn; a leak drops the sentence and appends a `dm` correction; a life-state contradiction ships and appends a public correction; a narrate error ships restate, rows and State; the turn job completes in every case. Fix the remaining tests that imported deleted modules.

## Phase 4: Job-record consumers

- [ ] T020 `playtest/export.ts` and `routes/dm.ts`: add `check` to `JobItem`; keep `audit` for old rows.
- [ ] T021 `playtest/auditor/audit.ts`: the `dm-audit-flag` note reads `check`, else legacy `audit`. `playtest/budget.ts`: drop `dm.audit`.
- [ ] T022 `apps/web/app/debug/{job-view.ts,read-result.ts,labels.ts,components/job-card.tsx}`: section `narrate-check` shows `check` or legacy `audit`. `apps/web/test/no-dialog.test.mjs` stays green.
- [ ] T023 Update `test/playtest/checks.test.ts` and the web debug tests for both record shapes.

## Phase 5: C-AUD replay script

- [ ] T024 Write `apps/server/src/cli/replay-checks.ts` per plan "C-AUD replay" (c). It reads a file only.
- [ ] T025 Confirm the B2-era ship format with `git show 087ecb7f:apps/server/src/dm/nodes/audit.ts` and encode the prose/rows split.
- [ ] T026 Write `apps/server/test/fixtures/c-aud-export.sample.json` (three narrations: one clean, one leak, one fallback) and `apps/server/test/cli/replay-checks.test.ts` asserting the printed counts.

## Phase 6: Wiki re-ground

- [ ] T027 `docs/wiki/dm-narration-quality.md` (NEEDS-REVIEW): replace the audit loop and fallback sections with the check node, corrections and `why` rows; record `dm.narrate-v24`, `dm.react-v3`, `dm.audit-v17` retired. Re-point sources.
- [ ] T028 `docs/wiki/output-claim-gate.md` (NEEDS-REVIEW): mark the note retired by TASK-0272, point to `narration-check.ts`, and drop deleted sources. Follow the corpus's retired-note convention.
- [ ] T029 `docs/wiki/dm-runtime.md` (NEEDS-REVIEW): pipeline ends in `check`; seven purposes become six; one narration call per turn.
- [ ] T030 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`. Re-pin honestly. The freshness gate prints `OK`.
