---
id: TASK-0047
title: 'First Scene: play route — composer, commit control, ledger, DM approvals'
status: Done
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 05:04'
labels:
  - first-scene
  - ui
milestone: m-2
dependencies:
  - TASK-0045
references:
  - docs/design/architecture.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the play route a player and a DM use at the table. One composer sends talk or declares an action. A declared action shows comments and a commit control. The route shows the table mode, the roll ledger and, for the DM, pending proposals to approve.

Why: decision-0016 (talk versus action, table modes) and decision-0015 (DM approval surface for ask) need a human surface. This is the in-app table view's first slice (decision-0013); maps arrive in M6.

No modals: slide-out panels or autocomplete dropdowns only. Work can start against fixtures before TASK-0045 merges.

Spec: specs/030-play-route
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One composer sends talk or declares an action, and the player chooses which.
- [x] #2 A declared action shows its comments and a commit control for whoever holds commit authority.
- [x] #3 The route shows the current table mode, and in turn mode it shows the active player.
- [x] #4 A ledger panel lists every roll with its reason and every state change with before and after values.
- [x] #5 A DM approval panel lists pending proposals, and the DM approves or rejects each one.
- [x] #6 The route uses slide-out panels and autocomplete dropdowns only, never modals.
- [x] #7 The route renders from fixtures and from the live log through the same components.
- [x] #8 The route is client-only, per decision-0008.
- [x] #9 Spec phase: Setup — package wiring and test runner
- [x] #10 Spec phase: Foundational — pure view-model modules
- [x] #11 Spec phase: User Stories 1, 2, 3 (P1) — composer, action cards and commit, table mode; fixture harness (US6)
- [x] #12 Spec phase: User Stories 4 and 5 (P2) — ledger panel and DM approval panel
- [x] #13 Spec phase: User Story 7 (P1) — the live table, AC #7 proof, gates and fixture evidence
- [x] #14 Spec phase: Proposal wiring — GATED on TASK-0045's merge
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 3) after TASK-0044 merged (#46). Worktree .worktrees/task-0047, branch task-0047-play-route, cut from origin/main 8a8bb81. Spec number 030 claimed with a stub.

Spec authoring by opus-implementer: 0795fda, ~229k tokens. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec defaults taken by the orchestrator, none of them a new decision:
- The fixture route ships in production builds, operator-only.
- vitest is an apps/web dev dependency. It is already in the lockfile and is not a runtime dependency.
- The client-side commit-authority display rule follows decision-0016. TASK-0045 enforces it.
Implementation dispatch grouping: P1+P2 | P3 | P4 | P5 | P6. P6 is gated on TASK-0045 merging, and the PR stays a draft until then.

Phases 1 and 2 by sonnet-implementer: 224bf4a and fbc5907. 105 web node:test tests pass; ci:check green. Deviations accepted: .ts import extensions (allowImportingTsExtensions), a local safeParse interface, and a best-of-5 timing test.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 by sonnet-implementer: f907142. The fixture harness and table components are in place, with 14 vitest markup tests (no dialog, no aria-modal) and 20 node tests; ci:check green. The quickstart §2 Brave check is still open and rides Phase 5's screenshot task.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 by sonnet-implementer: 4e8f2dd. The ledger and DM approval panels are slide-outs inside the shared Panel. 108 node tests and 20 vitest tests pass; ci:check green. Approve and Reject click wiring is asserted only by button names. Phase 5's Brave pass must exercise the clicks.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 by sonnet-implementer: 9a00abb. The live table renders through TableView, with an AC #7 equivalence test and no-modal and client-only gates. There are 24 Brave screenshots: fixtures and live, light and dark, at 1280 and 390 px. The approval-panel click-through in Brave works (2→1→0). ci:check green.
Not run: quickstart §3 reload rebuild and stop/start reconnect; the reducer tests cover them. They are to be run in Phase 6's live pass.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 6 by sonnet-implementer: bd6d72e (merge of origin/main, #48) and c03876a. Live proposals and approve/reject now run through TASK-0045's gate requests. The WS error code shows in the notice. Every tasks.md box is ticked.
Brave live checks passed: DM-only delivery, approve, reject, a refusal code, reload rebuild, and stop/start reconnect with no duplicate. ci:check green, with the DB suite running.
Carded follow-up: TASK-0100. A pending suggest proposal still offers an Approve button that fails with PROPOSAL_NOT_APPROVABLE; fixing it needs a seam amendment.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: 571373c. New note play-route. chat-ui, client-session-hook, m0-demo and react-router-app were amended. Freshness OK, 42 notes.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Merged in PR #47 on 2026-10-26. Card ACs #1–#8 are proven by specs/030-play-route/ci-evidence.txt and evidence/live-check.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup — package wiring and test runner: 4/4 · Foundational — pure view-model modules: 13/13 · User Stories 1, 2, 3 (P1) — composer, action cards and commit, table mode; fixture harness (US6): 13/13 · User Stories 4 and 5 (P2) — ledger panel and DM approval panel: 6/6 · User Story 7 (P1) — the live table, AC #7 proof, gates and fixture evidence: 11/11 · Proposal wiring — GATED on TASK-0045's merge: 10/10). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
