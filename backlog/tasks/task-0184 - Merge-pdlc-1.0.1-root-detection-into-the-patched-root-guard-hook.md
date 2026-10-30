---
id: TASK-0184
title: Merge pdlc 1.0.1 root detection into the patched root-guard hook
status: In Progress
assignee: []
created_date: '2026-10-30 04:46'
updated_date: '2026-10-30 04:50'
labels:
  - tooling
  - bug
dependencies: []
priority: medium
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pdlc 1.0.1 fixed root-guard root detection: resolveMainCheckout() derives the main checkout from git rev-parse --git-common-dir instead of CLAUDE_PROJECT_DIR, so a session opened on a linked worktree is no longer treated as root. plant.mjs copies the hook only when missing, so the 1.0.1 re-plant (PR #93) left our copy in place. Our copy carries the TASK-0018 -z NUL-split fix that upstream lacks. Rebase the hook on 1.0.1 and re-apply the TASK-0018 fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hook matches pdlc 1.0.1 except the TASK-0018 -z staged-path change
- [x] #2 A commit in a linked worktree passes when CLAUDE_PROJECT_DIR names that worktree
- [x] #3 A non-board commit at the root checkout is still blocked
- [x] #4 A board-sync commit with a non-ASCII backlog path is still allowed
- [x] #5 node --test .claude/hooks/ passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-30: dispatch 1 to sonnet-implementer failed with model_not_found. The dispatch parameter model=sonnet resolved to bare claude-sonnet-5-5, which 9router rejects. Nothing was written. Dispatch 2, with no model parameter so the frontmatter cc/ pin applies, was denied by the auto-mode permission classifier. Waiting on the operator.

2026-10-30: the operator approved the sonnet-implementer dispatch in chat. The retry, with no model parameter, was again denied by the auto-mode classifier.

2026-10-30: Operator checkpoint (recorded before work): the operator said 'do TASK-0184 inline in this session' after the auto-mode classifier denied the dispatches. Implemented inline by the orchestrator session (cc/claude-opus-5-5); no implementer dispatch.

Hook = pdlc 1.0.1 plus the TASK-0018 -z hunk; diff vs origin/main shows only upstream changes. Added 3 linked-worktree spawn tests: 2 fail on the old hook, all 23 hook tests pass on the merged one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebased .claude/hooks/root-guard-hook.mjs on pdlc 1.0.1 (resolveMainCheckout derives root from git --git-common-dir) and kept the TASK-0018 -z NUL-split staged-path fix. Added regression tests for linked-worktree root detection. Implemented inline under a recorded operator checkpoint.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
