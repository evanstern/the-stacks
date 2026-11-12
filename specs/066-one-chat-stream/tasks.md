# Tasks: One chat stream — server half (TASK-0199)

**Input**: `specs/066-one-chat-stream/` spec.md (with "Amendment (2026-11, Intent contract v1.1)")
and plan.md. Re-derived from scratch on 2026-11-11 after the C-AMD ruling ("Approve all"): the
split, C-1 to C-9 and OQ-2 to OQ-9 as recommended. The 2026-11-02 task list is in git history.

**Scope**: the server half only. The web half (composer, Enter commit, ring and confirm UI, Brave
live check) is TASK-0315. This card ships no `apps/web` change.

**Prerequisites**: TASK-0314 is merged into `origin/main` and merged into this branch before
Phase 3 (OQ-4). Spec 102 and spec 104 are merged.

**Dispatch**: one phase is one sonnet implementer dispatch, re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are not the implementer's. Each implementer phase
ends with `pnpm ci:check` green and one commit led by `TASK-0199:`. Use `git -C <literal worktree
path>` for add and commit, in separate Bash calls. Serial hotspots: `gate/{proposals,plan,intents}.ts`,
`catalog.ts`, `events/*.ts`, `dm/{talk-turn,jobs,enqueue}.ts`.

## Phase 1: Session model — event, catalog, projection, read rule (card AC #1, #2, #4)

- [x] T001 In `packages/session-model/src/events/actions.ts`, add `SuggestionItemV1` and
      `ActionSuggestedV1` (plan D1). Refine: each item Intent has `commit: "declared"`; item ids are
      unique. Leave `ActionDeclaredV1` unchanged.
- [x] T002 In `events/presence.ts`, add `"read"` to `PRESENCE_PURPOSES`. Update the header comment.
- [x] T003 In `catalog.ts`, add `session("action.suggested", "lifecycle", ActionSuggestedV1)`.
- [x] T004 In `projections/types.ts` and `apply.ts`, add `suggestions`, the `action.suggested`
      transcript entry and `PresenceView` purpose `read`. Count a duplicate suggestion id in
      `ignoredTransitions`.
- [x] T005 Create `packages/session-model/src/read.ts`: `isDmQuestion`, `readablePosts` (spec FR-006
      rules 1 to 4, including the OQ-9 id rule), `latestReadablePostSeq`, `readWindowMs`,
      `READ_QUIET_MS`, `RING_BLANK_MS`, `isDmReadOutput`, `suggestionState(p, intentId)` (spec FR-018; takes the item Intent id).
- [x] T006 Export the T005 names from `src/index.ts`.
- [x] T007 Create `fixtures/one-chat-stream.ts` (plan D1) and add it to `fixtures/index.ts`.
- [x] T008 Create `packages/session-model/test/read-rule.test.ts`. Cover each FR-006 rule and its
      negations: turn mode (rules 1, 2, 4 return nothing), a human seat (every rule returns nothing),
      a runner declare `<actionId>.<n>`, a whisper, `ai:dm`, an `ooc` line, `@dmx`. Cover both
      windows, `isDmReadOutput`, and `suggestionState` (stale by a later suggestion, by a no-action
      narration, by a switch to turn mode; not stale by a commit narration; confirmed).
- [x] T009 Amend `catalog.test.ts`, `presence.test.ts` and `fixtures.test.ts` for the new entry,
      purpose and fixture. Confirm `talk-isolation.test.ts` passes unchanged.
- [x] T010 Run `pnpm ci:check`.

## Phase 2: Gate — suggest, accept, `ask_dm` (card AC #3, #5)

- [x] T011 In `packages/session-model/src/gate/proposals.ts`, add the `action.suggest` and
      `action.accept` kinds and schemas. Exclude `action.accept` from `DmProposalKindSchema`.
- [x] T012 In `policy.ts`, add `"action.suggest": "auto"`. Refuse `ai:dm` `action.accept` in
      `routeProposal`.
- [x] T013 In `permissions.ts`, add `action.suggest` to the DM-kind row. Pass `action.accept` for
      human proposers only.
- [x] T014 In `refusals.ts`, add `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND`.
- [x] T015 In `plan.ts`, extract the declare block's `CHARACTER_UNABLE` test into
      `unableRefusal(p, proposer, scope, characterId)`. Keep the declare rows and codes byte-equal.
