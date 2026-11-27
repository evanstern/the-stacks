---
updated_date: '2026-11-27T03:36:08Z'
title: >-
  D24 Model experiment 1: Rules Engine on Kimi (same harness) vs Sonnet on
  spell-resolution cards
id: decision-0032
date: '2026-11-27T03:35:47Z'
status: accepted
---
## Context

<!-- SECTION:CONTEXT:BEGIN -->
INF-8 Phase 2 (team & model strategy). Every agent runs Claude Code on cc/claude-* models via the 9router connection 14da2365. On 2026-11-27 Coda confirmed that the same Anthropic-protocol 9router connection serves Kimi models (kimi/kimi-for-coding, kimi/kimi-k3, kimi/k3.1-pro, kimi/kimi-k2.7-code). So a model swap needs no new connection and no harness switch, and the Claude Code Stop/PreToolUse pdlc hooks (bridge gate, dispatch record, root-guard, wiki freshness, tiers check) stay active. The INF-7 pilot has not run, so there is no team baseline yet. Prior 9router lessons (TASK-0181/0192/0203): some routes emit <think> text that eats max_tokens, and IDs must be route-prefixed.
<!-- SECTION:CONTEXT:END -->

## Decision

<!-- SECTION:DECISION:BEGIN -->
Hypothesis: on deterministic, test-oracle engine work, Kimi (kimi/kimi-for-coding) on Claude Code matches Claude Sonnet (cc/claude-sonnet-5-5[1m]) on correctness at lower cost.

This is a pure model A/B with harness held constant. The OpenCode harness A/B is a separate, later experiment and stays blocked on INF-9 (gates in CI) per the INF-8 constraint.

Arms:
- Control: the existing Rules Engine Engineer, unchanged (cc/claude-sonnet-5-5[1m]).
- Treatment: a second experimental agent, "Rules Engine Engineer (Kimi)", with the same instructions, harness (acpx/claude) and connection, and model kimi/kimi-for-coding. The control agent's config is never flipped, so rollback is pausing one agent.

Cards: three same-shape cards from the spec-083 OQ-2 SPELL_UNRESOLVED family (packages/dnd5e-engine, tests as the oracle):
- Treatment: TASK-0228 (repeat saves: Hold Person/Sleep) and TASK-0229 (roll riders: Guiding Bolt/Shocking Grasp).
- Control: TASK-0226 (concentration and roll bonuses: Bless/Guidance).
- Extension pair if results are ambiguous: TASK-0227.

The control arm is the baseline; this replaces the INF-7 precondition for this experiment only. The Project Manager sequences the cards and allocates spec numbers. Every arm follows the normal loop: spec trio, one TASK one PR, gates, PM merges serially.

Metrics, recorded per card in its final summary:
1. CI green on the first PR push (y/n)
2. Review findings at PR review (count, severity)
3. Rework cycles after first review
4. Tokens and cost (Paperclip run receipts)
5. Wall time from claim to PR ready
6. Gate violations caught by hooks/CI
7. Served model: Dispatch: tier=<t> pinned=<id> served=<id>, with served= taken from the Paperclip run receipt's model. A non-Kimi served= invalidates that card's treatment data.

Rollback rule: pause the Kimi agent and re-route its card to the control agent on any of these:
- a gate bypass or an artifact claim its files do not prove
- served= not Kimi on the first run
- two consecutive rework cycles on one card
- <think>/max_tokens truncation that recurs after one config fix
- visible contention with hosted-dev DM traffic on 9router during a playtest

Adopt rule: the treatment meets or beats control on metrics 1–3 at lower metric-4 cost. That makes Kimi the Rules Engine sonnet-tier default via a follow-up decision. Otherwise reject, or extend with TASK-0227.
<!-- SECTION:DECISION:END -->

## Consequences

<!-- SECTION:CONSEQUENCES:BEGIN -->
- One extra agent exists for the experiment's duration. It is paused or terminated at the result decision.
- Dispatch evidence follows D23 (decision-0031):
  - Treatment implementation dispatches pin Kimi via a new 'kimi' tier in .claude/model-tiers.json (model kimi/kimi-for-coding). It lands by PR and passes tiers.mjs --check before the first treatment dispatch. Otherwise the implementer silently falls back to the sonnet tier and the arm measures Sonnet.
  - Record each dispatch as Dispatch: tier=kimi pinned=kimi/kimi-for-coding served=<run-receipt model>.
- The result is a follow-up Backlog decision (adopt/reject/extend). The INF-8 Phase 3 decision (non-Claude QA) is separate.
- Kimi spend runs through 9router subscription routes. No paid spend is authorised beyond the team budget.
- 9router shares upstream limits with hosted-dev AI_PROVIDERS, so the treatment does not run during a scheduled playtest.
<!-- SECTION:CONSEQUENCES:END -->

## Alternatives

<!-- SECTION:ALTERNATIVES:BEGIN -->
- Flip the existing Rules Engine Engineer's model per card. Rejected: config churn makes served= attribution and rollback error-prone.
- OpenCode + Kimi now. Rejected until INF-9 lands: no gate enforcement outside Claude Code hooks.
- Wait for the INF-7 pilot baseline. Rejected: an in-experiment control arm on the same card family is a better baseline than one unrelated pilot card.
<!-- SECTION:ALTERNATIVES:END -->

