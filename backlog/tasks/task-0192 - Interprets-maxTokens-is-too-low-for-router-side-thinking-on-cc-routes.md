---
id: TASK-0192
title: Interpret's maxTokens is too low for router-side thinking on cc/ routes
status: In Progress
assignee: []
created_date: '2026-11-02 04:27'
updated_date: '2026-11-02 06:39'
labels:
  - dm
  - ai
  - ops
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the default and documented dm.* maxTokens leave room for hidden thinking on cc/ routes, so a hard turn never fails because thinking spent the whole output budget.

Why: alpha run 3 (2026-11-02). dm.interpret at maxTokens 1200 failed 8 times in combat, each call returning exactly 1200 output tokens and no JSON (TASK-0181 AC #1 cause). Raising vm-104's dm.interpret to 4000 fixed it at once. .env.example suggests 800 for interpret, 600 director, 500 narrate, which would fail the same way. The same risk applies to every dm.* purpose behind 9router.

Scope: review each dm.* purpose's maxTokens against observed output plus thinking headroom; update .env.example and docs/ops/dev-vm-104.md; decide whether the gateway should log a distinct error when output equals maxTokens (truncation) instead of invalid-json.

References: docs/playtests (run 3 log), TASK-0181.

Spec: specs/067-dm-maxtokens-headroom
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .env.example and the vm-104 runbook give dm.* maxTokens values with thinking headroom, with the reason stated
- [ ] #2 A DM call whose output hits maxTokens is recorded as truncated, distinct from invalid-json, in the calls ledger
- [ ] #3 A test covers the truncation outcome with the fake gateway
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0192, branch task-0192-dm-maxtokens-headroom, cut from origin/main 7e252840. Spec number 067 claimed with a stub. Lane A1.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Operator ruling 2026-11-02 (in chat, answering 'How should the remaining lanes get write access to .worktrees/?'): "Allow edits via Bash". The harness edit guard blocks Write/Edit outside the session worktree; dispatched agents edit worktree files through Bash (heredocs, sed, scripts) instead.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 067 authoring, C1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 067 phase 1, d793ccff)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
