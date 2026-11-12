---
id: TASK-0199
title: >-
  Build: quiet ring on declared Intents, confirm row and ask_dm — server (spec
  066)
status: Done
assignee: []
created_date: 2026-11-02 06:46
updated_date: '2026-11-12T05:26:00Z'
labels:
  - web
  - dm
  - playtest
  - ws:table-ux
milestone: m-10
dependencies:
  - TASK-0188
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Quiet ring for exploration only (P-04), on the Intent `declared` state; amend spec 066.

Intent: the play route keeps one composer and one Send button. In exploration and social play, a `declared` Intent waits for the quiet ring; the DM then reacts or posts a confirm row. A 👍 moves the Intent to `confirmed` and sends it to the gate. Combat uses explicit turns: the active player's Enter commits (N-10, TASK-0275). Human-DM tables may turn the ring off. Amend spec 066 after CP-4 freezes the Intent contract (N-01, TASK-0266). UI: no modals. Use Brave for the live check.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): every deed waited for a 2 s + 8 s quiet ring and a 👍 confirm row (decision-0028, D20; TASK-0188 design), with `action.declare {text}` as the only write.

Spec: specs/066-one-chat-stream
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spec 066 is amended after CP-4 so the quiet ring runs on the Intent declared state.
- [x] #2 In exploration and social play, a declared Intent waits for the quiet ring, then gets a DM reaction or confirm row.
- [x] #3 A 👍 on the confirm row moves the Intent from declared to confirmed and sends it to the gate.
- [x] #4 A human-DM table setting turns the quiet ring off, with a test.
- [x] #5 @dm produces one read-only ask_dm answer that changes no state, with a test.
- [x] #6 Spec 066 is amended against Intent contract v1.1 and reviewed by the operator at C-AMD before implementation.
- [x] #7 A direct intent request (not from a turn job) queues a coalesced turn that narrates its intent.recorded facts (moved from TASK-0247 by spec 066 OQ-3(b)).
- [x] #8 Spec phase: Session model — event, catalog, projection, read rule (card AC #1, #2, #4)
- [x] #9 Spec phase: Gate — suggest, accept, `ask_dm` (card AC #3, #5)
- [x] #10 Spec phase: DM runtime — window, marker, interrupt, read, rule 8 (card AC #1, #2, #5, #7)
- [x] #11 Spec phase: Frozen-contract amendment blocks (C-GATE ruled 2026-11-11)
- [x] #12 Spec phase: Wiki — server share (NEEDS-REVIEW)
- [x] #13 Spec phase: Verification **[orchestrator]**
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Quiet ring for exploration only (P-04), on the Intent `declared` state; amend spec 066.

AC re-authored by replan-2026-11.

CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F2: this card owns the combat Enter-commit rule (AC #4); TASK-0275 builds on it.

T015 (spec 092): amend spec 066 against Intent contract v1.1 (decision-0030 + Amendments) before implementation: confirm row = declared->confirmed; action.suggest carries Intent bodies; quiet ring in exploration only, Enter commits in combat (this card owns it, F2); readable-post rule reads Intent kinds. Review at C-AMD.

Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0199, branch task-0199-quiet-ring, cut from origin/main 9e51c948. No spec dir: signed escape line covers this task.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 066 amended (282eb567, spec.md + plan.md). 70 tasks in 7 phases: split recommended (0199-server AC 1,2,3,5,6; 0199-web AC 4,7). Frozen-contract amendments C-1..C-9 listed in plan.md. Awaiting C-AMD (and C-GATE) review; tasks.md not re-derived yet.

C-AMD ruling (operator, 2026-11-11, in chat): "Approve all". This approves: the spec 066 amendment (282eb567); the split (OQ-1: this card keeps AC #1, #2, #3, #5, #6 and #8, and AC #4 and #7 move to a new web card); the frozen-contract amendments C-1..C-9 in plan.md (C-GATE); and OQ-2..OQ-9 as recommended. Per OQ-3(b), the AC "a direct intent request queues a coalesced turn that narrates it" moves here from TASK-0247. Per OQ-4, TASK-0314 merges before this card.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 066 re-scoped to the server half (5d9c8153): 53 tasks in 6 phases. The orchestrator keeps contract blocks C-6, C-7 and C-9 in this card's Phase 4, so every frozen-contract change lands in one PR and TASK-0315 builds against them.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 1 committed as c87570ed; ci:check green. Phase 2 hit TS2366: widening ProposalKindSchema breaks the exhaustive detailsOf in apps/web/app/play/proposals.ts. Orchestrator ruling: add two minimal case lines carrying a ponytail that names TASK-0315 (the TASK-0268 precedent), with no default case.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 3 (797971db): ci:check green with REQUIRE_DATABASE=1, 1843 server tests. TASK-0314 took enqueue rule 8, so the direct-intent narration rule is rule 9 and nudge() is item 10. A ruling that fires both rules queues one turn (tested). Rule 9 is narrowed to settled-with-engine-rows or stopped, so speech and ask_dm do not queue a second narration turn (spec FR-031 note; orchestrator accepted). The intent turn skips the director call.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 4-5 done. Contract blocks C-1..C-9 are in 7c0d1613, with dated notes recording the code as built. The wiki is in a499bc73: 10 NEEDS-REVIEW notes and 7 RE-PIN-ONLY. Open for TASK-0315: confirm the C-7 wording on dropping 'The party' from the speaker chip.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 6 T049-T051 (1eaf4785, 2ddacdbd). DB suites: session-model 1035, gate 62, dm 1167. Mutation guard: every stub fails tests (readablePosts 9, suggestionState 5, acceptor 2, interruptRead 2, rule 9 3). Script-mode server check on the worktree app passed after F1, a missing dm.narrate entry in greyhollow-confirm.json for the rule 9 turn, now fixed. No paid calls; no vm-104 credential used.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Session model — event, catalog, projection, read rule (card AC #1, #2, #4): 10/10 · Gate — suggest, accept, `ask_dm` (card AC #3, #5): 13/13 · DM runtime — window, marker, interrupt, read, rule 9 (card AC #1, #2, #5, #7): 18/18 · Frozen-contract amendment blocks (C-GATE ruled 2026-11-11): 3/3 · Wiki — server share (NEEDS-REVIEW): 4/4 · Verification **[orchestrator]**: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
