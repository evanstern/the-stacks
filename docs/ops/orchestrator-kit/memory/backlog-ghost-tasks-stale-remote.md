---
name: backlog-ghost-tasks-stale-remote
description: Ghost/duplicate tasks on the-stacks board mean origin is behind — Backlog loads tasks from remote branches, so push to clear them.
metadata:
  type: project
---

In the-stacks, deleted or renamed tasks keep appearing on the Backlog board even
when the local working tree is correct. The cause is almost always that `origin`
is behind, not anything wrong on disk.

**Why:** `backlog/config.yml` sets `remote_operations: true` and
`check_active_branches: true`, so the board unions tasks found on remote branches
with local ones. `backlog board` prints this plainly — "Loading tasks from local
and remote branches", "Found N unique tasks across remote branches". A stale
`origin/main` therefore resurrects every task file it still holds.

**How to apply:** when ghosts appear, do not hunt for stray files or clear the
archive. Compare the branches first:

    git ls-tree --name-only origin/main backlog/tasks/
    git rev-list --count origin/main..main

If origin still holds the old files, pushing the board commits to main is the fix (via the GitHub connector `push-files` / `create-or-update-file`, never shell `git push` — D26). Note that
`backlog task list` reads only the working tree, so it shows the board as clean
while `backlog board` still shows ghosts — diagnose with `backlog board`.

Related: [[root-guard-staging-timing]].
