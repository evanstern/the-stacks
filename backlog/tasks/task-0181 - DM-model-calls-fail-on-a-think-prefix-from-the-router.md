---
id: TASK-0181
title: DM model calls fail on a <think> prefix from the router
status: To Do
assignee: []
created_date: '2026-10-30 00:45'
updated_date: '2026-10-30 01:02'
labels:
  - dm
  - bug
  - hosted-dev
  - blocker
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
  - apps/server/src/dm/pipeline/call.ts
priority: high
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: DM model calls return parseable JSON on the first attempt on hosted dev. A turn no longer fails or doubles its time and cost because a reply starts with an empty think block.

Why: two-browser alpha playtest 2026-10-28, run 2 item 3, session 166b8e59. Turn job bb36c8a9 failed after 40 s with 'model output failed its schema twice (dm.interpret)'. Attempt 1 was only '<think></think>': 1200 output tokens over 15 s. Attempt 2 was '<think></think>' followed by valid JSON. The reconcile turn re-ran it about 50 s later, and players waited about 2 min 15 s with no sign of work or failure. The same pattern (a first director or interpret call of 13-18 s, then a fast retry) appears in most turns this run: affected turns took 30-42 s and cost 0.13-0.16 USD, against 10-21 s and 0.04-0.08 USD for clean turns.

Grounding: parseAgainst in apps/server/src/dm/pipeline/call.ts runs JSON.parse(stripFence(text)). stripFence removes only a code fence. The cc/ model IDs arrived with the 9router switch on 2026-10-28 (TASK-0101), which is the suspected source of the think block. Not yet confirmed on vm-104.

Related: TASK-0132 (players see nothing while a turn runs or fails), TASK-0102 (director output survives real models).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause of the think block is identified (router, model or provider setting) and recorded on this card
- [ ] #2 DM calls parse a reply that starts with a think block, or the source stops emitting it; the spec decides which
- [ ] #3 A test covers a reply with a leading empty and non-empty think block
- [ ] #4 A hosted-dev turn after deploy shows no invalid-json attempts in the debug calls list
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 2 item 4 evidence: turns at 00:50 and 00:52 both failed at interpret. Three of four attempts returned only '<think></think>' yet used exactly 1200 output tokens, which suggests hidden thinking consumes the whole output budget. The table stalled, and each turn posted 'The DM runtime stopped at interpret: invalid-output.'

Lead: PURPOSE_MAX_TOKENS in apps/server/src/dm/purposes.ts caps dm.interpret at 800 and dm.director at 600, yet failed attempts show exactly 1200 output tokens with only '<think></think>' as text. The router or model likely spends the cap on hidden reasoning. Longer actions fail more often (00:55 retry of act-197dae73 also failed). Check the router's thinking setting and the effective maxTokens before stripping tags.

Operator ruling 2026-10-29: showstopper. Run 2 of the two-browser alpha playtest ended on it at about 01:00 UTC. The same committed action (act-197dae73) failed four turns in a row (00:50, 00:52, 00:55, 00:59). The 00:59 director attempt 1 was '<think></think>' followed by valid JSON, so stripping the prefix alone would have saved it. Attempt 2 omitted companionPrompts. TASK-0163 run 3 waits on this fix being deployed to vm-104.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
