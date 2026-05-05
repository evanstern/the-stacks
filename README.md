# The Stacks

> A hierarchical knowledge system where a hand-curated wiki indexes
> into a vector RAG store. The wiki is the librarian. The stacks are the books.

**Status:** under construction. M1 in progress.

## Why

Two failure modes shape the design:

- **Wiki alone doesn't scale.** Hand-curated knowledge bases hit a
  ceiling around ~100 pages. Past that, you're navigating navigation.
- **RAG alone is structureless.** Vector retrieval over an
  unstructured corpus returns plausible chunks with no editorial
  judgment. Every query starts from zero. The retriever has no
  opinion about what matters.

The Stacks combines them. The wiki is the **routing layer** — a
small, hand-curated set of pages with frontmatter declaring retrieval
scope. Each wiki page says: *here are the load-bearing facts about
this topic, and if you need to drill in, query these tags / this
directory / this corpus subset.* RAG is the **deep store** —
retrieval scoped by what the wiki page declares.

This mirrors how good libraries work (Dewey decimal as routing,
stacks as storage), how Wikipedia works (curated article + retrievable
references), and how good codebases work (README + grep).

## Stack

- **Language:** Go (single binary, no daemons)
- **Vector store:** [sqlite-vec](https://github.com/asg017/sqlite-vec)
- **Embeddings:** [Ollama](https://ollama.com/) + `nomic-embed-text` (local, free)
- **MCP:** standard Go MCP SDK, mounts into [coda-lite](https://github.com/evanstern/coda-lite)
- **Demo corpus:** public, redistributable. To be selected in M1.

Local-first. File-backed. The whole thing is a single Go binary plus
a sqlite database plus a directory of markdown.

## Roadmap

| Milestone | Shape | Done when |
|-----------|-------|-----------|
| M1 | RAG that works (ingest + ask, sqlite-vec + Ollama) | asciinema demo against public corpus |
| M2 | Wiki as routing layer (frontmatter scope, two-phase query) | side-by-side demo: rag-only / wiki-only / hybrid |
| M3 | coda-lite MCP plugin | An agent boots with the-stacks MCP wired in, drills into its own corpus |

Full design: [`designs/the-stacks.md`](designs/the-stacks.md).

## Non-goals

- Multi-user / multi-tenant. Single-host, single-user.
- Cloud-first. Local-first; cloud is opt-in.
- Reranker pipelines, query expansion, hybrid search. Not in v0.
  Vanilla cosine over chunks. Complexity earns its keep.

## Status board

Project work is tracked with [focus](https://github.com/evanstern/focus)
in [`.focus/`](.focus/). M1 epic: corpus pick → ingest+embed pipeline →
ask CLI → asciinema recording.

## License

MIT. See [LICENSE](LICENSE).
