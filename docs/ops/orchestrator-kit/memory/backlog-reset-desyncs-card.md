---
name: backlog-reset-desyncs-card
description: "git reset --hard in the root checkout silently reverts the board card, and later backlog CLI edits rewrite it from that stale base."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8622d6e9-02f8-4fe9-b36e-eeb08c0cbd16
  modified: 2026-09-23T04:20:29.506Z
---

`backlog` (auto_commit: true) reads and rewrites the task card from whatever the
**root checkout** currently holds. So after `git reset --hard` in root — e.g. to
fold claim auto-commits onto a task branch — the root card is reverted, and any
later `backlog task edit` rewrites it from that stale base.

Result: the branch card keeps the claim state (Spec: marker, phase ACs,
In Progress) while the root card keeps only the newer notes. Each half looks
fine on its own; neither is complete.

**Why:** hit on 2026-09-23 claiming TASK-0016. The reset was correct (the claim
belongs on the branch, per the project's "claim flip is deliverable state" rule),
but it left the root card missing its marker and all 6 phase ACs while
`--append-notes` kept appending Dispatch lines to the reverted file.

**How to apply:** after any `reset --hard`/`checkout` that touches `backlog/` in
root, restore the card from the branch before running further CLI edits:
`git show <branch>:"<card path>" > "<card path>"`, then re-apply notes through
the CLI so metadata stays consistent. Verify with
`grep -cE '^Spec:|Spec phase|^Dispatch:'` and the spec-bridge `check` gate —
the gate reads the ROOT checkout, so a green gate there is the real signal.
Related: [[root-guard-staging-timing]], [[backlog-ghost-tasks-stale-remote]].
