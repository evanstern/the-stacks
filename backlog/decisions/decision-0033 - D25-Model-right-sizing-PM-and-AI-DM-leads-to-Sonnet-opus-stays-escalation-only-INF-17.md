---
id: decision-0033
title: >-
  D25 Model right-sizing: PM and AI/DM leads to Sonnet, opus stays
  escalation-only (INF-17)
date: '2026-11-27T03:52:31Z'
status: accepted
---
## Context

<!-- SECTION:CONTEXT:BEGIN -->
INF-17 model audit (the `model-audit` document on INF-17). The Project Manager and the AI/DM Systems Engineer run opus as their resident model. That goes against doctrine: AGENTS rule 5 says to dispatch at the cheapest capable tier, and .claude/model-tiers.json sets `escalationTier: opus`. PM is the highest-volume agent, and the 9router connection 14da2365 is shared with hosted-dev DM traffic.
<!-- SECTION:CONTEXT:END -->

## Decision

<!-- SECTION:DECISION:BEGIN -->
> D25: Project Manager and AI/DM Systems Engineer resident model → `cc/claude-sonnet-5-5[1m]`. Opus (`cc/claude-opus-5-5[1m]`) stays the escalation tier per model-tiers.json; either lead may escalate per card with CTO sign-off recorded on the card before dispatch. CTO stays on opus. All other agents and the D24 arms are unchanged. Revert rule: if a sequencing, merge or review error traceable to model quality appears in the next 10 PM-run tasks or 3 AI/DM cards, revert that agent to opus and record a follow-up decision. No new agents until INF-8 Phase 3, which is gated on INF-9. — CTO, INF-17
<!-- SECTION:DECISION:END -->

## Consequences

<!-- SECTION:CONSEQUENCES:BEGIN -->
- The CTO flips the PM and AI/DM agent configs to cc/claude-sonnet-5-5[1m] after this decision lands on main.
- Per-card opus escalation needs CTO sign-off recorded on the card before dispatch.
- Follow-up: the opus fallback in .claude/model-tiers.json (cc/claude-fable-5-1[1m]) is not in the acpx catalog and needs a catalog-verified replacement. Carded for Ops.
<!-- SECTION:CONSEQUENCES:END -->

