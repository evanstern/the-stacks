# 01 — Vision & Scope

## What The Stacks is

A self-hosted, single-operator web application for tabletop RPG game masters. The operator
uploads their own source material — today, primarily saved pages and exports from
**D&D Beyond** — and the app answers questions grounded in that material, with every factual
claim carrying an inline citation that opens the exact source passage. The app ships no
copyrighted content; it is a bring-your-own-books research library.

v3 keeps that identity and adds a second mode of use: a real **conversation partner** that
remembers the discussion, can reason and draw conclusions across turns, can use tools, and
still cites sources when it makes factual claims about the corpus.

## v3 scope

### In scope

1. **RAG optimized for D&D source books**, specifically D&D Beyond saved-HTML/ZIP exports,
   as the flagship ingestion path.
2. **Extensible ingestion service.** New ingesters for different and more generic source
   material must be addable without touching the pipeline core. The v2 plugin contract
   proved the seam works; v3 makes plugins the primary path, not an adapter around legacy
   parsers (see doc 05).
3. **Single-turn "Quick Ask"**: no memory, always retrieves, answers only from evidence,
   refuses honestly when evidence is missing. This is v2's proven behavior, ported.
4. **Multi-turn conversations** (new): auto-saved, renamable sessions with conversational
   memory. The model can converse, summarize, and draw conclusions — and when it asserts
   facts from the corpus, those claims are cited and validated. Retrieval is exposed to the
   model as a tool it chooses to use (decision D8).
5. **Configurable model providers**: Anthropic (Claude), OpenAI, and self-hosted
   OpenAI-compatible endpoints (Ollama and friends), selectable via configuration and, per
   conversation, in the UI. Applies to chat, embeddings, and any judge/reranker models.
6. **Basic tool use**: at minimum, read/write files in a per-session scratch workspace
   (decision D9), as the foundation for richer tools later.
7. **An intentional evaluation program** for embeddings, chunking, retrieval strategy, and
   end-to-end answer quality, with a baseline run and documented findings (doc 06).

### Out of scope for v3 (explicitly)

- Multi-user accounts, sharing, or permissions. Still single-operator.
- PDF ingestion (remains a deliberate 415; a future ingester candidate).
- Full blue-green runtime-version machinery with per-version databases (decision D4
  simplifies this to corpus versioning).
- Mobile apps, offline mode, or public hosting as a service.
- Agentic tools beyond the scratch workspace + corpus retrieval/read tools (web browsing,
  code execution, etc. are future iterations).

## Product principles that must survive the rewrite

These are the load-bearing ideas from v2, extracted from both the codebase and the
"Inside The Stacks" course. Any v3 design that violates one of these needs an ADR.

1. **Hallucination is fixed by architecture, not trust.** Retrieval decides what the model
   may see; prompts confine it; validators check citations after the fact; independent
   exits converge on an honest "no evidence." In multi-turn mode this softens from
   "refuse to answer" to "never fake a citation" — but the validation machinery stays.
2. **Citations are receipts.** Every citation is a durable record linking answer →
   retrieval run → exact chunk, and it keeps working in old conversations.
3. **Slow work never happens while a user waits.** Uploads are accepted and recorded;
   processing is asynchronous with a legible status contract.
4. **Failures are legible.** Append-only event trails (jobs, retrieval runs, corpus
   lifecycle), errors typed by cause and mapped to honest status codes, user-facing
   messages scrubbed of secrets with full diagnostics kept operator-side.
5. **Destructive operations are dry-run-first, explicitly confirmed, and structurally
   refuse to touch what's live.**
6. **Retries are safe by construction** (deterministic IDs, idempotent indexing,
   content-hash dedupe).
7. **Boring infrastructure is a feature.** The queue is a Postgres table; config is env
   vars with safe local defaults; the whole system starts with one compose command.
8. **The operator can always see inside.** A Records-style observability surface with
   URL-addressable state is part of the product, not tooling.