- [x] T016 In `plan.ts`, plan `action.suggest`: id reuse `INVALID_PROPOSAL`; item actors must be
      `pc` ids a human controls; item Intent ids `<suggestionId>.<itemId>`; the `ai:dm`-only `readSeq` guard `SUGGESTION_STALE`; one public row.
- [x] T017 In `plan.ts`, plan `action.accept` (spec FR-016): the four checks in order, then
      `planIntent` with the item Intent at `commit: "confirmed"`, `source: "composer"`, and the
      party actor re-stamp. A second 👍 returns `INTENT_EXISTS`.
- [x] T018 In `gate/intents.ts`, serve `ask_dm` in `planGateKind` (spec FR-028): a `talk` row
      (`ooc`, `characterId` null) and the carrier, both with visibility the proposer's user id.
      Remove the `ask_dm` entry from `UNSERVED_OWNER`.
- [x] T019 In `apps/server/src/gate/gate.ts`, widen the `recordPresence` purpose type to `read`.
- [x] T020 Create `packages/session-model/test/gate-suggest.test.ts`. Cover each suggest and accept
      rule, one accept test per item-Intent outcome (`settled`, `needs_ruling`, refusal), the party
      re-stamp, `INTENT_EXISTS` on a second 👍, a stale 👍, and `ai:dm` accept refused.
- [x] T021 Create `packages/session-model/test/gate-ask-dm.test.ts`. Cover the two rows, their
      visibility, a companion or DM proposer refused, and SC-004a: `engine`, `actions`, `party`,
      `encounter` and `tableMode` deep-equal before and after.
- [x] T022 Amend `gate-schemas.test.ts` (18 kinds, 22 request literals), `gate-policy.test.ts`,
      `gate-permissions.test.ts`. In `apps/server/test/write-boundary.test.ts`, add the two pins
      (plan D2). In `apps/server/test/gate.intent.integration.test.ts`, cover suggest then accept
      over the real gate, and two concurrent accepts (one plans).
- [x] T023 Run `pnpm ci:check`.

## Phase 3: DM runtime — window, marker, interrupt, read, rule 9 (card AC #1, #2, #5, #7)

- [x] T024 Merge `origin/main` into the branch (TASK-0314 must be on it). Stop and report if it is not.
      Done by the orchestrator: e0ef496a.
- [x] T025 In `apps/server/src/dm/talk-triggers.ts`, delegate `isReadable` to `readablePosts`. Make
      `needsModel` follow spec FR-010 (no call for rule-2-only reads).
- [x] T026 In `dm/jobs.ts`, change `enqueueTalkTurn` to `notBefore = postTs + windowMs` with no cap.
      Old rows with `firstPostAt` still parse.
- [x] T027 In `dm/jobs.ts`, add `interruptRead` (plan D3). Add `intent` to `TurnTriggerSchema`.
- [x] T028 In `dm/enqueue.ts`, rewrite rule 6: interrupt, then queue or move the read. Replace
      `talkQuietMs` and `talkMaxWaitMs` with the `readWindowMs` seam. Update the header comment.
- [x] T029 In `dm/enqueue.ts`, add rule 9 beside TASK-0314's resume rule (spec FR-031): a settled or
      stopped carrier row in a batch no turn job appended queues a coalesced `intent` turn. Reuse
      TASK-0314's "appended by a job" test.
- [x] T030 In `dm/worker.ts`, record purpose `read` for a `talk` turn. Run an `intent` turn with an
      empty beat so narrate reads the carrier row through the spec 104 window.
- [x] T031 In `dm/nodes/schemas.ts`, add outcome `confirm`, the `confirm` items (reuse
      `IntentBodySchema`) and `answer` to `ReactOutput`, with their refinements.
- [x] T032 In `dm/prompts/react.ts`, ship `dm.react-v4` (plan D3). In `prompts/common.ts`, drop
      `ooc` talk from player-facing tails and render an `action.suggested` line.
- [x] T033 In `dm/talk-turn.ts`, widen the cutoff to the latest `isDmReadOutput`, build code items
      for rule-2 posts, and stamp and validate model items (spec FR-011).
