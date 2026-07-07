# 05 — Extensible Ingestion Service

## The requirement

D&D Beyond material is the flagship source today; the roadmap is more ingesters over more
kinds of source material, added over time without surgery on the pipeline core. v2 already
proved the right seam (the `etl.contracts.v1` plugin contract); v3 promotes that idea from
"adapter bolted beside legacy parsers" to "the only path."

## Shape of the pipeline (concepts, not code)

The v2 stage vocabulary survives because it's correct:

**intake → detect → extract → transform → chunk → embed → index**

- **Intake** (API-side, synchronous): validate type and size, fingerprint content
  (sha256), store the immutable archive, write a queued job, return a claim ticket.
  Batch/ZIP handling per v2's upload-intake seam. Unsupported types are rejected honestly
  (415) at the door.
- **Detect**: decide which ingester (plugin) owns this source. Detection is the plugins'
  job — each plugin declares what it can recognize (e.g., "this HTML is a saved D&D Beyond
  page") with a confidence, and the registry picks the owner. Generic fallbacks (plain
  HTML, Markdown, EPUB, text) catch what nothing specific claims.
- **Extract / transform** (plugin-owned): produce a **normalized document** — the pivotal
  contract of the whole design. Whatever the source looked like, past this point the
  pipeline sees one shape: a document with ordered sections, headings/section paths,
  content classified by kind where the plugin knows it (prose, stat block, table, spell
  entry…), source anchors for citation deep-linking, and sanitized display artifacts for
  the archive viewer.
- **Chunk** (pipeline-owned, plugin-informed): the pipeline owns chunking policy, but the
  normalized document's structure informs it — v3 treats structure-aware chunking (don't
  split a stat block; keep a table with its caption) as an eval variable (doc 06). Plugins
  may supply chunking *hints*, never their own chunker.
- **Embed / index** (pipeline-owned): batched embedding via the configured provider,
  idempotent indexing into pgvector with deterministic IDs, plus the full-text index.
  Embedding-model identity stamped on the index (doc 03).

The queue remains a Postgres table with locked claims, a status pipeline, and per-stage
events — v2's pattern, unchanged in spirit.

## The plugin contract (v2's, re-expressed in TypeScript)

A plugin declares: identity and version; what it can detect (with confidence); how to
extract and transform to the normalized document; failure categories it can report; and
optional chunking hints. Plugins are registered, versioned, and recorded — every ingested
source remembers which plugin (and version) produced it, so a plugin fix can identify
exactly which sources to re-ingest.

What plugins **never** do: touch the database, embed, index, or talk to model providers.
That separation is what makes "write a new ingester" a small task.

## v3 ingester lineup

| Ingester | Status | Notes |
|---|---|---|
| D&D Beyond saved HTML / ZIP export | Port from v2 | The ~760 lines of detection/parsing/sanitization knowledge in `ddb_import.py` is the most valuable domain code in the repo; carry the rules, selectors, and artifact model over deliberately |
| Generic archived webpage | Port from v2 | |
| Generic HTML | Port from v2 | Fallback |
| Markdown / plain text | Port from v2 | Fallback |
| EPUB | Port from v2 | |
| PDF | **Future, explicitly not v3** | Remains the honest 415; when it comes, it's "just another plugin" — the test of the whole design |

## Corpus lifecycle (the D4 simplification)

What survives from v2's runtime-version machinery:

- **Immutable, content-addressed source archives** — the permanent record of what went in.
- **A corpus as a rebuildable artifact**: a manifest of sources (with hashes and expected
  counts) from which the index can be re-seeded and verified. The lock → seed → verify
  ritual survives as the integrity story.
- **Guardrail verbs**: corpus reset and re-embed are dry-run-first, require explicit
  confirmation, and log lifecycle events.

What is dropped: per-version isolated databases, per-version Qdrant collections,
activation pointers, and the blue-green swap. One live corpus, mutated only through the
guarded verbs. If multi-corpus (e.g., separate campaigns/game systems) becomes real, it
returns as a spec informed by actual need — the schema should keep a corpus identifier on
sources/chunks so that door stays open cheaply.
