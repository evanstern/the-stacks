---
id: TASK-0203
title: Haiku dm.audit and dm.chronicle return invalid-json on the first attempt
status: To Do
assignee: []
created_date: '2026-11-02 19:42'
updated_date: '2026-11-02 22:21'
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
- [ ] #1 The cause of first-attempt invalid-json on the haiku purposes is identified and recorded
- [ ] #2 A hosted run of 10+ turns shows no invalid-json on dm.audit or dm.chronicle attempt 1
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 again (seq 31-32): dm.chronicle-v3 invalid-json on attempt 1, ok on attempt 2. 3 of 3 chronicle/audit job starts so far had a first-attempt failure.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
