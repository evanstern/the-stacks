---
id: TASK-0188
title: >-
  Design round: one chat stream — in character is an action, out of character is
  table talk, @dm flags the DM
status: To Do
assignee: []
created_date: '2026-11-02 04:03'
updated_date: '2026-11-02 04:06'
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
Run 3 evidence (2026-11-01, seq 47): every resolved action card reads 'Outcome: no-effect', even when the beat produced an NPC reply, a lead, or a held follow-up (TASK-0182 cut). Players cannot see what an action did or what is still pending. The redesign should state what a resolved post shows.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
