---
id: TASK-0361
title: Replace non-existent opus fallback in .claude/model-tiers.json (D25 follow-up)
status: To Do
assignee: []
created_date: '2026-11-27T03:52:41Z'
labels:
  - ws:ops
  - infra
dependencies:
  - TASK-0360
references:
  - .claude/model-tiers.json
priority: medium
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
D25 (decision-0033) follow-up from the INF-17 model audit. The `.claude/model-tiers.json` opus tier has `fallback: cc/claude-fable-5-1[1m]`, but that ID does not exist in the acpx catalog, which has only `cc/claude-fable-5-2` and `cc/claude-fable-5`. Replace it with a catalog-verified ID. The candidate is `cc/claude-fable-5-2[1m]`; Ops must verify its context window and record served= from a run receipt per D23 (decision-0031). Sequence after TASK-0360 (INF-12) merges so the two PRs don't conflict on tiers.json. Deliver by PR. Owner: Ops Engineer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 opus fallback in .claude/model-tiers.json is a catalog-verified ID (candidate cc/claude-fable-5-2[1m]) with its context window verified
- [ ] #2 Dispatch: line with served= taken from a run receipt per D23 recorded on this card
- [ ] #3 Regenerated .claude/agents committed; tiers.mjs --check exits 0
- [ ] #4 Landed by PR after TASK-0360 merged; no tiers.json conflict
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
