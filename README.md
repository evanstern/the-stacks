# The Stacks

> A local-first context library: curated provenance, DB-backed chunks, vector
> retrieval, lexical search, graph/PPR reranking, and context-pack compilation.

**Status:** re-chartered. Design contract updated before the next implementation
slice.

## Why

Agents do not need a larger haystack. They need the right context bundle for the
job, with citations and enough structure to explain why each piece is there.

The Stacks is that bundle-maker. It stores approved public corpus pages and
chunks in sqlite, indexes them with vectors and transparent lexical scoring,
uses graph/PPR to rerank and expand around related material, then emits cited
context packs an agent or human can use.

The original May 5 roadmap was wiki-over-vanilla-RAG. The current direction is
sharper: DB-backed context library with vectors, lexical search, graph-ranked
retrieval, and context packs in v0. MCP comes after the CLI/backend loop proves
useful.

## Stack

- **Language:** Go, single binary.
- **Storage:** sqlite for pages, chunks, provenance, graph edges, and runtime
  state.
- **Vectors:** sqlite-local vector index, likely sqlite-vec.
- **Retrieval:** vector search, lexical baseline, graph/PPR hybrid rerank.
- **Output:** Markdown and JSON context packs.
- **Demo corpus:** likely official-tabletop D&D Wikipedia-derived pages from the
  graduated memory-graph experiment.

Local-first. DB-backed. No daemon in the local path.

## Roadmap

| Milestone | Shape | Done when |
|-----------|-------|-----------|
| V0.1 | Corpus ingestion + approval/provenance | approved public corpus pages land in sqlite with audit trail |
| V0.2 | Chunk DB + vectors + lexical baseline | chunks are searchable by vector and inspectable lexical scores |
| V0.3 | Graph/PPR hybrid retrieval | graph signal reranks/expands results with visible score components |
| V0.4 | Context pack compiler | Markdown/JSON packs cite selected chunks for a concrete task |
| Later | coda-lite MCP | agents mount the proven CLI/backend as a memory/context surface |

Full design: [`designs/the-stacks.md`](designs/the-stacks.md).

## Non-goals

- Multi-user / multi-tenant service architecture.
- Cloud-first retrieval or storage.
- Treating Zach's flat-file experiment as runtime storage.
- Replacing vectors with graph search. Vectors are required.
- Preserving the old "no hybrid search in v0" rule. That rule is dead.

## Status board

Project work is tracked with [focus](https://github.com/evanstern/focus) in
[`.focus/`](.focus/). The old Polymarket/vanilla-RAG cards have been archived;
the board now tracks the memory-graph direction.

## License

MIT. See [LICENSE](LICENSE).
