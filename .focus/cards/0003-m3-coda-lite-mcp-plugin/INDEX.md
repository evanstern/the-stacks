---
schema_version: 2
id: 3
uuid: 019df5c3-90c2-7e02-9883-08dd10c55bf0
title: 'M3: coda-lite MCP plugin'
type: epic
status: archived
priority: p2
project: the-stacks
created: 2026-05-05
---

# M3: coda-lite MCP plugin

The differentiator. The Stacks ships an MCP server. Coda-lite
agents mount it as their memory layer. Annie eats first; zach
mounts it once stable.

**Blocked by:** M2 (#2)

## Done when

- `the-stacks mcp serve` works (JSON-RPC over stdio)
- Tools exposed: `stacks_ask`, `stacks_ingest`,
  `stacks_wiki_promote`, `stacks_wiki_read`
- Annie's `opencode.json` adds the-stacks MCP block pointing at
  her own corpus (her wiki/, memory/, learnings/, dreams/)
- Annie boots, queries her own memory through the MCP, drills
  into a curated wiki page with a working scoped retrieval
- Dogfood evidence in memory: at least one session where the
  MCP was used to answer a real question

## Context

See `designs/the-stacks.md` (M3 section). MCP idiom matches
coda-lite — same Go SDK, same JSON-RPC over stdio, same
opencode.json wiring pattern. Should feel native if you've
read coda-lite's MCP source.

Once M3 is stable, propose to zach that he mount the-stacks
MCP for his own corpus. That's the second dogfood signal —
the architect using it on his own memory is the strongest
endorsement.
