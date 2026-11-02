---
id: TASK-0188
title: >-
  Design round: one chat stream — in character is an action, out of character is
  table talk, @dm flags the DM
status: In Progress
assignee: []
created_date: '2026-11-02 04:03'
updated_date: '2026-11-02 04:59'
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

Round 1 (2026-11-01): docs/design/one-chat-stream/round-1/ (brief.md, index.html, options A/B/C, Brave shots). Shared baseline: one composer with a speaker chip, OOC is table talk the DM never reads, @dm gets one read-only OOC answer, and a hold window (Hold/Release/Retract/Amend) replaces Approve/Object/Comment/Commit. Axis: who decides that a line is a deed. A: every IC line is a declare. B: IC is talk, and the DM privately asks Do it / Just talking. C: a split Say/Do send button. Frozen-contract cost: all three need a 029 action.commit override 'window'. B also needs an intent marker on narration. Asked of the operator: pick a direction, or a hybrid. Mock build dispatched below.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Round 1 selection (2026-11-01), operator: "C, Say or Do". decision-0028 (D20) drafted as proposed, written against C. Open: OQ-1 to OQ-10 and the section 6 frozen-contract amendments (029 commit authority, 044 sign-off, 049 floor-jobs, 030 proposal-seam). No ws-protocol frame change.

Operator feedback on decision-0028 OQ-1 (2026-11-01), verbatim: "I'm conflicted -- I feel like I'd rather have #1 be "after 8s the DM asks explicitly for a 👍 (approval) 'Tamsin is going to look ahead using Stealth, is this correct'" -- that could get annoying on every action, but it *would* help to ensure that the interpretation by the AI DM is accurate -- this may even imply that the action has had a moment to be understood though which may not have happened. What about this UX: 2 seconds after there has been no message, for an ADDITIONAL 8s after a message comes in (so that it's not showing up right away), a visual indicator (8 segmented circle with 8 filled in lines where one line disappears per second) is shown. After 8 seconds, the AI takes a shot at understanding the conversation and responding with "Do you want to do xyz?". At any time during that 2second + 8 second (10s total) window, before the AI does its thing, a player can just type something and the timer will restart. After the 10 second window, when the AI starts thinking, the indicator turns into a "Thinking" indicator. At that point, a person can still interrupt with extra "do"/action text but an "override" or "I'm sure" style button must be pressed so that it's clear to the player that they're interrupting the AI (discourage it, basically)." Round 2 develops this: the quiet window plus a DM confirm replaces the hold window. decision-0028 stays proposed until round 2 is ruled.

Round 2 (2026-11-01): docs/design/one-chat-stream/round-2/ (brief.md, index.html, A just-talk, B flag-a-deed, Brave shots). It develops the operator's quiet-ring UX: a 2 s + 8 s ring, the DM reads the table, a confirm row (👍 Yes / Not quite), and an inline I'm sure strip to interrupt. Axis: does the player still mark a deed? A: one Send. B: Send plus a Do flag (a TalkV1 field). Both need the new action.suggest kind, the action.suggested event, and suggestionId on declare (frozen). Asked of the operator: pick A or B, and rule OQ-R1 to OQ-R5.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Round 2 selection (2026-11-01), operator: "A, just talk". decision-0028 rewritten against round 2 A, still proposed. Pending: OQ-R1 to OQ-R5, OQ-7, OQ-10, OQ-11, and the section 8 frozen-contract amendments (029 proposals, policy-and-authority and proposal-events; 030 proposal-seam; 031 additive). No ws-protocol frame change, no TalkV1 change.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