- [x] T034 In `dm/talk-turn.ts`, run the spec 103 narration check on each item text and the answer
      (FR-012). Ship answer, then confirm, then the D19 row, each fenced, with reclaim keys
      `answer:` and `confirm:`. Record `interrupted` on `SUGGESTION_STALE`. Add `confirmItems` and
      `answered` to `jobs.result.talk`.
- [x] T035 Create `apps/server/test/dm/scripts/talk-confirm.json`, `talk-answer.json` and
      `apps/server/dm-scripts/greyhollow-confirm.json` (plan D6). Extend `dm-scripts.test.ts`.
      Create `specs/066-one-chat-stream/evidence/post.mjs`.
- [x] T036 Amend `talk-triggers.test.ts` and `enqueue-talk.integration.test.ts`: the window, the
      move, `ooc` ignored, `ask_dm` read, turn mode and a human seat queue nothing, no cap after 12
      posts, a runner declare ignored, `interruptRead` both ways.
- [x] T037 Amend `talk-turn.integration.test.ts`: a model confirm, a code item for a declared Intent
      with no model call, a dropped companion or absent item, answer order, an answer leak dropped,
      a stale suggest, reclaim ships once.
- [x] T038 Create `apps/server/test/dm/enqueue-intent.integration.test.ts` (card AC #7): a direct
      settled Intent queues one `intent` turn that narrates its facts; a job-appended one queues
      none; a 👍 and a human ruling in one window coalesce to one queued turn.
- [x] T039 Amend `worker.integration.test.ts` (the `read` marker; an interrupted run writes nothing).
- [x] T040 Amend `react-prompt.test.ts` and `player-facing-prompts.test.ts` (`dm.react-v4`, the
      confirm and answer rules, the `ooc` filter).
- [x] T041 Run `pnpm ci:check`.

## Phase 4: Frozen-contract amendment blocks (C-GATE ruled 2026-11-11)

- [x] T042 Append one "**Amendment (TASK-0199).**" block per plan.md rows C-1 to C-9. Cite P-04,
      decision-0030 and the C-GATE ruling "Approve all" (2026-11-11). Never rewrite an earlier block.
- [x] T043 Check each block against the code as built. Correct a block only by a dated note under it.
- [x] T044 Run `pnpm ci:check`.

## Phase 5: Wiki — server share (NEEDS-REVIEW)

- [ ] T045 Re-ground `docs/wiki/dm-talk-triggers.md`, `dm-turn-jobs.md` and `presence.md` against
      the diff (rule 6, rule 9, the window, `interruptRead`, the `read` marker, `dm.react-v4`).
- [ ] T046 Re-ground `docs/wiki/proposal-gate.md`, `session-model.md` and `turn-floor.md`
      (`action.suggest`, `action.accept`, `ask_dm`, `readablePosts`, no read in turn mode). Leave
      `play-route` and `chat-ui` to TASK-0315.
- [ ] T047 Add one TASK-0199 sentence to `docs/wiki/INDEX.md` and `CAPSULES.md`.
- [ ] T048 Run the wiki freshness gate (`OK`) and `pnpm ci:check`.

## Phase 6: Verification **[orchestrator]**

- [ ] T049 **[orchestrator]** `pnpm env:up`, migrate both databases by hand, and run the
      session-model, gate and DM DB suites with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL`
      exported. Re-run a known flake once and report it.
- [ ] T050 **[orchestrator]** Mutation guard (plan D5): stub `readablePosts`, `suggestionState`, the
      accept acceptor rule, `interruptRead` and rule 9 in turn. Record the failing test count for
      each. Restore, and confirm `git diff` is empty.
- [ ] T051 **[orchestrator]** Script-mode server check (plan "Server check") on the debug routes.
      Commit the evidence under `specs/066-one-chat-stream/evidence/`.
- [ ] T052 **[orchestrator]** Add the TASK-0199 execution-log row to
      `docs/design/r1-fast-table-runbook.md`: dispatches, rulings, test counts, mutation guard,
      contract blocks, no migration.
- [ ] T053 **[orchestrator]** Run the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6.
- Phase 3 starts only after TASK-0314 is on `origin/main` (T024).
- TASK-0315 draft-holds until this card merges.
