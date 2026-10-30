---
id: TASK-0181
title: DM model calls fail on a <think> prefix from the router
status: In Progress
assignee: []
created_date: '2026-10-30 00:45'
updated_date: '2026-10-30 02:30'
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

Spec: specs/063-think-block
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause of the think block is identified (router, model or provider setting) and recorded on this card
- [ ] #2 DM calls parse a reply that starts with a think block, or the source stops emitting it; the spec decides which
- [ ] #3 A test covers a reply with a leading empty and non-empty think block
- [ ] #4 A hosted-dev turn after deploy shows no invalid-json attempts in the debug calls list
- [ ] #5 Spec phase: Strip leading think blocks (card AC #2, #3; US1)
- [ ] #6 Spec phase: Mutation guard **[orchestrator]** (card AC #3)
- [ ] #7 Spec phase: Cause probe and source fix **[orchestrator]**, operator's go (card AC #1, #2; US2)
- [ ] #8 Spec phase: Wiki **[orchestrator]** (re-ground)
- [ ] #9 Spec phase: Hosted-dev check after deploy **[orchestrator]**, operator's go (card AC #4; US3)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 2 item 4 evidence: turns at 00:50 and 00:52 both failed at interpret. Three of four attempts returned only '<think></think>' yet used exactly 1200 output tokens, which suggests hidden thinking consumes the whole output budget. The table stalled, and each turn posted 'The DM runtime stopped at interpret: invalid-output.'

Lead: PURPOSE_MAX_TOKENS in apps/server/src/dm/purposes.ts caps dm.interpret at 800 and dm.director at 600, yet failed attempts show exactly 1200 output tokens with only '<think></think>' as text. The router or model likely spends the cap on hidden reasoning. Longer actions fail more often (00:55 retry of act-197dae73 also failed). Check the router's thinking setting and the effective maxTokens before stripping tags.

Operator ruling 2026-10-29: showstopper. Run 2 of the two-browser alpha playtest ended on it at about 01:00 UTC. The same committed action (act-197dae73) failed four turns in a row (00:50, 00:52, 00:55, 00:59). The 00:59 director attempt 1 was '<think></think>' followed by valid JSON, so stripping the prefix alone would have saved it. Attempt 2 omitted companionPrompts. TASK-0163 run 3 waits on this fix being deployed to vm-104.

Operator ruling 2026-10-29, sweep order: 'Add TASK-0181 to the runbook ahead of TASK-0163 AC #4: fix it, merge on green, confirm it deployed to vm-104, then stop for run 3.' Each vm-104 command still needs the operator's go.

Claimed 2026-10-29 by the M3 sweep, resumed 2026-10-29 (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0181, branch task-0181-think-block, cut from origin/main 06fe2971. Spec number 063 claimed with a stub. Runbook amendment 141e4994: TASK-0181 first, then TASK-0182, TASK-0180, stop before run 3.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec set 72811b2d (spec 063): 5 phases, OQ-1 to OQ-4 with (a) defaults; no frozen-contract change (additive 031 node-seam.md line). Cause from repo evidence: 9router cc/ routes run extended thinking, rendered as literal <think> text in delta.content, with hidden tokens consuming max_tokens (think-only replies at exactly 1200 tokens). Probe P1/P2 on vm-104 waits on the operator's go.

Operator ruled 2026-10-29 in the M3 sweep chat, verbatim: "TASK-0181: I accept the recommended defaults OQ-1 to OQ-4 (a), including the additive 031 node-seam amendment."

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 1 d5aba097: stripThink in dm/pipeline/call.ts, used by parseAgainst and callText; raw text kept for re-ask and excerpts; 031 node-seam.md amended (additive). call.test.ts 5/26 failed before, 26/26 after.

Probe 2026-10-29 under the operator's go on each exact command (evidence/probe.md): curl is absent from the app container; Node fetch on the app's own dm.interpret route (http://9router.local.infinity-node.win/v1, cc/claude-sonnet-5, maxTokens 1200) failed with ENOTFOUND. getent finds no address on vm-104 or in the container. No model call was made and P2 was not run. AC #1 stays unconfirmed by probe. Hosted dev cannot reach 9router at all right now, a blocker for run 3 that is separate from the think block; raised with the operator.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 4 594e98a2: dm-runtime, dm-failure-and-gates and ai-gateway are NEEDS-REVIEW, amended and re-pinned; debug-view RE-PIN-ONLY. Runbook log row. Freshness OK, spec-bridge 0. vm-104 resolver (operator-run resolvectl): current DNS is upstream IPv6 2605:9fc0:0:53::1, not the Pi-hole 192.168.1.79, which holds 9router at 192.168.1.103. The DNS fix is the operator's.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
