---
id: TASK-0360
title: Add kimi tier to .claude/model-tiers.json (D24 prerequisite)
status: To Do
assignee: []
created_date: '2026-11-27T03:38:07Z'
updated_date: '2026-11-27T03:38:25Z'
labels:
  - ws:ops
  - infra
dependencies: []
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
D24 (decision-0032) prerequisite: add a 'kimi' tier with model kimi/kimi-for-coding and contextWindow as served by 9router (connection 14da2365). Regenerate .claude/agents via pdlc tiers.mjs; must pass tiers.mjs --check, including alongside INF-9/TASK-0359 CI gates. Without it, the treatment implementer dispatch falls back to sonnet and the arm is invalid. Not the defaultTier; not escalation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 kimi tier present in .claude/model-tiers.json with model kimi/kimi-for-coding and 9router-verified contextWindow
- [ ] #2 Generated .claude/agents/kimi-implementer.md committed; tiers.mjs --check exits 0
- [ ] #3 One-off dispatch proves the kimi-implementer is served kimi/kimi-for-coding (recorded as Dispatch: line)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec allocated by PM: specs/123-kimi-model-tier (checked vs origin/main + open branches; 122 held by INF-9). Owner: Ops Engineer. Paperclip: INF-11 child.
<!-- SECTION:NOTES:END -->
