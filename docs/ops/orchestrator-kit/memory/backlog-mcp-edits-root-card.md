---
name: backlog-mcp-edits-root-card
description: "The backlog MCP tools always edit the ROOT checkout's card copy, never a worktree branch's copy — use the backlog CLI inside the worktree for branch cards."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7bc214b1-094e-4686-abdf-fc65c6cc777c
  modified: 2026-09-29T09:39:29.536Z
---

The `mcp__backlog__*` tools resolve the project from the session's launch directory, so
they write the root checkout's `backlog/tasks/*.md` even while you are working in a
worktree. The backlog CLI run inside a worktree edits that branch's copy.

**Why:** in the M1 wave-1 sweep (2026-09-28), an MCP edit amended TASK-0023's root card
while the branch card (which held the claim and phase ACs) stayed stale. A TASK-0020
implementer used the MCP tool and left two unpushed commits on root.

**How to apply:** for any card on a claimed task branch, run `backlog task edit` from the
worktree. Tell every implementer dispatch: "Do NOT use the backlog MCP tools; do not edit
the card." Related: [[board-track-conflicts-with-branch-card]], [[backlog-reset-desyncs-card]].
