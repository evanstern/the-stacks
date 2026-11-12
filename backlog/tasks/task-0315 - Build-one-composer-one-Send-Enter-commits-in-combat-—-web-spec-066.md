---
id: TASK-0315
title: 'Build: one composer, one Send, Enter commits in combat — web (spec 066)'
status: In Progress
assignee: []
created_date: '2026-11-12T03:01:00Z'
updated_date: '2026-11-12T06:26:00Z'
labels:
  - web
  - ws:table-ux
  - replan-2026-11
milestone: m-10
dependencies:
  - TASK-0199
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-0199 by the operator's C-AMD ruling of 2026-11-11 (spec 066 OQ-1). Spec 066 phase 4 (web) and the web share of phases 6 and 7: Send parses each line and sends one intent request (declared in free mode, confirmed in turn mode), the active player's Enter commits, the ring and Thinking visuals, the interrupt strip, the confirm row, the DM confirm editor, and removing the sign-off and comment UI. Draft-hold the PR until TASK-0199 merges. UI: no modals; Brave live check.

Spec: specs/105-one-composer-web
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In combat, no quiet ring runs; the active player's Enter commits the Intent, with a test.
- [x] #2 The play route has one composer and one Send button, verified live in Brave.
- [x] #3 Spec phase: Sources, frames and labels (FR-003, FR-005, FR-W1)
- [ ] #4 Spec phase: Pure modules — send router, ring, view model (FR-001, FR-015, FR-022 to FR-025, card AC #1)
- [ ] #5 Spec phase: Components and wiring (FR-001 to FR-005, FR-015, FR-017, FR-019, FR-026, card AC #2)
- [ ] #6 Spec phase: Wiki — web share (NEEDS-REVIEW)
- [ ] #7 Spec phase: Verification **[orchestrator]**
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-0199 phase 4: C-6, C-7 and C-9 contract blocks landed in TASK-0199 (7c0d1613); build against them. Confirm the ui-surfaces.md C-7 wording (the speaker chip drops 'The party') when building the composer. Replace the minimal ponytail detailsOf cases in apps/web/app/play/proposals.ts with real rendering, and document it in play-route.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0315, branch task-0315-one-composer, cut from origin/main 468069b8. Spec number 105 claimed with a stub.

Spec marker fixed: this card links spec 105 only. Spec 066 stays TASK-0199's (Done); adding web tasks to it would put TASK-0199 ahead of its artifacts. Spec 105 builds on spec 066's design (plan D4) and the C-6/C-7/C-9 contract blocks merged in PR #170.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 105 (7ca305c8): 35 tasks, 5 phases, against origin/main 468069b8. No frozen-contract conflict; C-7 wording confirmed (Speaker chip drops 'The party'). Orchestrator adopts OQ-1..OQ-6 as recommended, since each follows from an existing artifact: OQ-1 constitution II (fixture mode writes carrier rows only); OQ-4 the gate's stale check binds ai:dm only; OQ-5 no new dependency (avoids C5); OQ-2, OQ-3 and OQ-6 are presentation details inside spec 066 D4.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-3 (46e30aef, 6c2fac10, 66824cbe): ci:check exit 0; web node --test 325 and vitest 161 pass; no-dialog green; mutation guard catches routeSend and readIndicator. Deviations: optional actionId and suggestionId on inputs; readIndicator takes markerTs; the human DM's plain prose still sends as talk; a new view-model item kind 'intent' lets a human DM confirm declared deeds; no player sees Commit in any mode (FR-005). The agent briefly edited root by mistake and restored it; root verified clean.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 4 wiki (d34fa871): play-route, turn-floor and scene-panels re-pinned; chat-ui not staled.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Live check (40cbd19f) on the worktree app in script mode, two isolated Brave contexts, no vm-104 page touched. Passed: one composer and one Send, ring, Thinking, interrupt strip, confirm row then Confirmed, chips, no 'The party'; no modal and no clipping at 1280 or 390 px; a11y tree and keyboard pass. Not run live: turn mode, because greyhollow-confirm never starts an encounter. AC #1 rests on send.test.mjs (declare then commit; slash at confirmed; non-active say) and read-ring.test.mjs (hidden in turn mode). Minor finding: after a keyboard pick in the Speaker listbox, focus drops to body instead of the Speaker button.
<!-- SECTION:NOTES:END -->
