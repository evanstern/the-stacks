#!/bin/bash
# usage: claim.sh <TASK-id> <branch-slug> <spec NNN-slug or -> <title> <note>
# Run from repo root. Cuts the worktree, flips the card, writes stub + marker. Commit separately.
set -e
root=/Users/evanstern/projects/the-stacks
tid=$1; slug=$2; spec=$3; title=$4; note=$5
num=$(echo "$tid" | cut -d- -f2)
wt=$root/.worktrees/task-$num
br=task-$num-$slug
base=$(git -C "$root" rev-parse --short origin/main)
git -C "$root" worktree add -q "$wt" -b "$br" origin/main
specnote="No spec dir: signed escape line covers this task."
[ "$spec" != "-" ] && specnote="Spec number ${spec%%-*} claimed with a stub."
(cd "$wt" && backlog task edit "$tid" -s "In Progress" --append-notes "Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-$num, branch $br, cut from origin/main $base. $specnote $note" --plain >/dev/null)
if [ "$spec" != "-" ]; then
  python3 /private/tmp/claude-501/-Users-evanstern-projects-the-stacks/05e444ca-72b0-4a28-837a-bc40357b48cd/scratchpad/link.py "$wt" "$tid" "$spec" "$title"
fi
git -C "$wt" status --short
git -C "$wt" log --oneline -3
