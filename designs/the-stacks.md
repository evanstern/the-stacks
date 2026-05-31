# ikis.ai

> A single-user, self-hosted React Router 7 corpus workspace with SQLite or
> libSQL as the canonical store, grounded conversation, and cited context packs.

**Status:** re-chartered 2026-05-29.
**Owner:** Annie (orchestrator)
**Architect:** Zach
**Repo:** `evanstern/the-stacks`
**Internal codename:** The Stacks
**Possible later subdomain:** `thestacks.ikis.ai`

---

## Why this exists

ikis.ai exists to help a single owner work with a curated corpus in a way
that stays grounded in evidence. The workspace should be able to ingest source
material, preserve provenance, search and browse it, and answer questions using
citations rather than ungrounded guesses.

The application boundary is a React Router 7 app that can be self-hosted by the
owner. SQLite or libSQL is the canonical store for corpus records, chunks,
provenance, retrieval state, and context-pack history. That makes the database
the source of truth, not flat files or transient process memory.

The public project name is `ikis.ai`. The Stacks remains the internal codebase,
repository lineage, and a natural label for a later `thestacks.ikis.ai` surface
if the workspace ships under a subdomain.

Conversation is part of the product, but it must remain grounded. The workspace
should surface evidence, selection rationale, and explicit gaps when the corpus
cannot fully support an answer.

The old Go CLI framing is not the target architecture. The #19 Go importer stays
in the story only as parity and historical reference for ingest behavior and
record fidelity.

## Goals

1. **Demonstrate a grounded workspace.** Build a self-hosted app that can ingest
   a corpus, browse it, search it, and answer with cited evidence.
2. **Preserve provenance.** Every page, chunk, and generated pack should trace
   back to an approved source and extraction decision.
3. **Keep SQLite or libSQL canonical.** Runtime truth lives in the database, not
   in flat files or ephemeral memory.
4. **Keep conversation grounded.** Answers should stay tied to corpus evidence
   and say when the corpus is incomplete instead of pretending certainty.
5. **Produce context packs.** The product surface is not just search; it is a
   cited pack of selected context for a concrete task.
6. **Preserve importer parity.** The #19 Go importer remains the reference for
   load behavior and record fidelity.
7. **Keep format boundaries explicit.** EPUB and MOBI can be part of corpus
   intake or export, while LangGraph stays out of the core architecture contract.

## Non-goals

- Multi-user / multi-tenant service architecture.
- Cloud-first storage or retrieval.
- Treating Zach's flat-file experiment as the runtime storage model.
- Replacing vectors with graph search alone.
- Recasting the #19 Go importer as the primary runtime architecture.

## Demo corpus

The likely public demo corpus is Zach's official-tabletop D&D Wikipedia-derived
slice, starting with the approved Forgotten Realms corpus. That corpus is still
useful as a reference set, but the product charter is broader than a single demo
topic.

## Architecture

### V0.1 - Corpus ingestion and approval

Build the intake path for a public corpus.

- Discover candidate pages from a source index without scanning full bodies
  blindly.
- Apply an explicit approval policy and preserve approved, deferred, and
  rejected decisions for audit.
- Extract approved pages into normalized records with source URL, page id,
  revision id, timestamp, categories, links, and local text.
- Store pages and provenance in SQLite or libSQL. Flat JSON or JSONL may remain
  as import, export, or debugging artifacts, not runtime storage.

**Done when:** the workspace can build a local SQLite or libSQL corpus from an
approved manifest and report page/provenance counts.

### V0.2 - Chunk DB, vectors, and lexical baseline

Build the retrieval substrate.

- Split pages into heading-aware chunks, falling back to paragraph windows only
  for oversized sections.
- Store chunks, metadata, and chunk/page relationships in SQLite or libSQL.
- Embed chunks and store vectors in a SQLite-local vector table.
- Implement transparent lexical scoring over titles, categories, headings,
  approved links, and body text.
- Keep scoring inspectable; this is a baseline to beat, not a magic box.

**Done when:** the workspace can show lexical results, vector results, and their
source chunks over the demo corpus.

### V0.3 - Graph/PPR hybrid retrieval

Add graph structure as a retrieval signal.

- Derive graph nodes for pages, chunks, and categories.
- Derive edges from page/chunk containment, approved page links, chunk links to
  approved pages, and category relationships.
- Seed PPR from high-confidence lexical/vector hits.
- Blend scores as inspectable components, not a hidden ranking soup.
- Downrank known boundary-leak sections such as `Reception`, `Film`, `External
  links`, and similar meta/media headings under the official-tabletop boundary.

**Done when:** hybrid retrieval reports lexical, vector, and graph components
and improves at least one tracked query without burying direct entity hits.

### V0.4 - Context pack compiler

Turn retrieval into a product surface.

- Rank pages first when the task benefits from page-level coherence.
- Select a small number of chunks per page.
- Emit Markdown and JSON context packs with local chunk ids, source citations,
  and selection rationale.
- Make the pack readable enough to hand to an agent as task context.

**Done when:** a context-pack command produces a cited Markdown/JSON pack from
the demo corpus, with enough supporting context to be useful and enough gaps
documented to guide corpus expansion.

### Later - MCP or similar mounting surface

First prove the workspace loop: ingest, approve, chunk, vectorize, search,
ground conversation, rerank, and compile. Then mount it into coda-lite or a
similar host surface as a memory and context workspace.

**Done when:** Annie can mount the workspace, query her own corpus, and use a
context pack in a real session.

## Storage model

Runtime state belongs in SQLite or libSQL:

- `pages` - normalized approved source pages.
- `provenance` - source URLs, page ids, revision ids, timestamps, approval state.
- `chunks` - heading-aware chunk text and metadata.
- `chunk_vectors` - vector table keyed to chunks.
- `graph_nodes` and `graph_edges` - local graph for PPR.
- `retrieval_runs` / `context_packs` - audit trail for generated packs.

Files are still useful at the edges: manifests, exports, debug dumps, release
artifacts, and human-readable context packs. They are not the runtime database.

## Conventions

- **React Router 7 app.** Keep route structure explicit and hostable.
- **Local-first, self-hosted.** No shared SaaS dependency is required for the
  core loop.
- **Canonical database.** SQLite or libSQL is the source of truth for runtime
  state.
- **Grounded answers.** Conversation must stay tied to source evidence.
- **Importer parity.** The #19 Go importer remains the historical reference for
  corpus loading behavior and fidelity checks.
- **Design before code.** Zach's handoff explicitly says not to start
  implementation until this contract is updated.

## References

- Zach decision: `/home/coda/agents/zach/wiki/decisions/the-stacks-memory-graph-graduation.md`
- Zach handoff: `/home/coda/agents/zach/reports/annie-the-stacks-memory-graph-handoff.md`
- Experiment logs: `/home/coda/agents/zach/experiments/dnd-memory-graph/results/`
- NAS artifacts: `/mnt/jace_coda/dnd-memory-graph/`
- #19 importer parity reference: historical ingest behavior and record fidelity
- coda-lite: `evanstern/coda-lite`
- focus: `evanstern/focus`
