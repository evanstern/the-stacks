# The Stacks

> A DB-backed context library with curated provenance, vector retrieval,
> lexical search, graph/PPR reranking, and context-pack compilation.

**Status:** re-chartered 2026-05-29, design contract updating before new code
**Owner:** Annie (orchestrator)
**Architect:** Zach
**Repo:** `evanstern/the-stacks`

---

## Why this exists

Agents do not need bigger piles of text. They need a way to assemble the right
context for a task, with provenance and enough structure to know why those
pieces belong together.

Plain vector RAG is useful but structureless. Lexical search is inspectable but
literal. A graph captures adjacency and influence but does not know semantic
similarity by itself. Curated wiki pages and approval manifests add judgment,
but hand curation alone does not scale.

The Stacks combines those signals into a local-first context library. Curation
decides what enters the collection. The database stores pages, chunks,
provenance, vectors, and graph edges. Retrieval blends vector, lexical, and
graph/PPR signals. Context packs turn ranked evidence into a compact, cited
bundle an agent or human can actually use.

The old May 5 design framed v0 as wiki over vanilla vector RAG, with no hybrid
retrieval in v0. That line is dead. Nice funeral. Small turnout.

## Goals

1. **Demonstrate context assembly.** Build a working CLI/backend over a public,
   reviewable corpus.
2. **Preserve provenance.** Every page and chunk should trace back to an
   approved source and extraction decision.
3. **Use multiple retrieval signals.** Vector, lexical, and graph/PPR are all
   first-class in v0.
4. **Produce context packs.** The product surface is not just top-k search; it is
   a cited pack of selected context for a concrete task.
5. **Stay local-first.** One Go binary plus sqlite-backed runtime state. Cloud is
   optional distribution or demo hosting, not the core architecture.
6. **Mount later.** MCP comes after the CLI/backend workflow proves useful.

## Non-goals

- Multi-user / multi-tenant service architecture.
- Cloud-first storage or retrieval.
- Treating Zach's flat-file experiment as the runtime storage model.
- Replacing vectors with graph search. Vectors are required.
- Keeping the old "no reranker / no hybrid search in v0" constraint.

## Demo corpus

The likely public demo corpus is Zach's official-tabletop D&D Wikipedia-derived
slice, starting with the approved Forgotten Realms corpus.

Evidence from the experiment:

- Candidate extraction scanned 5,000,001 index rows and produced 229 reviewable
  candidates.
- Manual policy approved 76 official/WotC/tabletop D&D pages and rejected or
  deferred the rest.
- Page extraction produced 76 local JSON pages with source URL, page id,
  revision id, timestamp, categories, links, and article text.
- Chunk indexing produced 236 heading-aware chunks.
- Lexical baseline produced useful transparent results, with known weaknesses.
- Graph/PPR hybrid produced an inspectable reranking signal over 337 nodes and
  1,672 edges.
- Section filtering removed obvious media/meta leakage without hard-deleting
  useful official-tabletop context.
- Context-pack generation produced Markdown and JSON for a Waterdeep faction
  intrigue task, proving the shape while exposing corpus expansion needs.

This corpus is not locked forever. It is the current best public demo because it
has provenance, graph structure, and a context-pack story people understand.

## Architecture

### V0.1 - Corpus Ingestion And Approval

Build the intake path for a public corpus.

- Discover candidate pages from a source index without scanning full bodies
  blindly.
- Apply an explicit approval policy and preserve approved, deferred, and rejected
  decisions for audit.
- Extract approved pages into normalized records with source URL, page id,
  revision id, timestamp, categories, links, and local text.
- Store pages and provenance in sqlite. Flat JSON/JSONL may remain as import,
  export, or debugging artifacts, not runtime storage.

**Done when:** `the-stacks ingest` can build a local sqlite corpus from an
approved manifest and report page/provenance counts.

### V0.2 - Chunk DB, Vectors, And Lexical Baseline

Build the retrieval substrate.

- Split pages into heading-aware chunks, falling back to paragraph windows only
  for oversized sections.
- Store chunks, metadata, and chunk/page relationships in sqlite.
- Embed chunks and store vectors in sqlite-vec or an equivalent sqlite-local
  vector table.
- Implement transparent lexical scoring over titles, categories, headings,
  approved links, and body text.
- Keep scoring inspectable; this is a baseline to beat, not a magic box.

**Done when:** `the-stacks search` can show lexical results, vector results, and
their source chunks over the demo corpus.

### V0.3 - Graph/PPR Hybrid Retrieval

Add graph structure as a retrieval signal.

- Derive graph nodes for pages, chunks, and categories.
- Derive edges from page/chunk containment, approved page links, chunk links to
  approved pages, and category relationships.
- Seed PPR from high-confidence lexical/vector hits.
- Blend scores as inspectable components, not a hidden ranking soup.
- Downrank known boundary-leak sections such as `Reception`, `Film`, `External
  links`, and similar meta/media headings under the official-tabletop boundary.

**Done when:** `the-stacks search --mode hybrid` reports lexical, vector, and
graph components and improves at least one tracked query without burying direct
entity hits.

### V0.4 - Context Pack Compiler

Turn retrieval into a product surface.

- Rank pages first when the task benefits from page-level coherence.
- Select a small number of chunks per page.
- Emit Markdown and JSON context packs with local chunk ids, source citations,
  and selection rationale.
- Make the pack readable enough to hand to an agent as task context.

**Done when:** `the-stacks context-pack "Waterdeep faction intrigue"` produces a
cited Markdown/JSON pack from the demo corpus, with enough supporting context to
be useful and enough gaps documented to guide corpus expansion.

### Later - MCP

MCP is still part of the project, but not the first milestone. First prove the
CLI/backend loop: ingest, approve, chunk, vectorize, search, rerank, compile.
Then mount it into coda-lite as a memory/context surface.

**Done when:** Annie can mount `the-stacks mcp serve`, query her own corpus, and
use a context pack in a real session.

## Storage model

Runtime state belongs in sqlite:

- `pages` - normalized approved source pages.
- `provenance` - source URLs, page ids, revision ids, timestamps, approval state.
- `chunks` - heading-aware chunk text and metadata.
- `chunk_vectors` - vector table keyed to chunks.
- `graph_nodes` and `graph_edges` - local graph for PPR.
- `retrieval_runs` / `context_packs` - optional audit trail for generated packs.

Files are still useful at the edges: manifests, exports, debug dumps, release
artifacts, and human-readable context packs. They are not the runtime database.

## Conventions

- **Single Go binary.** Keep the shape close to coda-lite and focus.
- **Local-first sqlite.** No daemon required for local mode.
- **Explicit corpus paths.** No pwd magic. `the-stacks --db <path> ...`.
- **Public demo corpus.** Annie's private corpus is later dogfood, not the README
  demo.
- **Context packs first-class.** Search is a component; packs are the surface.
- **Design before code.** Zach's handoff explicitly says not to start
  implementation until this contract is updated.

## References

- Zach decision: `/home/coda/agents/zach/wiki/decisions/the-stacks-memory-graph-graduation.md`
- Zach handoff: `/home/coda/agents/zach/reports/annie-the-stacks-memory-graph-handoff.md`
- Experiment logs: `/home/coda/agents/zach/experiments/dnd-memory-graph/results/`
- NAS artifacts: `/mnt/jace_coda/dnd-memory-graph/`
- coda-lite: `evanstern/coda-lite`
- focus: `evanstern/focus`
