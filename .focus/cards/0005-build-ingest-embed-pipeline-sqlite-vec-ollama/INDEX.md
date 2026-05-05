---
schema_version: 2
id: 5
uuid: 019df5c3-a6be-747d-a297-f7bab8ae3716
title: Build ingest + embed pipeline (sqlite-vec + Ollama)
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Build ingest + embed pipeline (sqlite-vec + Ollama)

The corpus → vectors path. Walks a directory, chunks markdown (or whatever the corpus shape is), embeds via local Ollama, stores in sqlite-vec.

**Blocked by:** #4 (corpus pick) and #7 (repo bootstrap)

## Shape

- `the-stacks ingest <path>` walks `<path>`, finds documents
- Chunker: ~500-token windows, ~50-token overlap. Naive to start.
- Embedding: HTTP call to local Ollama, model `nomic-embed-text`. Batch where possible.
- Storage: - `docs(path TEXT PRIMARY KEY, mtime INTEGER, hash TEXT)` - `chunks(id INTEGER PRIMARY KEY, doc_path TEXT, chunk_idx
    INTEGER, text TEXT, embedding BLOB)` — embedding via
    sqlite-vec
- Re-embed on hash change. Skip unchanged docs.

## Done when

- `the-stacks ingest <corpus-dir>` runs cleanly on the M1 demo corpus
- `stacks.db` is reproducible (run twice, second run is fast + no-op for unchanged docs)
- Reasonable progress output (don't make me wonder if it's hung)
- One unit test per non-trivial function (chunker boundaries, hash detection, sqlite-vec round-trip)

## Open questions for implementation

- Do we tokenize for chunk size or just byte/char count? Probably char-count to start (~2000 chars ≈ 500 tokens), revisit if retrieval suffers.
- Do we strip markdown formatting before embedding, or embed raw? Start with raw — formatting is signal sometimes. Document the call.
- Ollama not running? Friendly error message with the `ollama serve` + `ollama pull nomic-embed-text` instructions.
