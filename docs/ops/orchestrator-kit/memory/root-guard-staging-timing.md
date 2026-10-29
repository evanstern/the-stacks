---
name: root-guard-staging-timing
description: In the-stacks, stage board files in a separate Bash call before committing — root-guard inspects repo state before the command runs.
metadata:
  type: project
---

In the-stacks, the root-guard PreToolUse hook reads the staged set *before* the
Bash command executes. So `git add backlog/ && git commit ...` in one call is
always denied with "nothing is staged, so the commit cannot be verified as
board-sync" — at hook time the `git add` has not happened yet.

**Why:** the hook classifies the commit from live repo state at evaluation time,
not from the command's eventual effect.

**How to apply:** run `git add backlog/` as its own Bash call, then `git commit`
as a second call. This applies to every board-sync commit at the root checkout.

Related: the same hook also falsely denies staged paths containing non-ASCII
characters (git C-quotes them); that defect is carded as TASK-9 in the repo.
