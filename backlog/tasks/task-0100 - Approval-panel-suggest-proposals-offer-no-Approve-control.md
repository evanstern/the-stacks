---
id: TASK-0100
title: 'Approval panel: suggest proposals offer no Approve control'
status: In Progress
assignee: []
created_date: '2026-10-26 05:00'
updated_date: '2026-10-27 13:04'
labels:
  - ui
  - gate
milestone: m-3
dependencies:
  - TASK-0047
priority: low
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the DM approval panel shows a suggest-policy proposal as a suggestion the DM can act on or dismiss. It offers no Approve button, which can only fail.

Why: TASK-0047 Phase 6 (PR #47) wires the panel to TASK-0045's gate. A pending suggest proposal stays in the panel with Approve and Reject buttons. Approve fails with PROPOSAL_NOT_APPROVABLE, because decision-0015 says suggest applies nothing. The play-route seam (specs/030-play-route/contracts/proposal-seam.md) is frozen and PendingProposalView carries no policy, so the fix needs a spec amendment. The M2 demo seats an AI DM, where every policy is auto, so the demo never shows this. Carded 2026-10-26 by the M2 sweep orchestrator.

No modals: slide-out panels or autocomplete dropdowns only.

Spec: specs/047-suggest-no-approve
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PendingProposalView carries the proposal's effective policy.
- [ ] #2 A suggest proposal offers a dismiss control and no Approve control.
- [ ] #3 A test proves no Approve control renders for a suggest proposal.
- [ ] #4 Spec phase: Policy on the view and the suggest row (US1, card AC #1, #2, #3)
- [ ] #5 Spec phase: Live check in Brave (US1 acceptance scenarios 3 and 4)
- [ ] #6 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0100, branch task-0100-suggest-no-approve, cut from origin/main 5cae90e. Spec number 047 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track A4.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
The spec author stopped after spec.md (c53d50f). Dismiss reuses proposal.reject with reason null, so 029 and the gate do not change. OPERATOR RULING NEEDED, R1 (amends the frozen 030 proposal-seam.md): A (rec) add policy: 'ask'|'suggest' to PendingProposalView, copied from the projection; Dismiss calls the existing onReject(id, null). B: A plus a new onDismiss prop. C: approvable: boolean (fails AC #1). OQ-1 (no human-DM scene-change command) carded as TASK-0159 (m-3).

Operator ruling 2026-10-27 (in chat, verbatim): "I accept the defaults: TASK-0100 R1 option A (policy on PendingProposalView, one amendment line in the frozen 030 proposal-seam.md, Dismiss via onReject(id, null))". R1 resolved: option A. Spec author resumes for plan.md and tasks.md.

Spec author resumed after ruling R1: plan.md, tasks.md, research.md, data-model.md, contracts/pending-proposal-policy.md, quickstart.md at 4cbe9cf (merged origin/main at c78f901). 3 phases, 17 tasks.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Phase 1 (T001-T010) at f32aa03. ci:check: web and lint pass; only the 5 known no-DB adjudicate.integration failures (TASK-0138). Deviation accepted: T008 asserts on ProposalList with the dm-approvals fixture, since the closed slide-out renders no content statically; Phase 2 Brave check covers the real panel.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (T011-T013) at d6935ba. Brave live check 68 PASS / 0 FAIL; Dismiss wrote exactly one proposal.rejected row (seq 20, reason null, prop-3); no <dialog>; 0 px overflow at 390 px. REQUIRE_DATABASE=1 ci:check exit 0. Screenshots reviewed by the orchestrator (suggest-live-before-1280-light.png).
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
