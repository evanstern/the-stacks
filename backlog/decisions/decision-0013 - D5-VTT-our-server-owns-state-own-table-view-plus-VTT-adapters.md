---
id: decision-0013
title: 'D5 VTT: our server owns state; own table view plus VTT adapters'
date: '2026-10-25'
status: accepted
---
## Context

Vision said "own minimal VTT in-app", and A8 tied the PixiJS tabletop to the map pipeline.
On 2026-10-25 the session reviewed external VTTs (doc-0004; some items unverified):
Fantasy Grounds Unity is closed and sandboxed, realistic only as a prep/export target. Atlas
VTT is pre-1.0, AGPL, has no API and an undocumented map format; its appeal is Obsidian as a
management surface. Foundry VTT is the most integrable (document API, modules, sockets).
Owlbear Rodeo has a clean SDK for maps and tokens only. No VTT can hold authoritative state
for an AI DM.

## Decision

- **Our server owns state.** The session event log stays the only source of truth. Any VTT
  is a projection through an adapter (ports and adapters).
- **Own table view first:** build a minimal in-app table view (TASK-0047 is its first slice;
  maps arrive in M6).
- **Adapters later:** one live adapter, Foundry or Owlbear, chosen in M6. Fantasy Grounds and
  Atlas are export targets only.
- **Obsidian vault export:** export the codex as markdown with frontmatter (M6). This meets
  Atlas's appeal without integrating Atlas.
- **UVTT export stays.**

**Rationale.** An AI DM needs server-enforced hidden information, refusal before write and
a replayable log; no VTT offers those. Adapters let operators keep their favourite VTT
without giving it authority.

## Consequences

- Supersedes vision's "own minimal VTT in-app" line and the table part of architecture A8.
- Architecture gains a VTT ports-and-adapters section.
- M6 Maps and the Table View carries the table view, the first live adapter, UVTT export and
  the Obsidian vault export.
