# Tasks: One chat stream — players talk, the DM confirms each action

**Input**: `specs/066-one-chat-stream/` (spec.md, plan.md), decision-0028 (D20, accepted).

**Prerequisites**: none open. The operator ruled every open question (a) and approved the section 8
frozen-contract amendments ("All (a), amend", 2026-11-02). The amendment blocks land with this spec
set; Phase 5 reconciles them with the code as built.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator, not the implementer.
Each implementer phase ends with `pnpm ci:check` green (DB suites skip without a database) and one
commit led by `TASK-0188:`. Serial hotspots: `gate/plan.ts`, `dm/talk-turn.ts`, `dm/jobs.ts`,
`dm/enqueue.ts`, `play/view-model.ts`, `play/components/composer.tsx`. No other lane edits them
while this branch is open. UI work: no modals; slide-outs and inline dropdowns only. Browser checks
use Brave.

## Phase 1: Session model — events, catalog, projection (card AC #1, #3)

- [ ] T001 In `packages/session-model/src/events/actions.ts`, add `SuggestionItemV1`,
      `ActionSuggestedV1` and `suggestionActionId` (plan D1). Add optional `suggestionId` to
      `ActionDeclaredV1`.
- [ ] T002 In `events/presence.ts`, add `"read"` to `PRESENCE_PURPOSES`. Update the header comment.
- [ ] T003 In `catalog.ts`, add the `action.suggested` entry (kind `lifecycle`).
- [ ] T004 In `projections/types.ts` and `apply.ts`, add `suggestions`, the `action.suggested`
      transcript entry, `ActionView.suggestionId` and `PresenceView` purpose `read`. Let
      `action.withdrawn` move a `committed` action to `withdrawn` (plan R4).
- [ ] T005 Create `packages/session-model/src/read.ts` with `isDmQuestion`, `isReadablePost`,
      `readWindowMs`, the four ring constants, `isDmReadOutput`, `suggestionState` and
      `latestReadablePostSeq` (plan D1, FR-005, FR-017). Export them from `index.ts`.
- [ ] T006 Create `fixtures/one-chat-stream.ts` and add it to `fixtures/index.ts` (plan D1).
- [ ] T007 Create `packages/session-model/test/read-rule.test.ts`. Cover each FR-005 rule and its
      negations (whisper, `dm` visibility, `ai:dm`, human seat, a non-active turn-mode post, OOC
      without `@dm`, `@dmx`), both windows, `isDmReadOutput`, and `suggestionState` (stale by a
      later suggestion, stale by a no-action narration, not stale by a commit narration, accepted).
