---
description: "Tasks for suggest proposals without an Approve control (TASK-0100)"
---

# Tasks: Approval panel shows suggest proposals without an Approve control

**Input**: `specs/047-suggest-no-approve/`: spec.md (ruling R1 option A, 2026-10-27), plan.md, research.md, data-model.md, contracts/pending-proposal-policy.md, quickstart.md.

**Tests**: Required. Card AC #3 asks for a test proving no Approve control renders for a suggest proposal.

**Dispatch**: one phase is one implementer dispatch (sonnet tier). Each phase ends with `pnpm ci:check` green and a commit led by `TASK-0100:`. No phase touches the database. UI: no modals; use the existing slide-out panel only. Browser automation uses Brave.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an open task).
- **[Story]**: US1, the DM sees a suggestion as a suggestion (the spec's only story).

---

## Phase 1: Policy on the view and the suggest row (US1, card AC #1, #2, #3)

**Goal**: `PendingProposalView` carries `policy`; a `suggest` row shows "Suggestion" and Dismiss and no Approve; the seam carries its amendment line.

**Independent test**: `pnpm --filter @the-stacks/web test` green, including `no-dialog.test.mjs`. `proposal-list.test.tsx` proves `dm-approvals` P3's row has no Approve control.

- [ ] T001 [US1] In `apps/web/app/play/proposals.ts`, add the required field `policy: "ask" | "suggest"` to `PendingProposalView` after `kind`, with the doc comment from `specs/047-suggest-no-approve/contracts/pending-proposal-policy.md`. In `toView`, set `policy: view.policy`. Do not read `DEFAULT_POLICIES` or `gate.policyOverrides` (plan D1).
- [ ] T002 [US1] In `apps/web/app/play/components/proposal-list.tsx`, branch `ProposalRow` on `proposal.policy` (plan D3). For `ask`, keep Approve, Reject and the inline reason flow unchanged. For `suggest`, render a "Suggestion" badge in the kind line and one `type="button"` Dismiss button with the `BUTTON` style that calls `onReject(proposal.proposalId, null)`. Render no Approve, no Reject and no reason input for `suggest`. Keep the `ProposalList` and `ProposalRow` props unchanged (plan D4). Update the component doc comment.
- [ ] T003 [US1] In `apps/web/app/play/table-view.tsx`, change the approvals `Panel` description to "Approve or reject each proposal. Dismiss a suggestion once you have acted on it." (plan D5). Change nothing else in the file.
- [ ] T004 [P] [US1] In `apps/web/test/play/proposals.test.mjs`, add a test: `selectPendingProposals(dmApprovals.events, dm)` returns policies `["suggest", "ask", "ask"]` for kinds `["scene", "tracker", "table-mode"]`.
- [ ] T005 [P] [US1] In `apps/web/test/play/proposal-list.test.tsx`, add tests: (a) render the list for `dm-approvals`; isolate P3's `<li>` and assert it contains "Suggestion" and `>Dismiss<` and does not contain `>Approve<`, `>Reject<` or "Reason for rejecting" (card AC #3); (b) each `ask` row contains `>Approve<` and `>Reject<` and no `>Dismiss<`; (c) a suggest-only list contains no `>Approve<`. Keep the existing tests passing; amend the first test's global `>Approve<` assertion only if it needs scoping.
- [ ] T006 [P] [US1] In `apps/web/test/play/proposal-list.test.tsx`, assert P3's Dismiss renders as `<button type="button"` inside the row. The web tests render static markup only (`renderToStaticMarkup`) and have no DOM click tooling; add no dependency. The click path (`onReject(id, null)`) is proven live in T012.
- [ ] T007 [P] [US1] In `apps/web/test/play/view-model.test.mjs`, add `policy: "ask"` to the `PendingProposalView` literal so it typechecks.
- [ ] T008 [P] [US1] In `apps/web/test/play/table-view.test.tsx`, add a test: the DM's render of `dm-approvals` contains exactly two `>Approve<`, one `>Dismiss<` and the new panel description.
- [ ] T009 [US1] Append the amendment line given in `specs/047-suggest-no-approve/contracts/pending-proposal-policy.md` ("The amendment line for proposal-seam.md") to `specs/030-play-route/contracts/proposal-seam.md`, after the TASK-0049 amendment line, with one blank line between them. Change no other line of the frozen file.
- [ ] T010 [US1] Run `pnpm ci:check`. Expect green. Commit `TASK-0100: Phase 1 — policy on PendingProposalView, Dismiss for suggestions`.

**Checkpoint**: card AC #1, #2 and #3 are met in code and tests.

---

## Phase 2: Live check in Brave (US1 acceptance scenarios 3 and 4)

**Goal**: prove Dismiss on the live and fixture routes, with screenshots, no modal and no overflow.

**Independent test**: `specs/047-suggest-no-approve/evidence/live-check.md` records the run; every scripted check passes.

- [ ] T011 [US1] On the worktree's own stack (`pnpm env:up`, migrate both databases by hand, restart the app), seed a session from the `dm-approvals` fixture with a script `specs/047-suggest-no-approve/evidence/seed-suggest.mjs`, modelled on `specs/044-group-signoff/evidence/seed-signoff.mjs`. Keep account credentials in an untracked file outside the repo.
- [ ] T012 [US1] Write `specs/047-suggest-no-approve/evidence/shoot-suggest.mjs`, modelled on `specs/044-group-signoff/evidence/shoot-signoff.mjs` (Brave by `executablePath`, playwright-core loaded from outside the repo). As the seated DM, open the approvals slide-out, assert the scene row shows "Suggestion" and Dismiss and no Approve, click Dismiss, and assert the row leaves the list and the stored log gains one `proposal.rejected` row with `reason: null`. Repeat the row assertions on `play/fixtures/dm-approvals` (viewer DM, last step) and assert the row leaves at once on Dismiss. Assert no `<dialog>` and no horizontal overflow at 390 px.
- [ ] T013 [US1] Save screenshots at 1280 and 390 px, light and dark, before and after Dismiss, under `specs/047-suggest-no-approve/evidence/shots/`. Record the run, PASS/FAIL counts and any finding in `specs/047-suggest-no-approve/evidence/live-check.md`. Leave the stack up. Commit `TASK-0100: Phase 2 — Brave live check`.

**Checkpoint**: acceptance scenarios 1 to 4 are demonstrated.

---

## Phase 3: Wiki re-ground

**Goal**: the grounding wiki describes the merged behaviour, re-pinned honestly.

- [ ] T014 Review and amend `docs/wiki/play-route.md` (NEEDS-REVIEW): `PendingProposalView.policy`; the suggest row's Suggestion label and Dismiss (`onReject(id, null)`, the existing `proposal.reject` request); remove the "Known gap: suggest-policy proposals still show an Approve control (TASK-0100)" sentence; name TASK-0159 as the open scene-command gap.
- [ ] T015 [P] Review and amend `docs/wiki/proposal-gate.md` (NEEDS-REVIEW): under "Atomic approval", state that the play route offers no Approve on a `suggest` proposal and dismisses it through `proposal.reject`; the gate code is unchanged.
- [ ] T016 Update the state paragraph in `docs/wiki/INDEX.md` for TASK-0100 (specs/047). Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Classify each staled pin as RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>`, and re-pin.
- [ ] T017 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (prints `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0). Commit `TASK-0100: Phase 3 — wiki re-ground`.

---

## Dependencies & execution order

- Phase 1 → Phase 2 → Phase 3, strictly serial.
- Within Phase 1, T001 precedes T002 to T008 (they need the field). T004 to T008 touch different files and may run together. T009 is independent of the code tasks.
- Before each phase, merge `origin/main` if it moved (never rebase). Keep both amendment lines in `proposal-seam.md`.

## Parallel example (Phase 1)

After T001 lands: T004 (`proposals.test.mjs`), T007 (`view-model.test.mjs`), T008 (`table-view.test.tsx`) and T009 (`proposal-seam.md`) run together. T005 and T006 share `proposal-list.test.tsx` and run in sequence after T002.

## Implementation strategy

MVP is Phase 1: every card AC is met there. Phase 2 proves it in the browser. Phase 3 re-grounds. One PR for the whole task.

## Out of scope

- A human-DM scene-change command on the play route: TASK-0159.
- Any gate, session-model, event or 029 contract change (spec "Not needed: no gate change").
