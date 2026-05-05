---
schema_version: 2
id: 1
uuid: 019df5c3-81ff-79f0-88ac-97b62928d745
title: 'M1: RAG that works'
type: epic
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
---

# M1: RAG that works

The boring foundation. Standalone RAG over a public corpus. No
wiki layer yet, no MCP yet — just ingest, embed, query, demo.

## Children

- #4 Pick demo corpus and document rationale
- #5 Build ingest + embed pipeline (sqlite-vec + Ollama)
- #6 Build ask CLI and record asciinema demo

Bootstrap (#7) is a sibling card, not a child — repo setup
precedes the first build card.

## Done when

- `the-stacks ingest <corpus>` walks a corpus dir and builds
  `stacks.db` with chunks + embeddings
- `the-stacks ask "..."` returns top-k chunks with scores and
  source paths
- README has an asciinema recording of the demo flow against the
  selected public corpus
- All three child cards closed

## Context

See `designs/the-stacks.md` (M1 section) for the full architectural
contract. Stack is locked: Go binary, sqlite-vec, Ollama +
nomic-embed-text. Chunking starts at 500/50 — revisit only if
quality is bad.
