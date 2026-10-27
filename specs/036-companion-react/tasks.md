---
description: "Task list for companion react (TASK-0114)"
---

# Tasks: A human reaction re-runs the companion whose action is pending

**Input**: `specs/036-companion-react/` — spec.md, plan.md.

**Tests**: required. Every card AC is proven by a named test.

**Dispatch unit**: one phase is one implementer dispatch (sonnet). Run phases in order:
1, 2, 3, 4. **Phase 3 runs only after operator checkpoint W rules W-A**, recorded on the card.
Under W-B, skip Phase 3 and run T038 instead.

**Gate for every phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 4 also runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate both databases
by hand (fresh stacks come up unmigrated, TASK-0098). Restart the app. Run the suites with
`REQUIRE_DATABASE=1`. Leave the stack up.

**Known flake**: the WebSocket gateway integration tests flake. Re-run once on an unrelated
WebSocket failure. Do not fix them. Record each re-run in the phase's commit message.

**Rules for every phase**: add no runtime dependency. Add no env variable. Never edit `.env`.
Generate migrations with `drizzle-kit generate`; never hand-edit `meta/_journal.json`. Do not
change `specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md` or
`docs/wiki/ws-protocol.md` frame shapes outside Phase 3. Tests use the fake gateway only.

**Commits**: one or more per phase, each message led by `TASK-0114:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 human reaction enqueues the companion, integration test | T012, T013 |
| #2 re-run companion commits/revises/withdraws; table no longer waits | T021 (M2 repro), T022, T023; T035, T036 under W-A; T038 under W-B |
| #3 companions contract records the trigger | T026 |
| Runbook merge condition (M2 stall reproduced, companion re-runs) | T021 |

---

## Phase 1: Trigger and coalescing (US1, US3; AC #1) — DISPATCH (sonnet)

**Goal**: a human comment on a companion's open action queues one coalesced `react` job, which
the worker claims only after its start time.

- [x] T010 [US1] In `apps/server/src/dm/jobs.ts`, add `"react"` to `CompanionJobInput.reason`.
  Add optional `firstReactionAt` and `notBefore` (ISO datetime strings). Keep `v: 1`; existing
  rows parse unchanged.
- [x] T011 [US3] In `apps/server/src/schema/jobs.ts`, add partial unique index
  `jobs_companion_react_queued_key` on `session_id` where `kind = 'companion'`,
  `status = 'queued'` and `input->>'reason' = 'react'`. Run `drizzle-kit generate`. Commit the
  generated SQL, snapshot and journal entry.
- [x] T012 [US3] In `apps/server/src/dm/jobs.ts`, add
  `enqueueCompanionReact(db, sessionId, companionId, { quietMs, maxWaitMs })` per plan.md
  "Coalescing design": insert on conflict do nothing; else merge the companion id and move
  `notBefore` to `least(now() + quietMs, firstReactionAt + maxWaitMs)` in one SQL update; loop
  when the queued row vanished. Use database `now()` for both times. Add the `notBefore`
  predicate to `claimDmJob`'s queued branch. Tests in
  `apps/server/test/dm/jobs.integration.test.ts`: (a) two enqueues give one row with both ids;
  (b) a row with a future `notBefore` is not claimed and is claimed after it passes; (c) the
  maximum wait caps a moving `notBefore`; (d) ten concurrent enqueues (`Promise.all`) leave
  exactly one queued row; (e) a running `react` job plus a new reaction gives one new queued row.
- [x] T013 [US1] In `apps/server/src/dm/enqueue.ts`, add the react rule (FR-001–FR-004): for each
  `action.commented` row whose actor is human (not prefixed `ai:`), load projections once, find
  the action; when it is open and its actor is `ai:companion:<id>`, call
  `enqueueCompanionReact`. Add `reactQuietMs` (default 3000) and `reactMaxWaitMs` (default 10000)
  to `DmEnqueuerDeps`. Keep the commit and approval rules first and unchanged. New file
  `apps/server/test/dm/companion-react.integration.test.ts`: (a) a human comment of each stance
  queues one `react` job naming the companion; (b) comments by `ai:dm` and by a companion queue
  none; (c) a human comment on a human's action queues none; (d) five human comments queue one
  job.
- [x] T014 Run the phase gate and the DB suites. Commit.

**Checkpoint**: AC #1 met. The worker runs a `react` job with today's companion behavior.

---

## Phase 2: Resolution, the M2 repro and the contract (US2, US3, US4; AC #2, #3) — DISPATCH (sonnet)

**Goal**: every companion run decides its own open actions; the M2 stall cannot recur.

- [x] T020 [US2] In `apps/server/src/dm/companion.ts`, add `pending` to `CompanionOutput`
  (`{ actionId, decision: "commit", text: null }[]`, max 4) per plan.md "Resolution design".
  Implement: the react skip rule (FR-009, no model call); per own open action, the model's
  decision or the default `commit` (FR-012); `commit` submits `action.commit` for the existing
  id (FR-013); a new `act` is dropped and logged while an own action stays open; in turn mode the
  active companion commits its open action instead of declaring a new one, and a non-active
  companion's commit is not submitted (FR-014). Reason `react` ends with nothing more (FR-015).
- [x] T021 [US2] M2 repro in `companion-react.integration.test.ts`, named
  `"M2 e8c848ec seq 35-38: a human reaction re-runs Odo and closes act-odo-1"`: free mode;
  Odo declares `act-odo-1` uncommitted; the human comments ("Who is there?"), then approves
  ("Let's be cautious"); listener quiet window 0; drain the worker with fake-gateway output that
  commits. Assert one `dm.companion` call, `act-odo-1` committed by `ai:companion:odo`, a turn
  job ran, and `act-odo-1` is `resolved`. Run it once on the Phase 1 tip before T020 lands and
  record in the commit message that it failed there.
- [x] T022 [US2] In the same file: (a) invalid companion output still commits the open action
  (default); (b) a `prompt` run whose output declares a new act while `act-odo-1` is open commits
  `act-odo-1` and declares nothing new (the seq 44 case); (c) a skipped run makes no model call.
- [x] T023 [US3] In the same file: five human comments inside the window, then drain: exactly one
  `dm.companion` call, and the captured prompt carries all five comment texts.
- [x] T024 [US2] In `apps/server/test/dm/companion.integration.test.ts`: (a) turn mode, a
  non-active companion's react run submits no commit; (b) the active companion with an open
  action commits that action and declares no second one. Keep every existing test's outcome.
- [x] T025 [US2] In `apps/server/src/dm/prompts/companion.ts`, split own open actions (with
  comments and stances) from others' open actions; instruct one decision per own action; bump
  `PROMPT_VERSION`. Update tests that assert the version
  (`player-facing-prompts.test.ts`, others found by grep). Add `pending: []` to every
  fake-gateway companion fixture or script the schema now rejects.
- [x] T026 [P] [US4] Amend `specs/031-dm-runtime/contracts/companions.md`: reason `react` (trigger,
  coalescing rule, skip rule, ending), the `pending` field, the default decision, the turn-mode
  rule. Amend `specs/031-dm-runtime/contracts/turn-jobs.md` "Enqueue" (react rule) and "Claim"
  (`notBefore` predicate, new index). Each amended section ends with
  "Amended by specs/036-companion-react."
- [x] T027 Run the phase gate and the DB suites, including `worker.integration.test.ts` and
  `full-turn.integration.test.ts`. Commit.

**Checkpoint**: AC #2 (commit path) and AC #3 met. The runbook merge condition holds (T021).

---

## Phase 3: Withdraw lifecycle (US2; AC #2) — DISPATCH (sonnet), ONLY AFTER CHECKPOINT W = W-A

**Goal**: a companion (or human) can withdraw or revise an open action.

- [x] T030 Merge `origin/main` into the branch (session-model and play hotspots). Re-run the
  Phase 2 gate.
- [x] T031 [US2] In `packages/session-model`: `ActionWithdrawnV1` (`{ actionId }`) in
  `events/actions.ts`; register `action.withdrawn` in `catalog.ts`; `ActionStatus` gains
  `withdrawn`; `applyLifecycle` moves an open action to `withdrawn` and ignores any other
  (FR-018). Unit tests for each transition.
- [x] T032 [US2] In `packages/session-model/src/gate/`: proposal kind `action.withdraw`
  (`{ actionId }`); permission for the action's declarer and for a DM (FR-017); the planner
  refuses a withdraw of a non-open action before writing. Unit tests.
- [x] T033 [US2] Amend `specs/029-proposal-gate/contracts/proposals.md` (thirteen kinds,
  schema, permission-matrix row) and `proposal-events.md`, each citing the checkpoint-W ruling
  on TASK-0114.
- [x] T034 [US2] In `apps/server/src/dm/companion.ts`, widen `decision` to
  `commit | withdraw | revise` (`text` required for `revise`); `withdraw` submits
  `action.withdraw`; `revise` submits `action.withdraw` then `action.declare` (and
  `action.commit` when not in non-active turn mode). Default is `withdraw` when the latest human
  stance is `object` (FR-012). Update the prompt; bump `PROMPT_VERSION` again.
- [x] T035 [US2] Tests in `companion-react.integration.test.ts`: (a) objection then withdraw:
  status `withdrawn`, no turn job queued; (b) revise: old `withdrawn`, new action declared with
  the new text and committed; (c) invalid output after an objection withdraws.
- [x] T036 [US2] In `apps/web/app/play/view-model.ts` and the action card component, render a
  `withdrawn` action as closed, with no commit control and no "Waiting for … to commit" line.
  No modals. Update its unit test.
- [x] T037b [US2] Phase 3b: in turn mode, an active companion that withdraws its only open action
  ends its turn in the same run. After the decisions, if it committed nothing, it declares and
  commits the hold act. Non-active companions are unchanged. Test in
  `companion-react.integration.test.ts`: objection, withdraw, a new action committed, turn advances.
- [x] T037 Run the phase gate and the DB suites. Commit.

**Under W-B instead of Phase 3:**

- [x] T038 Orchestrator: append a bypass note to TASK-0114 AC #2 ("revise or withdraw" not built, checkpoint W ruled W-B) and create the follow-up card for W-A, cited in the note. — not applicable: operator ruled W-A (2026-10-26)

---

## Phase 4: Wiki (re-ground) — DISPATCH (sonnet)

- [x] T040 Classify every staled pin against `git diff <old-pin>..HEAD -- <sources>` as
  RE-PIN-ONLY or NEEDS-REVIEW. Expected NEEDS-REVIEW (runbook): `docs/wiki/dm-runtime.md`
  ("Companions and chronicle": reason `react`, the pending-action rule) and
  `docs/wiki/dm-turn-jobs.md` (kinds and payloads, the react enqueue rule, the claim predicate,
  the new index). Under W-A also `docs/wiki/proposal-gate.md` and `docs/wiki/session-model.md`
  (thirteen kinds, `action.withdrawn`, status `withdrawn`), and `docs/wiki/play-route.md` if
  T036 changed it. Amend prose before bumping each NEEDS-REVIEW pin.
- [x] T041 Regenerate `docs/wiki/CAPSULES.md` when any `description:` changed. Update the state
  paragraph in `docs/wiki/INDEX.md` with one sentence on companion reactions.
- [x] T042 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs
  freshness . docs/wiki` (prints `OK`), the spec-bridge check, and `pnpm ci:check`. Commit.

**Checkpoint**: the task is ready for PR.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → (checkpoint W) → Phase 3 or T038 → Phase 4.
- Within Phase 2, T026 is independent of T020–T025 and may run in any order inside the phase.
- Phases 1 and 2 touch `dm/jobs.ts`, `dm/companion.ts` and the claim query: runbook hotspots
  shared with TASK-0116 and TASK-0052. Merge `origin/main` before each phase.
