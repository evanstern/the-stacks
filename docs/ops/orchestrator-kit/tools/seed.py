#!/usr/bin/env python3
# usage: seed.py <worktree> <TASK-id> <specDir> [dispatch-note ...]
# Adds missing "Spec phase: <name>" ACs from the bridge's state, then appends each dispatch note.
import json, os, subprocess, sys

wt, tid, spec = sys.argv[1:4]
notes = sys.argv[4:]
cli = os.path.expanduser("~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs")
state = json.loads(subprocess.check_output(["node", cli, "state", spec], cwd=wt))
view = subprocess.check_output(["backlog", "task", "view", tid, "--plain"], cwd=wt, text=True)
args = []
for p in state["phases"]:
    ac = f"Spec phase: {p['name']}"
    if ac not in view:
        args += ["--ac", ac]
for n in notes:
    args += ["--append-notes", n]
if args:
    subprocess.run(["backlog", "task", "edit", tid, *args, "--plain"], cwd=wt, check=True, stdout=subprocess.DEVNULL)
print(f"{tid}: {len(state['phases'])} phases; added {args.count('--ac')} ACs, {len(notes)} notes")
