---
name: pr-merge-order-follows-green
description: "The operator merges sweep PRs as they turn green, not in runbook lane order; plan one reconcile merge per late PR."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7bc214b1-094e-4686-abdf-fc65c6cc777c
  modified: 2026-09-29T09:49:13.537Z
---

In this repo the operator merges PRs, and merges each one when it is green. The
orchestrator cannot merge its own PRs (the permission classifier blocks it). So a runbook's
planned merge order is a preference, not a guarantee.

**Why:** M1 wave 1 (2026-09-29) planned "TASK-0020 merges first". #21 (TASK-0023) went
green and merged first instead, with CI red on main, then #22 and #23. TASK-0020 needed
two extra reconcile merges and lost six spec ticks in one of them.

**How to apply:** when a merge order matters (a hard dependency), hold the dependent PR
as a draft until its prerequisite merges; say so in the ping. Otherwise open PRs as they
go green and budget one `git merge origin/main` + full re-gate per PR that lands after a
sibling. After each merge, re-check the spec's tasks.md ticks. Never report a PR ready
while main's CI is red. Upstream card: praxisflux TASK-0136 (pdlc:sweep step 8).
Related: [[spec-authoring-dispatch-tier]], [[board-track-conflicts-with-branch-card]].
