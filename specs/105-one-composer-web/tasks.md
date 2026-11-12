# Tasks: One composer, one Send, Enter commits in combat (web)

**Spec**: `specs/105-one-composer-web/spec.md` · **Plan**: `plan.md` · **Card**: TASK-0315
**Upstream**: `3fe09541` (PR #170). One phase is one sonnet dispatch. Phases run in order.
**UI rule**: no modals. Use inline editors, slide-out panels or autocomplete dropdowns.

## Phase 1: Sources, frames and labels (FR-003, FR-005, FR-W1)

- [x] T001 In `apps/web/app/play/frames.ts`, add `intentFrame(intent)`, `acceptFrame` and `suggestFrame`, each schema-validated through `build`. Remove `commentFrame`. Keep `talkFrame`, `declareFrame` and `commitFrame` (plan D1).
- [x] T002 In `apps/web/app/play/source.ts`, add `sendIntent`, `accept` and `suggest` to `TableCommands`. Remove `comment` and `CommentInput` (plan D1).
- [x] T003 In `apps/web/app/play/use-live-table.ts`, wire the three new commands to `send`. Remove `comment`.
- [x] T004 In `apps/web/app/play/local-log.ts`, add `localIntentEvents` and `localAcceptEvents` with carrier rows only and a `ponytail:` comment (spec OQ-1). Wire them in `use-fixture-table.ts`.
- [x] T005 In `apps/web/app/play/labels.ts`, word `SUGGESTION_STALE`, `SUGGESTION_NOT_FOUND`, `INTENT_EXISTS` and `NOT_YOUR_TURN` (generic). Add `KIND_LABEL` and `kindLabel()` (spec OQ-6).
- [x] T006 In `apps/web/app/play/proposals.ts`, replace both `ponytail:` `detailsOf` cases with real rows (FR-W1).
- [x] T007 Amend `apps/web/test/play/{frames,local-log,use-fixture-table,proposals}.test.mjs` for the new frames, local events, labels and detail rows.
- [x] T008 Run `pnpm --filter @the-stacks/web test` and `pnpm --filter @the-stacks/web typecheck`. Leave callers of the removed `comment` compiling until Phase 3 by keeping the action-card prop optional.

## Phase 2: Pure modules — send router, ring, view model (FR-001, FR-015, FR-022 to FR-025, card AC #1)

- [x] T009 Create `apps/web/app/play/send.ts` with `routeSend(text, ctx)`: parse, then `intent`, `declare-commit` or `refused` (plan D2).
- [x] T010 Create `apps/web/test/play/send.test.mjs`: active prose yields declare then commit; active slash yields `confirmed`; non-active prose yields `say` at `confirmed`; free mode yields `declared`; `((` and `/ooc` yield `ooc`; `@dm` yields `ask_dm`; a bad slash yields `refused` (card AC #1).
- [x] T011 Create `apps/web/app/play/read-ring.ts` with `readIndicator(p, viewer, nowMs)` over `readablePosts`, `RING_BLANK_MS` and `READ_QUIET_MS` (FR-024, FR-025).
- [x] T012 Create `apps/web/test/play/read-ring.test.mjs`: blank under 2 s; 5 of 8 at 5 s; clamp; hidden in turn mode, under a human seat and for a DM viewer; Thinking ends on an `ai:dm` row, a readable post or 30 s (card AC #1).
- [x] T013 In `apps/web/app/play/view-model.ts`, add the `confirm` and `aside` transcript items, `askDm` and `confirmable` on talk, `declaredIntent` on Intent lines, and `ConfirmView` per C-6 (plan D3).
- [x] T014 In `view-model.ts`, reshape `ComposerView` (`speakers`, `mentions`, `mode`, `active`). Remove `signoff`, `suggest`, `comments` and `commitsOnOwnTurn` from `ActionCardView`. The active player's `commit.canCommit` is false in turn mode; the DM's stays (FR-023).
- [x] T015 Delete `apps/web/app/play/signoff.ts` and `apps/web/test/play/signoff.test.mjs`.
- [x] T016 Amend `apps/web/test/play/view-model.test.mjs`: confirm states (live, stale → "Superseded", confirmed), "Waiting on <name>", "Waiting on the party", no "The party" speaker, no player Commit in turn mode.
- [ ] T017 Run `pnpm --filter @the-stacks/web test` and `pnpm --filter @the-stacks/web typecheck`.

## Phase 3: Components and wiring (FR-001 to FR-005, FR-015, FR-017, FR-019, FR-026, card AC #2)

- [ ] T018 Rewrite `apps/web/app/play/components/composer.tsx`: the "Speaker" chip listbox, the `((` and `/ooc` flip, the "Mention" listbox, one Send, `routeSend`, the inline parse refusal, the active-player hint and the "Interrupt the DM?" strip (plan D4).
- [ ] T019 Create `apps/web/app/play/components/read-ring.tsx` (8 segments, caption, `role="status"`).
- [ ] T020 Create `apps/web/app/play/components/confirm-row.tsx` (👍 Yes, Not quite, "Waiting on <name>", "Confirmed", "Superseded").
- [ ] T021 Create `apps/web/app/play/components/confirm-editor.tsx`, the human DM's inline editor (FR-019).
- [ ] T022 In `apps/web/app/play/components/transcript.tsx`, render the confirm row, the DM aside, "Table talk", the `ask_dm` highlight, "Confirm as action…" and "Confirm".
- [ ] T023 In `components/action-card.tsx` and `components/commit-control.tsx`, remove the comment form, the sign-off rows, "Commits on your turn" and the player Commit. Keep the DM's Commit and every allowed Withdraw.
- [ ] T024 In `apps/web/app/play/table-view.tsx`, wire the composer, the composer ref (Not quite focus), the editor key, the ring slot and the 1 s ticker that runs only while the ring or Thinking shows.
- [ ] T025 Rewrite `apps/web/test/play/composer.test.tsx`. Create `apps/web/test/play/confirm-row.test.tsx`. Amend `action-card.test.tsx`, `table-view.test.tsx`, `equivalence.test.tsx` and `start-scene-panel.test.tsx`. Assert one Send, the SC-005 absent names and no `role="dialog"` under `app/play/` (card AC #2).
- [ ] T026 Run `pnpm ci:check`. `apps/web/test/no-dialog.test.mjs` passes.

## Phase 4: Wiki — web share (NEEDS-REVIEW)

- [ ] T027 Re-ground `docs/wiki/play-route.md`: the composer, send router, ring, Thinking, confirm row, DM editor, removed sign-off and comment UI, the fixture carrier-only path, and the `detailsOf` rows. Update its sources list.
- [ ] T028 Re-ground `docs/wiki/chat-ui.md` where it describes the play composer or the no-modal rule, and the `docs/wiki/turn-floor.md` UI lines ("Commits on your turn", "Suggest an alternative", Enter commits).
- [ ] T029 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md` lines for `play-route` and `turn-floor`. Re-pin honestly through the wiki-update plan loop.
- [ ] T030 Run the wiki freshness gate. It prints `OK`.

## Phase 5: Verification **[orchestrator]**

- [ ] T031 **[orchestrator]** Run `pnpm ci:check` on the final tree and the spec-bridge gate.
- [ ] T032 **[orchestrator]** Brave live check, script mode `DM_FAKE_SCRIPT=greyhollow-confirm`, two windows (Tamsin, Kestrel). Record in `specs/105-one-composer-web/evidence/live-check.md`: one composer and one Send; a free-mode post entering the ring; Thinking; the confirm row's 👍 for Kestrel and "Waiting on Kestrel" for Tamsin; the line turning "Confirmed"; in turn mode no ring and the active player's Enter committing.
- [ ] T033 **[orchestrator]** Screenshots at 1280 px and 390 px; no modal at either width.
- [ ] T034 **[orchestrator]** Accessibility check: the Brave accessibility-tree read and a keyboard-only pass (Speaker, Mention, Send, 👍, Not quite, I'm sure, Wait). Record it (spec OQ-5).
- [ ] T035 **[orchestrator]** Record the `Dispatch:` lines on the card and run `spec-bridge:sync`.

## Dependencies

1 → 2 → 3 → 4 → 5. Phase 3 needs Phase 2's view shapes. Phase 4 re-pins Phase 3's files.
