---
name: root-guard-literal-worktree-path
description: root-guard judges git commit by the root checkout unless the commit command names the worktree with a literal path.
metadata:
  node_type: memory
  type: feedback
  originSessionId: 739445a6-bb7e-46bd-ad2c-54627ef224d5
  modified: 2026-09-29T18:40:09.882Z
---

A `git commit` issued as `git -C $W commit` (path in a shell variable) or after a `cd` inside a chained command was blocked by root-guard. The hook read the commit as a root commit with nothing staged (2026-09-29).

**Why:** The hook parses the command text before it runs. It cannot resolve variables or `cd` state.

**How to apply:** Commit in its own Bash call as `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-<n> commit ...` with the literal path. Stage in a separate call, as in [[root-guard-staging-timing]].