- [ ] T008 Amend `catalog.test.ts` (20 session entries, 38 total), `actions.test.ts` (the withdrawn
      fold on a committed action; a resolve after it ignored), `presence.test.ts` (`read`) and
      `fixtures.test.ts` (the new fixture's facts). `talk-isolation.test.ts` passes unchanged.
- [ ] T009 Run `pnpm ci:check`.

## Phase 2: Gate — suggest, accept, withdraw, refusal codes (card AC #2, #3)

- [ ] T010 In `packages/session-model/src/gate/proposals.ts`, add the `action.suggest` and
      `action.accept` kinds and schemas. Exclude `action.accept` from `DmProposalKindSchema`
      (plan D2).
- [ ] T011 In `policy.ts`, add `"action.suggest": "auto"`. Refuse `ai:dm` `action.accept` in
      `routeProposal`.
- [ ] T012 In `permissions.ts`, add `action.suggest` to the DM-kind row. Allow `action.accept` for
      human proposers only.
- [ ] T013 In `refusals.ts`, add `SUGGESTION_STALE` and `SUGGESTION_NOT_FOUND`.
- [ ] T014 In `plan.ts`, plan `action.suggest` with its id checks and the `ai:dm` `readSeq` guard
      (plan D2, FR-007).
- [ ] T015 In `plan.ts`, plan `action.accept`: the five checks in order, then `action.declared`
      and `action.committed` in one batch, with the FR-015 authority. Extract `unableRefusal` from
      the declare case and reuse it.
- [ ] T016 In `plan.ts`, refuse a direct `action.declare` carrying `suggestionId`
      (`INVALID_PROPOSAL`). Let `action.withdraw` accept a `committed` action.
- [ ] T017 In `apps/server/src/gate/gate.ts`, widen the `recordPresence` purpose type to `read`.
- [ ] T018 Create `packages/session-model/test/gate-suggest.test.ts` (plan D5). Cover every
      suggest and accept rule, the two-row batch per mode and scope, `ACTION_EXISTS` on a second
      👍, and `ai:dm` accept refused.
- [ ] T019 Amend `gate-plan.test.ts` (withdraw committed; refuse resolved), `gate-schemas.test.ts`
      (17 kinds, 14 DM kinds, 21 request kinds), `gate-policy.test.ts` and
      `gate-permissions.test.ts`.
- [ ] T020 In `apps/server/test/write-boundary.test.ts`, add the two pins (plan D2).
- [ ] T021 In `apps/server/test/gate.integration.test.ts`, cover suggest then accept over the real
      gate (one append, a commit turn queued) and two concurrent accepts (one commit).
- [ ] T022 Run `pnpm ci:check`.

## Phase 3: DM runtime — ring window, read marker, confirm, `@dm` answer, interrupt (card AC #1, #2)

- [ ] T023 In `apps/server/src/dm/talk-triggers.ts`, delegate `isReadable` to `isReadablePost`.
      Make `needsModel` true for a human-authored post (spec gap 2).
- [ ] T024 In `dm/jobs.ts`, change `enqueueTalkTurn` to `notBefore = postTs + windowMs` with no
      cap (FR-006). Add `interruptRead` (plan D3, FR-007). Make `reconcileTurnJobs` skip a
      withdrawn action (FR-019).
- [ ] T025 In `dm/enqueue.ts`, rewrite rule 7: interrupt, then queue or move the read. Keep the
      companion prompt. Replace the talk deps with `readWindowMs`. Update the header comment.
- [ ] T026 In `dm/worker.ts`, record purpose `read` for a `talk` turn (FR-008).
- [ ] T027 In `dm/nodes/schemas.ts`, add `confirm` and `answer` to `ReactOutput` with their
      refinements (plan D3).
- [ ] T028 In `dm/prompts/react.ts`, ship `dm.react-v2` with the confirm and `@dm` rules and the new
      inputs. In `prompts/common.ts`, drop OOC talk from the player-facing tail except `@dm` posts
      and `ai:dm` answers (FR-013). Render a suggestion line.
- [ ] T029 In `dm/talk-turn.ts`, widen the cutoff, filter and normalize confirm items, run the code
      checks on every shipped text, and ship the answer then the confirm through `gate.submit`
      with reclaim keys (plan D3 steps 1 to 8).
- [ ] T030 In `dm/nodes/resolve.ts`, skip a beat item withdrawn before its group runs (FR-019).
- [ ] T031 Create `apps/server/test/dm/scripts/talk-confirm.json` and `talk-answer.json`.
- [ ] T032 Amend `apps/server/test/dm/talk-triggers.test.ts` and
      `enqueue-talk.integration.test.ts` (plan D5): the window, the move, OOC, `@dm`, turn mode,
      no cap, and `interruptRead` both ways.
- [ ] T033 Amend `apps/server/test/dm/talk-turn.integration.test.ts` (plan D5): confirm, dropped
      items, answer order, a refused leak, the stale suggest, reclaim.
- [ ] T034 Amend `worker.integration.test.ts` (the `read` marker; an interrupted run writes
      nothing), `resolve.integration.test.ts` (the withdrawn skip) and `jobs.integration.test.ts`
      (reconcile).
- [ ] T035 Amend `react-prompt.test.ts` and `player-facing-prompts.test.ts` (`dm.react-v2`, the
      rules, the OOC filter).
- [ ] T036 Create `apps/server/dm-scripts/greyhollow-confirm.json`. Extend
      `apps/server/test/dm/dm-scripts.test.ts`. Create `specs/066-one-chat-stream/evidence/post.mjs`
      (plan D7).
- [ ] T037 Run `pnpm ci:check`.

## Phase 4: Web — composer, ring, Thinking, interrupt strip, confirm row (card AC #1, #2)

- [ ] T038 In `apps/web/app/play/source.ts`, `frames.ts` and `local-log.ts`, remove declare and
      comment. Add `accept`, `suggest`, `acceptFrame`, `suggestFrame` and `localAcceptEvents`
      (plan D4).
- [ ] T039 Create `apps/web/app/play/read-ring.ts` with `readIndicator` (FR-023, FR-024).
- [ ] T040 In `view-model.ts`, add the `confirm` and `aside` items, `dmQuestion`, `confirmable` and
      `ConfirmView`. Reshape `ActionCardView` and `ComposerView` (plan D4).
- [ ] T041 Delete `signoff.ts` and `apps/web/test/play/signoff.test.mjs`.
- [ ] T042 Rewrite `components/composer.tsx`: the speaker chip listbox, the `((` and `/ooc` flip,
      the `@` mention listbox, one Send, the interrupt label and the inline strip (FR-001,
      FR-002, FR-025).
- [ ] T043 Create `components/read-ring.tsx` and `components/confirm-row.tsx` (plan D4, FR-014,
      FR-016, FR-017).
- [ ] T044 Create `components/confirm-editor.tsx`, the human DM's inline editor (FR-020).
- [ ] T045 In `components/transcript.tsx`, render the confirm row, the DM aside, "Table talk", the
      `@dm` highlight and "Confirm as action…".
- [ ] T046 In `components/action-card.tsx`, remove the comment form, the sign-off rows and the
      player commit control. Keep the DM's Commit and every allowed Withdraw (FR-003, FR-018).
- [ ] T047 In `table-view.tsx`, `use-live-table.ts` and `use-fixture-table.ts`, wire the new
      commands, the composer ref, the editor key and the one-second ticker.
- [ ] T048 In `labels.ts`, word `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND` and `ACTION_EXISTS`.
- [ ] T049 Create `apps/web/test/play/read-ring.test.mjs` and `confirm-row.test.tsx` (plan D5).
- [ ] T050 Rewrite `composer.test.tsx`. Amend `view-model.test.mjs`, `action-card.test.tsx`,
      `table-view.test.tsx`, `equivalence.test.tsx`, `frames.test.mjs`, `local-log.test.mjs`,
      `use-fixture-table.test.mjs` and `start-scene-panel.test.tsx`. Assert SC-005's absent names
      and no modal under `app/play/`.
- [ ] T051 Run `pnpm ci:check`.

## Phase 5: Contract and wiki amendments (card AC #3)

- [ ] T052 Check each TASK-0188 amendment block (plan "Contract amendments") against the code as
      built. Correct a block only by appending a dated note under it. Never rewrite a block.
- [ ] T053 Re-ground `docs/wiki/play-route.md`, `proposal-gate.md`, `session-model.md`,
      `dm-talk-triggers.md`, `dm-turn-jobs.md`, `turn-floor.md` and `presence.md` against the
      diff. Re-pin each honestly.
- [ ] T054 Update `docs/wiki/CAPSULES.md` and the `INDEX.md` state paragraph with one sentence for
      TASK-0188 (specs/066). Correct the sign-off sentence the paragraph holds today.
- [ ] T055 Run the wiki freshness gate (`OK`) and `pnpm ci:check`.

## Phase 6: Verification **[orchestrator]**

- [ ] T056 **[orchestrator]** `pnpm env:up`, migrate both databases by hand, restart the app. Run
      the session-model, gate and DM DB suites with `REQUIRE_DATABASE=1` and only
      `TEST_DATABASE_URL` exported. Re-run a timeout once (TASK-0154) and report it.
- [ ] T057 **[orchestrator]** Mutation guard (plan D6): stub `isReadablePost`, `suggestionState`,
      the accept acceptor rule, then `interruptRead`. Record the failing test count for each.
      Restore. Confirm `git diff` is empty.
- [ ] T058 **[orchestrator]** Script-mode live check (plan D7) with
      `DM_FAKE_SCRIPT=greyhollow-confirm` in two Brave windows (Tamsin, Kestrel). Record: the ring
      in both windows, Thinking, the interrupt strip on Tamsin's IC draft, Kestrel's 👍 Yes and Not
      quite, Tamsin's "Waiting on Kestrel", "Confirmed" and the commit turn on the debug page, and
      one DM aside for Tamsin's `@dm` post.
- [ ] T059 **[orchestrator]** Shots at 1280 and 390 px, light and dark, of the ring, Thinking, the
      strip, both confirm views and the human DM's editor. Confirm no modal in any shot. Commit the
      evidence under `specs/066-one-chat-stream/evidence/`.
- [ ] T060 **[orchestrator]** Add the execution-log row for TASK-0188 to
      `docs/design/m3-table-sweep-runbook.md`: dispatches, the ruling, test counts, the mutation
      guard, the live check, the frozen-contract amendments, no migration.
- [ ] T061 **[orchestrator]** Run the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 before every other phase: all of them use the events and `read.ts`.
- Phase 2 before Phases 3 and 4: the DM ships `action.suggest`, and the web sends `action.accept`.
- Phases 3 and 4 may run in parallel after Phase 2. They share no file. Phase 4's live wiring is
  proven only after Phase 3, in Phase 6.
- Phase 5 after Phases 3 and 4. Phase 6 after Phase 5.
