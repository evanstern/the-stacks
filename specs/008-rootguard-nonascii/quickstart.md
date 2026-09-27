# Quickstart: validate spec 008

## 1. Regression suite

    node --test .claude/hooks/

Expected: all tests pass, including the non-ASCII allowed and blocked cases.

## 2. Real-commit proof at the root checkout (card DoD #3)

Run from the task worktree, pointing the BRANCH's hook at the ROOT checkout. `ROOT` is
the repository root; `HOOK` is this branch's hook file.

1. At `ROOT`, create and stage an untracked board file with a non-ASCII name, e.g.
   `backlog/docs/tmp-é.md`. Stage it in its own Bash call.
2. Pipe a pre-bash payload to the hook:

       printf '%s' '{"tool_input":{"command":"git commit -m x"},"cwd":"'"$ROOT"'"}' \
         | CLAUDE_PROJECT_DIR="$ROOT" node "$HOOK" pre-bash; echo "exit=$?"

   Expected: `exit=0`.
3. Also stage an untracked `tmp-é.txt` at `ROOT`, re-run step 2. Expected: `exit=2`,
   stderr naming `tmp-é.txt` verbatim.
4. Run the same step 2 against `main`'s hook first to confirm it exits 2 (the bug).
5. Unstage and delete both files: `git -C "$ROOT" reset -q -- <paths>`, then remove
   them. Confirm `git -C "$ROOT" status --short` shows no leftovers.

Paste the four exit codes into the PR body.

## 3. Real commit after merge (closes card DoD #3)

Section 2 replays the hook against the root's real index but commits nothing. Once this
branch merges, root runs the fixed hook, so make one genuine non-ASCII board commit:

1. Restore the milestone's original title, which the bug forced to ASCII:
   `backlog milestone rename "M0 - Skeleton" "M0 — Skeleton"` (confirm the current name
   with `backlog milestone list` first).
2. Stage the renamed `backlog/` files in one Bash call; `git commit` in the next.
3. Expected: the hook allows the commit. Record the commit hash on the TASK-0018 card.
