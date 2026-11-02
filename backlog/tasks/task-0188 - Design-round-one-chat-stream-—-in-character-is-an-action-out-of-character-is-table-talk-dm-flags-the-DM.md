---
id: TASK-0188
title: >-
  Design round: one chat stream — in character is an action, out of character is
  table talk, @dm flags the DM
status: In Progress
assignee: []
created_date: '2026-11-02 04:03'
updated_date: '2026-11-02 04:18'
labels:
  - design
  - web
  - dm
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the play route has one composer. An in-character post is implicitly an action the DM reads; an out-of-character post is table talk the DM ignores unless it carries @dm (for example '@dm how high is that wall?'). The group sign-off (Approve, Object, Comment, then Commit) is rethought or removed. The design keeps chat as a view over the event log, so a later VTT can drive the same events with fewer typed commands.

Why: alpha run 3 (2026-11-01), finding 2, operator. Sign-off has no teeth: a declarer can commit at once (no chance to weigh in), Approve and Object are disabled until you type a comment, and an objection does not block Commit. Separately, the Talk/Action split makes players choose a mode before speaking; in run 3 every in-character line was posted as an Action, so TASK-0180's talk path never ran.

Operator-in-the-loop design work: run it with pdlc:design-rounds (options, operator picks, decision record, then a spec). It likely amends decision-0016 (D8) and decision-0027 (D19), and touches the frozen 029 proposal contracts and 030 play-route contracts.

Related: TASK-0131 and TASK-0129 (Ask the DM, overlaps @dm), TASK-0072 (VTT adapter), TASK-0180 (talk triggers), TASK-0162 (composer draft).

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record states the single-stream model: what an in-character post, an out-of-character post and an @dm post each mean to the DM
- [ ] #2 The decision states what replaces or removes group sign-off, and how a player retracts or amends a declared action
- [ ] #3 The decision states how the model maps onto events a VTT could also emit
- [ ] #4 A spec is written against the decision and its implementation tasks are carded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed for pdlc:design-rounds on 2026-11-01. Long-running worktree: /Users/evanstern/projects/the-stacks/.claude/worktrees/nostalgic-shaw-8530e9 (harness isolation root), branch task-0188-one-chat-stream. Rounds land under docs/design/one-chat-stream/. No spec number is claimed until the decision exists.

Round 1 (2026-11-01): docs/design/one-chat-stream/round-1/ (brief.md, index.html, options A/B/C, Brave shots). Shared baseline: one composer with a speaker chip, OOC is table talk the DM never reads, @dm gets one read-only OOC answer, and a hold window (Hold/Release/Retract/Amend) replaces Approve/Object/Comment/Commit. Axis: who decides that a line is a deed. A: every IC line is a declare. B: IC is talk, and the DM privately asks Do it / Just talking. C: a split Say/Do send button. Frozen-contract cost: all three need a 029 action.commit override 'window'. B also needs an intent marker on narration. Asked of the operator: pick a direction, or a hybrid. Mock build: Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
