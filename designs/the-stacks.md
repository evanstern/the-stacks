# The Stacks

> A hierarchical knowledge system where a hand-curated wiki indexes
> into a vector RAG store. The wiki is the librarian. RAG is the stacks.

**Status:** design locked, implementation pending
**Owner:** Annie (orchestrator)
**Architect:** Zach
**Repo:** `evanstern/the-stacks`

---

## Why this exists

Two complementary failure modes shape the design:

- **Wiki alone doesn't scale.** Hand-curated knowledge bases hit a
  ceiling around ~100 pages before the index becomes the problem.
  Past that, you're navigating navigation.
- **RAG alone is structureless.** Vector retrieval over an
  unstructured corpus returns plausible chunks with no editorial
  judgment. Every query starts from zero. The retriever has no
  opinion about what matters.

The Stacks combines them. The wiki is the **routing layer** — a
small, hand-curated set of pages with frontmatter declaring retrieval
scope. Each wiki page says: "here are the load-bearing facts about
this topic, and if you need to drill in, query these tags / this
directory / this corpus subset." RAG is the **deep store** —
retrieval scoped by what the wiki page declares.

This mirrors how good libraries work (Dewey decimal as routing,
stacks as storage), how Wikipedia works (curated article + retrievable
references), and how good codebases work (README + grep).

## Goals

1. **Demonstrate the pattern.** Working code that anyone can run.
2. **Be useful.** Not a toy. The Stacks should be the kind of thing
   you'd actually want to back an agent's memory with.
3. **Be operable.** Single binary, file-backed, no daemons, no
   external services required for the local mode.
4. **Plug into coda-lite.** Ship as an MCP server so any coda-lite
   agent can mount it as a memory surface.

## Non-goals

- Multi-user / multi-tenant. Single-host, single-user, like coda-lite.
- Cloud-first. Local-first; cloud is opt-in.
- Schema-heavy frontmatter. The contract should be tight, not chatty.
- Reranker pipelines, query expansion, hybrid search. Not in v0.
  Vanilla cosine similarity over chunks. We add complexity only if
  retrieval quality demonstrably needs it.

## Architecture

Three layers, three milestones.

### M1 — RAG that works

The boring foundation.

- **Ingest:** walk a corpus directory, chunk markdown into
  ~500-token windows with ~50-token overlap, embed each chunk,
  store in sqlite-vec.
- **Embedding:** `nomic-embed-text` via Ollama (local, free).
  Pluggable later.
- **Storage:** sqlite-vec (`stacks.db`). One table for chunks
  (id, doc_path, chunk_idx, text, embedding). One table for docs
  (path, mtime, hash). Re-embed on hash change.
- **Query:** `the-stacks ask "..."` returns top-k chunks with
  scores and source paths. Plain text out.
- **Demo corpus:** public, redistributable. Project Gutenberg
  subset, Wikipedia article dump, or a famous OSS docset
  (Postgres docs? Kubernetes docs?). To be picked early — the
  README demo runs against this.

**Done when:** `the-stacks ingest <corpus>` builds the DB,
`the-stacks ask "..."` returns sensible top-k chunks, asciinema
recording exists for the README.

### M2 — The wiki as routing layer

Where the architectural opinion lives.

- **Wiki pages:** markdown files with frontmatter declaring
  retrieval scope. Format:
  ```yaml
  ---
  topic: kubernetes-networking
  scope:
    tags: [networking, cni, ingress]
    paths: [docs/concepts/services-networking/**]
  ---
  ```
- **Two-phase query:** `the-stacks ask "..."` consults the wiki
  index first. If a wiki page matches the question, return its
  curated content **plus** a scoped retrieval drill-down. If no
  wiki page matches, fall back to global retrieval.
- **Demo:** side-by-side comparison. Same question, three modes:
  pure RAG (M1), pure wiki, wiki+RAG. Show how the third gives
  you the curated frame and the deep evidence.
- **Editorial tooling:** `the-stacks promote <chunk-id>` —
  surface a high-frequency retrieval target as a candidate wiki
  page. The wiki grows from observed retrieval patterns, not from
  guessing.

**Done when:** wiki frontmatter contract is documented, two-phase
query works, side-by-side demo recording exists, `promote` flow
is functional.

### M3 — Coda-lite plugin / MCP server

The differentiator.

- **`the-stacks mcp serve`** subcommand. JSON-RPC over stdio,
  same idiom as coda-lite's MCP.
- **Tools exposed:**
  - `stacks_ask(query, k, mode)` — query with mode hint
    (rag-only, wiki-only, hybrid)
  - `stacks_ingest(path)` — add to corpus
  - `stacks_wiki_promote(chunk_id)` — propose a wiki page from a
    retrieved chunk
  - `stacks_wiki_read(topic)` — read a curated page directly
- **Coda-lite integration:** an agent's `opencode.json` adds a
  `the-stacks` MCP block pointing at the agent's own corpus
  (their `wiki/`, `memory/`, `learnings/`, `dreams/`). Annie eats
  her own corpus first; zach mounts it once it's stable.

**Done when:** Annie boots with the-stacks MCP wired in,
queries her own memory through it, and at least one curated wiki
page in her corpus has a working scoped drill-down.

## Conventions

- **Single Go binary,** no runtime deps beyond Ollama for embeddings.
- **File-backed everything.** sqlite-vec for vectors, markdown for
  wiki pages, filesystem for corpus. Same ethos as coda-lite.
- **Always-explicit naming** in CLI. No env-var magic. No
  pwd-magic. `the-stacks --corpus <dir> ask "..."`.
- **Public test corpus** for the README demo. Annie's private
  corpus is for dogfood, not the demo.
- **README-driven.** The README writes itself if M1/M2/M3 land in
  order with asciinema recordings. Resume artifact.

## Open questions deferred to implementation

- **Chunking strategy.** Naive 500/50 to start. Revisit if quality
  is bad on the public corpus.
- **Top-k default.** Probably 5. Empirical.
- **Wiki frontmatter exact shape.** Locked above as a starting
  point; revisit after first wiki page exists in real use.
- **Corpus refresh model.** Watch mode? Periodic scan? On-demand?
  Probably on-demand for v0 (call `ingest` to refresh), watch mode
  later if it matters.
- **Demo corpus pick.** Annie chooses, with rationale, in M1 card.
- **Embedding model swap.** `nomic-embed-text` for v0. If quality
  is bad, try `bge-m3` or `mxbai-embed-large`.

## Sequencing

M1 → M2 → M3. Each milestone is independently shippable and
demo-able. No "M3 retroactively requires changing M1" surprises
expected — the layers are additive.

## What this is not

- **Not a coda-lite plugin first.** It's a standalone tool that
  *also* ships an MCP server. The standalone shape is the
  resume-piece. The MCP wiring is the dogfood.
- **Not a re-implementation of memory-as-coda-surface (#211).**
  That design contract carries forward; the-stacks is a candidate
  *implementation* of that surface, not a replacement for the
  contract.
- **Not a competitor to mature RAG frameworks.** It's an
  architectural opinion about wiki-as-routing-layer expressed in
  the smallest possible code. LangChain et al. solve different
  problems.

## References

- coda-lite: `evanstern/coda-lite` — substrate
- focus v2: `~/agents/zach/designs/focus-v2.md` — sibling project
- Karpathy's wiki style — original inspiration for our wiki layer
- Memory-as-coda-surface: `wiki/decisions/memory-as-coda-surface.md`
  (#211) — surface contract this implements
