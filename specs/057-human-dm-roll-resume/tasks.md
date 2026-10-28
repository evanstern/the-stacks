# Tasks: With a human DM, an approved check roll narrates

**Input**: `specs/057-human-dm-roll-resume/` — spec.md (OQ-1 to OQ-4 pending), plan.md,
contracts/turn-resume.md, quickstart.md.

**Tests**: required. Every phase is red-first: write the test, run it, see it fail for the stated
reason, then implement.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order.

**Format**: `[ID] [P?] [Story] Description`. `[P]` = a different file with no open dependency.
`[US1]` = an approved roll narrates. `[US2]` = a chain resumes step by step. `[US3]` = other turns
leave a paused action alone. "(orchestrator)" = the orchestrator runs it, because implementers
cannot export `TEST_DATABASE_URL`.

**Standing rules for every phase**:

- Work only in `/Users/evanstern/projects/the-stacks/.worktrees/task-0168`.
- Run `pnpm install --frozen-lockfile` first in a fresh worktree.
- Do not change any `specs/029-proposal-gate/contracts/` file,
  `specs/030-play-route/contracts/proposal-seam.md`, or `docs/wiki/ws-protocol.md` frame shapes.
- Do not change the policy table, the gate, narrate, audit, facts or the claim gate.
- Never read, print or commit keys or passwords. No paid model call.
- Commit with `git -C <literal worktree path>`, staging and committing in separate Bash calls.
  Lead each commit message with `TASK-0168:`.
- Server tests: `pnpm --filter @the-stacks/server test`. End each phase with `pnpm ci:check` green.

---

## Phase 1: The resume classifier and the prior-turn read (card AC #2)

**Goal**: pure functions that classify a beat candidate and refresh an approved submission, plus
the jobs read that feeds them.

**Independent test**: `test/dm/resume.test.ts` passes.

- [x] T001 [P] [US1] Red: write `apps/server/test/dm/resume.test.ts` against plan.md "Data model". Cover: `awaitingActionIds` picks a pending `ai:dm` `mechanics`, `scene-presence` and `action.resolve` proposal, and ignores approved, rejected and non-`ai:dm` ones. `findResumedPlans` returns a plan when the newest job with `act:<id>:` keys ends with a `pending` submission whose proposal is approved; returns none when that proposal is rejected or pending, when the last submission is `applied`, or when the reading is missing; takes the newest job when two hold keys; carries the ruling when present. `refreshSubmission` sets `applied`, `decided.batchId`, the `check.resolved` outcome, `seqs: []`, and keeps `stepRef`. Build projections from session-model fixtures or hand-built objects. Run it and see it fail on the missing module.
- [x] T002 [US1] Create `apps/server/src/dm/resume.ts` per plan.md. Import types only from `nodes/` and `jobs.ts`. Make T001 pass.
- [x] T003 [US1] Add `resumed?: ResumedPlan[] | null` to `TurnCheckpoint` in `apps/server/src/dm/jobs.ts`. Add `loadPriorTurnCheckpoints(db, sessionId, excludeJobId)` per plan.md. Add the optional `loadPriorTurns` to `NodeDeps` in `pipeline/context.ts`.
- [x] T004 [US1] In `apps/server/src/dm/worker.ts`, wire `loadPriorTurns` to `loadPriorTurnCheckpoints(db, …)`. Set `resumed: null` wherever the worker builds an empty checkpoint.
- [x] T005 Add the line "Amended by specs/057-human-dm-roll-resume/contracts/turn-resume.md." under the "Outcomes by gate result" paragraph of `specs/031-dm-runtime/contracts/resolve.md`, and beside the other "Amended by" lines of `specs/031-dm-runtime/contracts/nodes.md`.

---

## Phase 2: The pipeline reuses the plan (card AC #1, card AC #2)

**Goal**: assemble, runner, interpret, adjudicate and resolve apply `contracts/turn-resume.md`.

**Independent test**: the new unit cases in `assemble.test.ts`, `interpret.test.ts` and
`runner.test.ts` pass; every existing DM unit test passes unchanged.

