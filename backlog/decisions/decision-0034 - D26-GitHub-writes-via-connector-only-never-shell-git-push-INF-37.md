---
id: decision-0034
title: D26 GitHub writes via connector only, never shell git push (INF-37)
date: '2026-11-27T09:49:37Z'
status: accepted
---
## Context

<!-- SECTION:CONTEXT:BEGIN -->
Evan ruled on INF-37 that agents must not shell out to git push / gh for GitHub writes.
<!-- SECTION:CONTEXT:END -->

## Decision

<!-- SECTION:DECISION:BEGIN -->
Push and open PRs only through the Paperclip GitHub connector tools (push-files, create-or-update-file, delete-file, create-branch, create-pull-request, update-pull-request, merge-pull-request). Covers pushing commits incl. board bookkeeping to main, branches, PRs, PR replies, merges. Local git OK for status/diff/log/local commits/worktrees. Never git push in any form; never gh CLI or raw API for writes. If the connector lacks access, request via connections_search/connection_request and block; never fall back to shell. Sub-agent dispatch briefs must carry the rule.
— Source: Evan (INF-37). Approver: CTO.
<!-- SECTION:DECISION:END -->

## Consequences

<!-- SECTION:CONSEQUENCES:BEGIN -->
Rule added to AGENTS.md (INF-38) and as rule 13 in every agent's Paperclip instructions.
<!-- SECTION:CONSEQUENCES:END -->
