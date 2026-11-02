---
id: TASK-0181
title: DM model calls fail on a <think> prefix from the router
status: Done
assignee: []
created_date: '2026-10-30 00:45'
updated_date: '2026-11-02 08:49'
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
- [x] #1 The cause of the think block is identified (router, model or provider setting) and recorded on this card
- [x] #2 DM calls parse a reply that starts with a think block, or the source stops emitting it; the spec decides which
- [x] #3 A test covers a reply with a leading empty and non-empty think block
- [x] #4 A hosted-dev turn after deploy shows no invalid-json attempts in the debug calls list
- [x] #5 Spec phase: Strip leading think blocks (card AC #2, #3; US1)
- [x] #6 Spec phase: Mutation guard **[orchestrator]** (card AC #3)
- [x] #7 Spec phase: Cause probe and source fix **[orchestrator]**, operator's go (card AC #1, #2; US2)
- [x] #8 Spec phase: Wiki **[orchestrator]** (re-ground)
- [x] #9 Spec phase: Hosted-dev check after deploy **[orchestrator]**, operator's go (card AC #4; US3)
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

spec-bridge sync: Strip leading think blocks (card AC #2, #3; US1): 7/7 · Mutation guard **[orchestrator]** (card AC #3): 1/1 · Cause probe and source fix **[orchestrator]**, operator's go (card AC #1, #2; US2): 0/4 · Wiki **[orchestrator]** (re-ground): 5/5 · Hosted-dev check after deploy **[orchestrator]**, operator's go (card AC #4; US3): 0/3

Merged as #91 at 86e34adb under the operator's words "Merge PR #91 (TASK-0181) now as a merge commit; CI is green." AC #2 (strip at parse) and AC #3 (test) are met. The card stays In Progress: AC #1 is unconfirmed (the by-IP probe P1 on a trivial prompt showed no think block; a real dm.interpret replay is needed), and AC #4 waits on the operator fixing vm-104 DNS to the Pi-hole, then a hosted turn.

Probe P2 by IP (operator-run, 2026-10-29): reasoning_effort none, status 200, delta.content {"ok":true}, no think block, finish_reason stop, 2048 prompt and 9 completion tokens. Identical to P1. On a trivial prompt neither shows a think block, so P2 cannot tell whether reasoning_effort turns thinking off. AC #1 needs a replay of a real dm.interpret request. The P1 result is in specs/063-think-block/evidence/probe.md on main.

vm-104 DNS (operator-run, 2026-10-30): on vm-104, `sudo resolvectl dns ens18 192.168.1.79` then `resolvectl query 9router.local.infinity-node.win` answered 192.168.1.103 via ens18. Confirms the resolver diagnosis: vm-104 resolves 9router once it asks the Pi-hole. This is a runtime-only change; it lasts until reboot or DHCP renew. Next: confirm from stacks-dev-app-1, then make it permanent in netplan (operator).

Container check (operator-run, 2026-10-30): `sudo docker restart stacks-dev-app-1 && sudo docker exec stacks-dev-app-1 getent hosts 9router.local.infinity-node.win` answered 192.168.1.103. The hosted-dev app container now resolves 9router. Still runtime-only until netplan persists it.

Permanent DNS fix (operator-run, 2026-10-30): the router IPv6 RA supplied the 2605:9fc0:0:53::1/::2 servers; netplan already listed only 192.168.1.79. Added drop-in /etc/systemd/network/10-netplan-ens18.network.d/no-ra-dns.conf ([IPv6AcceptRA] UseDNS=no), then networkctl reload + reconfigure ens18. `resolvectl status ens18` now lists DNS Servers: 192.168.1.79 only. Survives reboot and netplan apply.

Deploy check (operator-run, 2026-10-30): stacks-dev-app-1 label org.the-stacks.commit = 2b0bb5d1 (deploy-dev success 15:25Z). It contains #91 (stripThink) and #95 (TASK-0180). Later main commits are board-only.

AC #4 hosted check (operator-run, 2026-10-30, deploy 2b0bb5d1): operator posted a turn on hosted dev. dm_model_calls for the last 2 hours: 10 rows between 16:26:59Z and 16:27:46Z (two turns with director, interpret, narrate and audit; one companion; two chronicle). Every row has outcome ok and call_attempt 1. No invalid-json, no error, no retry. Models: cc/claude-opus-5 (director), cc/claude-sonnet-5 (interpret, narrate, companion), cc/claude-haiku-4-5-20251001 (audit, chronicle). dm.interpret-v5, the call that failed in run 2, parsed on its first attempt.

Alpha run 3 evidence (2026-11-01, session e8e8326d, deploy 84b130a0): 21 calls, 2 invalid-json on attempt 1, both recovered on attempt 2: dm.chronicle-v3 (haiku) and dm.audit-v3 (haiku). No invalid-json on director, interpret or narrate. The ledger holds no text, so whether these were think blocks (which stripThink would remove) or another shape is unknown; AC #1 stays open.

AC #1 cause, strong evidence (alpha run 3, 2026-11-02 ~04:18Z, session e8e8326d, turn mode after the causeway fight started): 'I run to Pell and attempt to free him' failed interpret on 3 turn attempts in a row (6 calls, dm.interpret-v5, cc/claude-sonnet-5). Every failed call returned exactly 1200 output tokens = the dm.interpret maxTokens. Reading: hidden thinking uses the whole output budget on harder prompts, so the reply truncates before any JSON; stripThink cannot help because no JSON was emitted. Free-mode interpret calls this run used about 200 output tokens and passed. Fix candidates: raise dm.interpret maxTokens in vm-104 AI_PURPOSES (operator config, then redeploy to re-read the env), and/or turn router-side thinking off for cc/ routes. Spend at this point: $1.32 of $50.

Fix confirmed (operator, 2026-11-02): vm-104 AI_PURPOSES dm.interpret maxTokens 1200 -> 4000 (before/after printed, provider claude, model cc/claude-sonnet-5 unchanged), then deploy-dev run 41388342321 success, /health ok at b481e308. The stalled 'free Pell' action then got past interpret on the next turn job (seq 133). Interpret had failed 8 times at exactly 1200 output tokens before the change. Follow-up: the repo default/example values (.env.example 800) are below what thinking needs; card it.

Closed by runbook A lane A1 (2026-11-02). AC #1 and #7: the cause is the 2026-11-02 note above. Hidden thinking spent the whole dm.interpret maxTokens (1200), so interpret truncated before any JSON. The source fix the operator picked: raise maxTokens (vm-104 env 4000, 2026-11-02). Repo defaults followed in TASK-0192, PR #102 (8b2a283b), which also records truncated calls distinctly. Probes P1/P2 were superseded by run 3's ledger evidence. AC #9: the 2026-10-30 hosted check above (deploy 2b0bb5d1, every call ok on attempt 1).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cause: hidden thinking on 9router cc/ routes spent the whole maxTokens, so interpret truncated before any JSON (think blocks also rendered as text). Fixes: stripThink (#91), vm-104 interpret maxTokens 4000 (operator, 2026-11-02), and repo defaults 4000 plus a truncated outcome (TASK-0192, PR #102). Spec 063 probe and hosted tasks were ticked as superseded in PR #104.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