- [x] T006 [P] [US3] Red: in `apps/server/test/dm/assemble.test.ts`, add: a committed action named by a pending `ai:dm` `check.roll` proposal is not in the beat; a frozen beat ignores the rule; with `loadPriorTurns` returning a paused job and an approved proposal, `output.resumed` holds the plan; with `checkpoint.resumed` set, assemble returns it and does not call `loadPriorTurns`; without an `ai:dm` proposal naming a candidate, `loadPriorTurns` is not called.
- [x] T007 [P] [US1] Red: in `apps/server/test/dm/interpret.test.ts`, add: with every beat item resumed and no monster turn, interpret makes no call and returns the resumed readings in beat order; with one fresh and one resumed item, the expected set is the fresh one and the output merges both. In `runner.test.ts`, add: a resumed reading with `needsAdjudication: true` does not run adjudicate; the runner stores `resumed` with the beat on attempt 1.
- [x] T008 [US3] In `apps/server/src/dm/nodes/assemble.ts`: on the fresh path, drop `awaitingActionIds` from the beat. Compute `resumed` from `checkpoint.resumed` when it is non-null; else from `findResumedPlans` over `deps.loadPriorTurns(sessionId, job.id)` when `needsPriorTurns` holds; else `[]`. Add `resumed` to `AssembleOutput`.
- [x] T009 [US1] In `apps/server/src/dm/pipeline/runner.ts`, store `resumed` in the checkpoint beside `beat` (first attempt only). Make `needsAdjudication` ignore readings whose action id is resumed.
- [x] T010 [US1] In `apps/server/src/dm/nodes/interpret.ts` and `prompts/interpret.ts`, apply FR-006: expected ids exclude resumed; no call when none remain; the prompt's beat entries and "Already applied" list fresh items only; merge resumed readings in beat order.
- [x] T011 [US1] In `apps/server/src/dm/nodes/adjudicate.ts`, skip resumed readings and append each resumed plan's non-null ruling to `rulings`.
- [x] T012 [US1] [US2] In `apps/server/src/dm/nodes/resolve.ts`, after `new Run(ctx)`, add each `refreshSubmission(assembled.projections, s)` from `assembled.resumed` whose key the run does not hold. Make T006 and T007 pass and the full server unit suite green.

---

## Phase 3: DB test, scripts and mutation guard (card AC #1)

**Goal**: the DB test proves the narrated resume, and the scripts match the new call order.

**Independent test**: `human-dm-roll-resume.integration.test.ts` passes on the worktree stack
(orchestrator) and `dm-scripts.test.ts` passes.

- [x] T013 [US1] Edit `apps/server/test/dm/scripts/human-dm-approval.json` and `apps/server/dm-scripts/greyhollow-human-dm.json`: remove the second `dm.interpret` entry (note "the resumed turn interprets the committed action again"). Reword the second director's note to "turn that resumes after the human DM approves the roll". `dm-scripts.test.ts` must pass unchanged.
- [x] T014 [P] [US2] Create `apps/server/test/dm/scripts/human-dm-roll-chain.json`: dice `[18]`; calls director, interpret (one `check` DC 13 with one `onSuccess` `condition` apply on `tamsin`, e.g. `prone`, or another effect the engine accepts on the seed), director, director, narrate, audit. Original text only.
- [x] T015 [US1] [US2] [US3] Write `apps/server/test/dm/human-dm-roll-resume.integration.test.ts`, modelled on `human-dm-scene.integration.test.ts` (human seat via `dm.seat`, `startScene`, `workerFor`, `drainAll`). Case (a), `human-dm-approval.json`: commit `act-search`, drain; one pending `check.roll`; approve, drain; the approval job is `succeeded`, `completed`, call purposes exactly `dm.director`, `dm.narrate`, `dm.audit`; one `check.roll` proposal on the session; the action is `resolved`, outcome `applied`, `batchIds` hold the roll's `decided.batchId`; one pending narration proposal names the action; scripted dice and calls are spent. Case (b): with the roll pending, `enqueueTurn(…, "manual")` and drain; that job is `empty-beat` with no calls; still one `check.roll`. Case (c), `human-dm-roll-chain.json`: approve the roll; the next turn calls only `dm.director`, proposes the effect pending and no second roll; approve the effect; the next turn calls `dm.director`, `dm.narrate`, `dm.audit` and resolves the action `applied` with both batch ids.
- [x] T016 (orchestrator) Run the DB suite on the worktree stack: export only `TEST_DATABASE_URL` from the worktree `.env`, `REQUIRE_DATABASE=1`, then `human-dm-roll-resume`, `human-dm-scene`, `resolve.human-seat`, `full-turn`, `reclaim` and `worker` integration tests. Re-run a 5 s timeout once (TASK-0154) and record it. Record the results in `specs/057-human-dm-roll-resume/evidence/db-run.md`.
- [x] T017 (orchestrator) Mutation guard: make `findResumedPlans` return `[]` and `awaitingActionIds` return an empty set. Run T015. Expect (a), (b) and (c) red. Revert. Run again green. Record both runs in `evidence/mutation-guard.md`.

