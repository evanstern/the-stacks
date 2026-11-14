# Tasks: dm.react confirm targets parse

**Spec**: `specs/114-react-confirm-targets/spec.md` | **Plan**: `specs/114-react-confirm-targets/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `nodes/schemas.ts`, `packages/intent`, `dm/enqueue.ts`, `dm/deeds.ts`, `pipeline/runner.ts`, `nodes/narrate.ts` or `gate/`.

## Phase 1: Prompt, repair and the test-drive replay (FR-001–FR-007; AC #1, #2)

- [ ] T001 In `prompts/react.ts`, add the ref line, export `EXAMPLE_CONFIRM` and render it, add `targets` to `ReactPromptInput` and the `Targets` section, and bump to `dm.react-v5` (plan D1).
- [ ] T002 In `talk-turn.ts`, add `KnownTarget`, `knownTargets` and `normalizeReact` as pure exports (plan D2).
- [ ] T003 In `talk-turn.ts`, pass `knownTargets(assembled.snapshot)` to the prompt and `normalize` to `callJson`. Record `targetRepairs`. Add `targetRepairs` to `TalkResult` in `talk-triggers.ts`.
- [ ] T004 Extend `test/dm/react-prompt.test.ts` per SC-001. Update the version assertion.
- [ ] T005 Write `test/dm/react-normalize.test.ts` with the SC-003 cases.
- [ ] T006 Extend `test/dm/talk-turn.integration.test.ts`: replay the attempt 1 body and the attempt 2 body through a `say` post (SC-002).
- [ ] T007 Amend `specs/031-dm-runtime/contracts/purposes.md` with a `dm.react-v5` amendment.

## Phase 2: Read-failure notice and re-ask text (FR-008–FR-011; AC #3, brief item 5)

- [ ] T008 In `nodes/resolve.ts`, add `READ_FAILURE_TEXT` and `submitReadFailureNotice` beside `submitFailureNotice` (plan D3).
- [ ] T009 In `worker.ts`, call it after the `dm` notice when the failed job's trigger is `talk`, inside the `dm.notice.failed` try/log pattern.
- [ ] T010 In `pipeline/call.ts` `parseAgainst`, render discriminator issues per plan D4. Read the installed zod issue shape first.
- [ ] T011 Extend `test/dm/call.test.ts` per SC-005.
- [ ] T012 Extend `test/dm/talk-turn.integration.test.ts` with the failure case: an unknown id twice, the job fails, the player projection holds the FR-008 row, and the DM projection holds both notices (SC-004).
- [ ] T013 Extend `apps/web/test/play/view-model.test.mjs`: a public `ai:dm` `ooc` talk row is an `aside` in a player's model.
- [ ] T014 Amend `specs/031-dm-runtime/contracts/resolve.md` (proposal table), `turn-jobs.md` (failed outcome) and `node-seam.md` ("Model calls": re-ask issue text).

## Phase 3: CI scenario confirm deed (FR-012–FR-015; AC #4)

- [ ] T015 In `playtest/scenario.ts`, add `Move.confirm` and the refine that refuses `intent` with `confirm`. In `driver.ts`, pass `confirm` through `nextMove` (not `intent`; spec OQ-4).
- [ ] T016 In `playtest/harness.ts`, set `readWindowMs: () => 0` on the enqueuer. Add the `confirm` branch: declare, drain, accept the seat's live items, drain, or record `NO_CONFIRM` (plan D5).
- [ ] T017 Add the `confirm-search` move to `playtests/scenarios/greyhollow-ford.json` after `act-search`.
- [ ] T018 Extend `test/dm/scripts/greyhollow-ford-deeds.json` with the react reply (attempt 1 body), the ruling calls and any die, in consumption order. Add audit responses to `playtests/fixtures/greyhollow-ford.audit.json`. Keep `scriptRemaining` at zero.
- [ ] T019 Update `test/playtest/playtest.integration.test.ts` (segment count, FR-015), `driver.test.ts` and `scenario.test.ts`. Prove SC-006's negative: with `normalizeReact` stubbed to identity, the run fails. Record the result in the commit message; do not commit the stub.
- [ ] T020 Amend `specs/032-playtest-harness/contracts/scenario.md` (`Move.confirm`, zero read window, the shipped move).

## Phase 4: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T021 `docs/wiki/dm-talk-triggers.md` (`prompts/react.ts`, `talk-turn.ts`, `talk-triggers.ts`, `worker.ts`): `dm.react-v5`, the `Targets` list, `normalizeReact`, `targetRepairs`, the public read-failure notice.
- [ ] T022 `docs/wiki/dm-failure-and-gates.md` (`pipeline/call.ts`, `worker.ts`): the discriminator re-ask text and the read-failure notice.
- [ ] T023 `docs/wiki/playtest-harness.md` (`harness.ts`, `driver.ts`, `scenario.ts`, the scenario JSON, `playtest.integration.test.ts`): `confirm` moves, the zero read window, the confirm deed.
- [ ] T024 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dm-runtime.md` (`call.ts`, `resolve.ts`); `debug-view.md` (`call.ts`, `worker.ts`); `dm-turn-jobs.md`, `turn-floor.md` (`resolve.ts`, `worker.ts`); `presence.md` (`worker.ts`); `party-panel.md`, `seed-npc-presence.md` (`resolve.ts`); `m2-demo.md` (scenario JSON, `playtest.integration.test.ts`); `test-suite.md` (`harness.integration.test.ts`, only if Phase 3 edits it).
- [ ] T025 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` lines for the changed notes, including the `dm.react-v5` mention. Run the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
