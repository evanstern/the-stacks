---
schema_version: 2
id: 2
uuid: 019df5c3-90b1-791f-b9fc-15ab8a531699
title: 'M2: Wiki as routing layer'
type: epic
status: backlog
priority: p2
project: the-stacks
created: 2026-05-05
---

# M2: Wiki as routing layer

The architectural opinion. Curated wiki pages declare retrieval
scope via frontmatter. Two-phase query: read the curated content,
drill into the scoped retrieval. Side-by-side demo proves the win.

**Blocked by:** M1 (#1)

## Done when

- Wiki frontmatter contract documented (topic, scope.tags,
  scope.paths)
- `the-stacks ask` consults wiki index, returns curated content +
  scoped retrieval when a wiki page matches
- Falls back to global retrieval when no page matches
- `the-stacks promote <chunk-id>` flow works (propose wiki page
  from observed retrieval)
- README has side-by-side demo: rag-only / wiki-only / hybrid,
  same question, three results
- Asciinema recording of the side-by-side

## Context

See `designs/the-stacks.md` (M2 section). The frontmatter shape
is sketched there as a starting point — refine as the first real
wiki page surfaces in dogfood. Children cards to be filed during
M1 close-out, when M1 has informed what M2 actually needs.
