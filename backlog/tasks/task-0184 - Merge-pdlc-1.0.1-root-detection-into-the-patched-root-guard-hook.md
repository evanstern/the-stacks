---
id: TASK-0184
title: Merge pdlc 1.0.1 root detection into the patched root-guard hook
status: In Progress
assignee: []
created_date: '2026-10-30 04:46'
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
- [ ] #1 The hook matches pdlc 1.0.1 except the TASK-0018 -z staged-path change
- [ ] #2 A commit in a linked worktree passes when CLAUDE_PROJECT_DIR names that worktree
- [ ] #3 A non-board commit at the root checkout is still blocked
- [ ] #4 A board-sync commit with a non-ASCII backlog path is still allowed
- [ ] #5 node --test .claude/hooks/ passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
