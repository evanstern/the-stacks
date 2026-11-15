# Tasks: dm.react confirm params parse

**Spec**: `specs/116-react-confirm-params/spec.md` | **Plan**: `specs/116-react-confirm-params/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `packages/intent`, `nodes/schemas.ts`, `prompts/interpret.ts`, `prompts/companion.ts`, `nodes/narrate.ts`, `prompts/narrate.ts`, `nodes/resolve.ts`, `dm/enqueue.ts`, `dm/deeds.ts`, `pipeline/runner.ts`, `pipeline/call.ts`, `playtest/harness.ts` or `gate/`.

## Phase 1: Prompt, strip, record and the hosted replay (FR-001–FR-011; AC #1, #2)

- [ ] T001 In `prompts/react.ts`, add `PARAMS_LINES` from `INTENT_GRAMMAR`, the rule line and `EXAMPLE_MOVE_CONFIRM`, and bump to `dm.react-v7` (plan D1).
- [ ] T002 Write `dm/react-params.ts` with `ParamsStrip` and `stripParams` (plan D2). Read the installed zod strict-object shape first.
- [ ] T003 In `talk-turn.ts`, run `stripParams` after `normalizeReact` in `normalize`, set `record.stripped`, and pass `check` on the talk outcome. Add `CheckRecord.stripped?` in `nodes/check.ts` and `check` on the talk arm in `pipeline/context.ts` (plan D3).
- [ ] T004 In `worker.ts`, write `check: outcome.check` for a finished talk job.
- [ ] T005 Write `test/dm/fixtures/react-params-hosted.ts` with the four reconstructed fixtures from spec "Replay fixtures (reconstructed)", verbatim.
- [ ] T006 Extend `test/dm/react-prompt.test.ts` per SC-001. Update the version assertion.
- [ ] T007 Write `test/dm/react-params.test.ts` with the SC-002 cases, including the all-members-strict case.
- [ ] T008 Extend `test/dm/talk-turn.integration.test.ts`: replay F1 and F2, attempt 1 and attempt 2, through a `say` post (SC-003–SC-005).
- [ ] T009 Amend `specs/031-dm-runtime/contracts/purposes.md` with a `dm.react-v7` amendment, and `node-seam.md` with the talk `result.check` and its `stripped` list.

## Phase 2: CI scenario invented-params confirm (FR-012–FR-014; AC #2)

- [ ] T010 Merge `origin/main` into the branch. Add the `confirm-move` move to `playtests/scenarios/greyhollow-ford.json` after `deed-move`.
- [ ] T011 Extend `test/dm/scripts/greyhollow-ford-deeds.json` with the react reply (F2's keys on a `move` to `near-bank`) and the ruling turn's calls, in consumption order. Add audit responses to `playtests/fixtures/greyhollow-ford.audit.json`. Keep `scriptRemaining` at zero.
- [ ] T012 Update `test/playtest/playtest.integration.test.ts` (segment count, FR-014). Prove SC-006's negative: with `stripParams` stubbed to identity, the run fails. Record the result in the commit message; do not commit the stub.
- [ ] T013 Amend `specs/032-playtest-harness/contracts/scenario.md` with the shipped `confirm-move`.

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T014 `docs/wiki/dm-talk-triggers.md` (`prompts/react.ts`, `talk-turn.ts`, `worker.ts`, `pipeline/context.ts`): `dm.react-v7`, the params lines, `stripParams`, the talk `result.check` with `stripped`. Add `apps/server/src/dm/react-params.ts` to its `sources:`.
- [ ] T015 `docs/wiki/dm-narration-quality.md` (`talk-turn.ts`, `nodes/check.ts`): `CheckRecord.stripped`, and that a talk job now stores its check record; the `dm.react-v6` mention.
- [ ] T016 `docs/wiki/playtest-harness.md` and `docs/wiki/m2-demo.md` (scenario JSON, deeds script, audit fixture, `playtest.integration.test.ts`): the `confirm-move` deed.
- [ ] T017 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dm-runtime.md` (`nodes/check.ts`, `pipeline/context.ts`); `dm-failure-and-gates.md`, `dm-turn-jobs.md` (`worker.ts`, `pipeline/context.ts`); `debug-view.md` (`worker.ts`: talk rows now carry `check`); `proposal-gate.md`, `test-suite.md` (`talk-turn.ts`); `ingestion.md`, `presence.md`, `turn-floor.md` (`worker.ts`).
- [ ] T018 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` lines for the changed notes, including the `dm.react-v6` → `dm.react-v7` mentions. Run the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
