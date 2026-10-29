#!/usr/bin/env python3
# Creates the decision-0025 cards from docs/design/actor-state-gate.md §5.3 on root main.
import re, subprocess, sys

root = "/Users/evanstern/projects/the-stacks"
doc = subprocess.check_output(["git", "-C", root, "show", "origin/task-0135-actor-state-gate:docs/design/actor-state-gate.md"], text=True)
sec = doc.split("### 5.3 Cards to create", 1)[1].split("### 5.4", 1)[0]
blocks = re.split(r"\n\*\*(U\d)\. ", sec)[1:]
cards = {blocks[i]: blocks[i + 1] for i in range(0, len(blocks), 2)}

order = ["U1", "U2", "U8", "U3", "U4", "U5", "U7", "U9"]
prio = {"U1": "high", "U2": "high", "U8": "high", "U3": "high"}
ids = {}
ext = {"TASK-0109": "TASK-0109", "TASK-0110": "TASK-0110", "TASK-0127": "TASK-0127", "TASK-0128": "TASK-0128"}
for u in order:
    body = cards[u]
    title = body.split("**", 1)[0].strip()
    outcome = re.search(r"- Outcome: (.*?)\n- ", body, re.S).group(1)
    outcome = " ".join(outcome.split())
    acs = re.findall(r"\n  \d+\. (.*?)(?=\n  \d+\. |\n- )", body, re.S)
    acs = [" ".join(a.split()) for a in acs]
    deps_line = re.search(r"- Dependencies: (.*)", body).group(1)
    deps = [ids[d] for d in re.findall(r"U\d", deps_line) if d in ids]
    deps += [ext[t] for t in re.findall(r"TASK-\d{4}", deps_line) if t in ext]
    desc = (f"Outcome: {outcome}\n\nWhy: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card {u}). Dependencies as stated there: {deps_line}. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.")
    cmd = ["backlog", "task", "create", f"Actor-state gate: {title}", "-m", "m-3", "--priority", prio.get(u, "medium"),
           "-l", "dm,rules-gate", "-d", desc, "--plain"]
    for a in acs:
        cmd += ["--ac", a]
    for d in deps:
        cmd += ["--dep", d]
    out = subprocess.check_output(cmd, cwd=root, text=True)
    tid = re.search(r"Task (TASK-\d+)", out).group(1)
    ids[u] = tid
    print(u, tid, title, "deps:", deps)
