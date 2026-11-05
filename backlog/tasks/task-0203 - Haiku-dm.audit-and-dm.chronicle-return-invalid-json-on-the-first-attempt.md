---
id: TASK-0203
title: Haiku dm.audit and dm.chronicle return invalid-json on the first attempt
status: In Progress
assignee: []
created_date: '2026-11-02 19:42'
updated_date: '2026-11-05 03:38'
labels:
  - dm
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: dm.audit and dm.chronicle parse on their first attempt, so a turn does not pay for a repair re-ask.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, scene start): dm.audit-v4 and dm.chronicle-v3 (cc/claude-haiku-4-5) both returned invalid-json on attempt 1 and recovered on attempt 2. Alpha run 3 (2026-11-01) showed the same two purposes failing once each. The ledger holds no text, so the shape of the bad reply is unknown.

Where: apps/server/src/dm/pipeline/call.ts (callJson), the haiku purposes' prompts, and the 9router cc/ haiku route. Candidates: a think block stripThink misses, prose around the JSON, or a code fence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause of first-attempt invalid-json on the haiku purposes is identified and recorded
- [ ] #2 A hosted run of 10+ turns shows no invalid-json on dm.audit or dm.chronicle attempt 1
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 again (seq 31-32): dm.chronicle-v3 invalid-json on attempt 1, ok on attempt 2. 3 of 3 chronicle/audit job starts so far had a first-attempt failure.

Run 1 seq 59: dm.companion-v6 invalid-json on attempt 1 (460 output tokens), ok on attempt 2. So the first-attempt failure is not haiku-only.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0203, branch task-0203-haiku-parse, cut from origin/main b756b68f. No spec dir: signed escape line covers this task. Escape E1 (card ACs drive).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (E1 implementation)

AC #1 cause (2f9b45c4): confirmed from code, the parser accepted only a bare object or a whole-reply fence; prose around the object, a fence wrapped in prose, or an unclosed think block (stripThink skips those by spec 063 contract) threw. Which shape the 9router haiku route sends is inferred, not confirmed (no reply text in the ledger). Fix: strict parse, then the single top-level object by a string-aware scan; ambiguous output still rejected. Each unparsable attempt now logs dm.call.invalid-json with a bounded head/tail excerpt, so the next hosted run shows the real shape. AC #2 waits for runbook B's playtest.

Playtest ceiling (runbook B playtest, 2026-11-03), operator's words: "Play it, ceiling $100".

Runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 28): dm.chronicle-v4 invalid-json on attempt 1 again (194 tokens), ok on attempt 2. The 2f9b45c4 parser change did not cover this reply shape. The server log line dm.call.invalid-json (head/tail excerpt) on vm-104 now shows the shape; reading it needs a vm-104 command. AC #2 not met so far.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