---

## Phase 4: Live check in script mode (card AC #1)

**Goal**: in Brave, a human DM approves a check roll and the table narrates.

**Independent test**: `evidence/live-run.md` records quickstart.md steps 1 to 10, with shots.

- [ ] T018 [US1] Write `specs/057-human-dm-roll-resume/evidence/live-resume.mjs` (Brave, Playwright), adapting `specs/055-human-dm-scene-change/evidence/shoot-live.mjs`, `start-human-dm.mjs` and `specs/053-env-fake-dm-script/evidence/declare.mjs`. It runs quickstart steps 5 to 9, takes the shots, asserts 0 modals, and prints job ids, outcomes and call purposes from the `/dm` debug routes. It reads credentials from the file argument and never prints them.
- [ ] T019 (orchestrator) Run quickstart.md on the `task-0168` stack. Record steps, jobs, calls, the `action.resolved` row and the `check.roll` count in `evidence/live-run.md`. Commit the shots.

---

## Phase 5: Re-ground and close (all ACs)

**Goal**: the wiki describes the resume, pinned honestly; the runbook records the PR.

**Independent test**: the freshness gate prints `OK`; the spec-bridge gate exits 0.

- [ ] T020 Re-verify and re-pin `docs/wiki/dm-runtime.md` (assemble awaiting/resumed, interpret and adjudicate fresh-only, resolve seeding; the 031 amendment), `docs/wiki/dm-turn-jobs.md` (the resume after approval, `TurnCheckpoint.resumed`, `loadPriorTurnCheckpoints`, reconcile skips an awaiting action), `docs/wiki/dm-failure-and-gates.md` (sources `jobs.ts`, `worker.ts`, runner, context: confirm no failure-record change), and `docs/wiki/runtime-stacks.md` (`greyhollow-human-dm` is 10 calls; a pending roll no longer reconciles). Add `apps/server/src/dm/resume.ts` to the sources of `dm-runtime` and `dm-turn-jobs`.
- [ ] T021 Update the `docs/wiki/INDEX.md` state paragraph with one TASK-0168 sentence. Regenerate `docs/wiki/CAPSULES.md` with the grounding-wiki `capsules.mjs` script if any `description:` changed.
- [ ] T022 Add a TASK-0168 "(this PR)" row to `docs/design/m3-table-sweep-runbook.md`: resumed turn reuses the paused plan; 031 resolve.md and nodes.md amended; DB test mutation-checked; script-mode live run in Brave; OQ-1 to OQ-4 status.
- [ ] T023 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (expect `OK`), `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (expect exit 0) and `pnpm ci:check`.

---

## Dependencies and order

Phase 1 → Phase 2 → Phase 3 (T016, T017 after T015) → Phase 4 (T019 after T018) → Phase 5.
Within a phase, `[P]` red tests may be written together.

## Card AC coverage

| Card AC | Tasks |
|---|---|
| #1 narrates in the resumed turn, no second roll proposal, a DB test | T006 to T019 |
| #2 reuses the resolved check, or a spec records why | spec.md "Decision", contracts/turn-resume.md, T001 to T012 |
