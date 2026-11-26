---
id: decision-0031
title: D23 Dispatch evidence for non-Claude agents (INF-8)
date: '2026-11-26T20:35:06Z'
status: accepted
---
## Context

<!-- SECTION:CONTEXT:BEGIN -->
Gates must work for non-Claude harnesses (INF-8, TASK-0359). Dispatch: line semantics must be defined for them.
<!-- SECTION:CONTEXT:END -->

## Decision

<!-- SECTION:DECISION:BEGIN -->
Dispatch line format is unchanged for every harness: `Dispatch: tier=<t> pinned=<id> served=<id>`.
- For non-Claude harnesses, `pinned=` is the exact model ID configured on the Paperclip agent or connection.
- `served=` is the `model` field from the Paperclip run receipt, or from the provider response when the receipt lacks one.
- Both IDs keep any router route prefix verbatim (e.g. `if/kimi-k2-…`, `cc/…`). Never strip, alias or infer them.
- `tier=` is a key in `.claude/model-tiers.json`. Non-Claude models get their own tier entries, such as `kimi`, added by PR, and `tiers.mjs --check` must validate them.
— CTO, INF-8
<!-- SECTION:DECISION:END -->

## Consequences

<!-- SECTION:CONSEQUENCES:BEGIN -->
Ruling quoted verbatim from the CTO on INF-9.
<!-- SECTION:CONSEQUENCES:END -->
