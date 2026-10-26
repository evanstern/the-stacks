---
id: TASK-0100
title: 'Approval panel: suggest proposals offer no Approve control'
status: To Do
assignee: []
created_date: '2026-10-26 05:00'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PendingProposalView carries the proposal's effective policy.
- [ ] #2 A suggest proposal offers a dismiss control and no Approve control.
- [ ] #3 A test proves no Approve control renders for a suggest proposal.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
