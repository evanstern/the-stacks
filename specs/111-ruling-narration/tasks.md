# Tasks: Every settled deed is narrated

**Spec**: `specs/111-ruling-narration/spec.md` | **Plan**: `specs/111-ruling-narration/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `dm/enqueue.ts`, `dm/rulings.ts`, `dm/intent-runner.ts` or `gate/`.

## Phase 1: Deed test and narrate window (FR-001–FR-003, FR-006, FR-007)

- [x] T001 Create `apps/server/src/dm/deeds.ts` per plan D1: `Deed`, `isDeedRow`, `narrateWindow`, `windowDeeds`. Keep it pure; import nothing from `gate/` or DB code.
- [x] T002 Write `apps/server/test/dm/deeds.test.ts` with the plan D8 cases.
- [x] T003 In `nodes/narrate.ts`, replace the inline W0/W1 logic with `narrateWindow`. Build `directBatches` from `windowDeeds` for every trigger (plan D3). Export `pendingDeeds(ctx)`.
- [x] T004 In `facts.ts`, add `text` and `stopped` to `directBatches` entries and `deed` to direct `FactSettled` entries (plan D4).
- [x] T005 In `fact-sheet.ts`, add row kind `deed` and `deedLine`. Render a deed row before each direct entry's rows.
- [x] T006 In `prompts/narrate.ts`, render `Direct action: <name>: <text>`, add the every-deed rule line, and bump to `dm.narrate-v25`. Update the prompt and sheet tests the change touches (`narrate.test.ts`, `fact-sheet.test.ts`, `narrate-window.test.ts`).
- [x] T007 Add `Deed: ` to the code-block line regexes in `auditor/checks.ts` (`splitNarration`, dropped from compared dice lines) and `apps/web/app/play/narration-rows.ts` (kept in rules). Add one case each to `test/playtest/checks.test.ts` and `apps/web/test/play/narration-rows.test.mjs`.

## Phase 2: Runner rule and the test-drive replay (FR-004, FR-005; AC #1, #2, note AC)

- [x] T008 In `pipeline/runner.ts`, replace the `trigger !== "intent"` empty-beat exemption with the `pendingDeeds` rule, and the Director skip with the `deedPass` flag (plan D2).
- [x] T009 Extend `test/dm/runner.test.ts` with the plan D8 runner cases.
- [x] T010 Write `test/dm/ruling-narration.integration.test.ts`: the replay steps 1–6 of plan D8 (declared → confirm → 👍 → needs_ruling → ruling → narration, then the move).
- [x] T011 Add to the same file the stranded two-deed case (step 7) and the human-DM case (step 8).
- [x] T012 Amend `specs/031-dm-runtime/contracts/node-seam.md` "Steps" 1 and `specs/098-fact-sheet/contracts/fact-sheet.md` §2 and §3 (row kind `deed`).

## Phase 3: Auditor check `deeds-narrated` (FR-009, FR-010; AC #3 negative proof)

- [x] T013 In `auditor/schema.ts`, append kind `unnarrated-deed` with severity `fail`.
- [x] T014 In `auditor/checks.ts`, append `"deeds-narrated"` to `CHECK_IDS`, add `deedLines` and the self-contained `checkDeedsNarrated` block at the file's end, and call it last in `runChecks` (plan D6).
- [x] T015 In `auditor/segments.ts`, close a tail on a deed carrier as well as on `talk`.
- [x] T016 Add the negative proof to `test/playtest/checks.test.ts`: the test-drive shape fails with one finding citing the move carrier; the fixed shape passes; a tail deed fails. Confirm the clean and doctored fixture tests are unchanged.
- [x] T017 Amend `specs/032-playtest-harness/contracts/auditor.md` "Code checks" and `contracts/audit-report-schema.md` (new kind).

## Phase 4: CI scenario deeds (FR-011, FR-012; AC #3 in CI)

- [ ] T018 In `playtest/scenario.ts`, add `Move.intent`. In `playtest/harness.ts`, submit an Intent move as a confirmed direct Intent (plan D7).
- [ ] T019 Add the two Intent moves to `apps/server/playtests/scenarios/greyhollow-ford.json`. Verify the later moves still reach the camp fight; apply the plan D7 fallback if not, and record why in the commit.
- [ ] T020 Extend `test/dm/scripts/greyhollow-ford-full.json` (ruling call, narrate calls, die) and `playtests/fixtures/greyhollow-ford.audit.json` (two responses) so `scriptRemaining` stays zero.
- [ ] T021 Update `test/playtest/playtest.integration.test.ts` (segment count, `deeds-narrated` passes on every segment) and `harness.integration.test.ts` if its expectations move.
- [ ] T022 Amend `specs/032-playtest-harness/contracts/scenario.md` (`Move.intent`, the two shipped moves).

## Phase 5: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` this card touches (NEEDS-REVIEW):

- [ ] T023 `docs/wiki/dm-runtime.md` (`pipeline/runner.ts`, `nodes/narrate.ts`): the deed rule, `dm/deeds.ts`. Add `apps/server/src/dm/deeds.ts` to its sources.
- [ ] T024 `docs/wiki/dm-narration-quality.md` (`facts.ts`, `fact-sheet.ts`, `prompts/narrate.ts`, `nodes/narrate.ts`): the deed row, `Direct action` line, `dm.narrate-v25` in the prompt-version ledger.
- [ ] T025 `docs/wiki/playtest-harness.md` (`auditor/checks.ts`, `segments.ts`, `schema.ts`, `harness.ts`, `scenario.ts`, the scenario JSON, `playtest.integration.test.ts`): check `deeds-narrated`, Intent moves.
- [ ] T026 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dm-turn-jobs.md`, `dm-failure-and-gates.md`, `dm-plan-gate.md`, `dm-talk-triggers.md` (`runner.ts`); `seed-npc-presence.md` (`nodes/narrate.ts`); `m2-demo.md` (scenario JSON, `playtest.integration.test.ts`); `play-route.md` (`narration-rows.ts`).
- [ ] T027 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` lines for the changed notes, including the `dm.narrate-v25` mention. Run the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
