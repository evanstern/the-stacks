#!/usr/bin/env python3
# usage: link.py <worktree> <TASK-id> <NNN-slug> <title>
# Writes the spec stub and re-sets the card description with the Spec marker as its last line.
import glob, os, re, subprocess, sys

wt, tid, spec, title = sys.argv[1:5]
num = tid.split("-")[1].lower()
path = glob.glob(os.path.join(wt, "backlog/tasks", f"task-{num} - *.md"))[0]
text = open(path).read()
m = re.search(r"<!-- SECTION:DESCRIPTION:BEGIN -->\n(.*?)\n<!-- SECTION:DESCRIPTION:END -->", text, re.S)
desc = m.group(1).rstrip()
d = os.path.join(wt, "specs", spec)
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "spec.md"), "w") as f:
    f.write(f"# Spec stub: {title} ({tid})\n\nClaimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). The spec set is authored by an opus-implementer dispatch.\n")
marker = f"Spec: specs/{spec}"
if marker not in desc:
    desc = re.sub(r"\n*Spec: specs/\S+\s*$", "", desc) + "\n\n" + marker
    subprocess.run(["backlog", "task", "edit", tid, "-d", desc, "--plain"], cwd=wt, check=True, stdout=subprocess.DEVNULL)
print("ok", tid, spec)
