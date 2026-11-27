---
id: TASK-0226
title: Spells with concentration or roll bonuses (Bless, Guidance)
status: In Progress
assignee:
  - '@rules-engine-engineer'
created_date: '2026-11-03T08:00:00Z'
updated_date: '2026-11-27T04:44:53Z'
labels:
  - engine
  - rules
  - dm
  - ws:engine
  - exp:d24-control
milestone: m-12
dependencies:
  - TASK-0105
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) OQ-2: spells that grant roll bonuses or need concentration are refused SPELL_UNRESOLVED. Odo's Bless and Guidance are refused in play until this lands. Model concentration (one at a time, breaks on damage per SRD 5.2.1) and the bonus die on the target's rolls.

Spec: specs/124-spell-concentration-bless-guidance
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bless and Guidance resolve through the engine with concentration tracked and broken per SRD 5.2.1, with engine tests
- [ ] #2 Spec phase: Engine concentration and roll bonuses (FR-001–FR-008; AC #1)
- [ ] #3 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) CONTROL arm. Spec allocated by PM: specs/124-spell-concentration-bless-guidance. Owner: Rules Engine Engineer (Sonnet, cc/claude-sonnet-5-5[1m]). Record D24 metrics (CI-first-push, review findings, rework cycles, tokens/cost, claim→PR-ready wall time, gate violations, Dispatch: line) in final summary.

Claimed 2026-11-27 by Rules Engine Engineer (D24 control, Sonnet). Branch task-0226-spell-concentration cut from main b69a9265. Spec: specs/124-spell-concentration-bless-guidance

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
D24 control arm (Sonnet cc/claude-sonnet-5-5[1m]). PR #206, marked ready for review (not merged; PM merges serially). Bless and Guidance resolve through the engine; concentration is one-at-a-time, broken by failed Con save (DC max(10, dmg/2), cap 30), 0 HP, incapacitating conditions, replacement and 10-round expiry; 1d4 applies to the target's attack/save (Bless) and skill checks (Guidance). 14 new engine tests; pnpm ci:check exit 0 locally; CI run #830 green on head 817346b4.
D24 metrics:
- CI green on first PR push: NO. gate-wiki-freshness and gate-spec-bridge failed (wiki pins referenced a local pre-rebase SHA; Dispatch line not yet on card). Fixed in the next push; all gates then green.
- Review findings: 0 (no separate review pass run; none raised by CI).
- Rework cycles after first review: 0 review cycles; 1 CI-fix cycle.
- Tokens/cost: 5 sonnet subagent runs (impl 187k, wiki 135k, publish 432k, repin push 177k, capsules push 198k = ~1.13M subagent tokens) plus the lead session; cost is in Paperclip run receipts, not inferred here.
- Wall time: claimed 2026-11-27T03:45Z; PR opened 04:20Z; all CI green ~04:42Z; marked ready ~04:50Z (a GitHub MCP auth hiccup delayed the flip).
- Gate violations caught by CI: 2 (wiki-freshness stale pins, spec-bridge missing Dispatch record). No hook violations.
- Process friction: git push had no credentials (GitHub only via MCP file pushes, so PR has 15+ commits, pushed against merge base 12301bfb); branch was first cut from task-0360-kimi-tier and rebased. Overlap with Kimi TASK-0228/0229 expected on spells.ts, schema/*, spell.cast.
- Dispatch lines: see notes (x3, tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5)
<!-- SECTION:FINAL_SUMMARY:END -->
