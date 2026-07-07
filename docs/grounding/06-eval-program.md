# 06 — The Evaluation Program

Scope item 5 demands that embedding and retrieval choices be *re-evaluated with intention*:
real tests, a baseline, and findings documented clearly enough to review and revisit. This
is a program, not a one-off script. All four tracks below are in scope (user decision).

## What already exists (seed material)

v2 ships an embedding eval harness (`scripts/eval_embeddings.py`, `make eval-embeddings`)
with gold fixtures and deterministic/OpenAI/HuggingFace providers, producing stable JSON
reports keyed by provider/model/dimension identity. This is the starting point, not a
blank page — v3 extends the idea, ports it to the new stack, and grows the gold set.

## Ground rules

1. **Baseline first.** Before any change, run the full suite against v2's exact
   configuration (text-embedding-3-small @ 1536, 1200/160 chunking, dense-only, min-score
   0.2, top-k 8) on the v3 stack. Every later result is reported as a delta against this.
2. **One variable at a time.** Each experiment changes a single axis and holds the rest;
   the harness enforces recording the full configuration identity with every result.
3. **Findings are durable artifacts.** Every experiment produces a written report
   (question, setup, numbers, interpretation, decision) filed in the repo; decisions that
   change defaults get an ADR. Results should be reproducible from the manifest + config.
4. **The gold set is a first-class asset.** A D&D-specific benchmark: real GM questions
   against a known corpus (the 5e core trio), each with labeled relevant passages and,
   for the end-to-end track, reference answers. Grow it deliberately; version it; never
   train/tune against the held-out slice.

## Track 1 — Embedding models

Candidates: current OpenAI models, leading open models runnable in the ML sidecar
(bge/gte/nomic-class and successors — pick current leaders at spec time, not from this
doc), plus dimension/truncation variants. Metrics: recall@k and MRR/nDCG against the gold
set, plus cost, latency, and index size. Question to answer: does a local model reach
API-model quality for this corpus, and what does that unlock for fully self-hosted
deployments?

## Track 2 — Chunking strategies

v2's 1200-char/160-overlap seam-aware splitter is the baseline. Variables: size, overlap,
and above all **structure-awareness** — D&D content is unusually structured (stat blocks,
spell entries, tables, sidebars), and the normalized-document model (doc 05) exposes that
structure. Hypothesis worth testing explicitly: keeping stat blocks and tables intact
beats any fixed character budget. Chunking changes interact with embedding models, so
this track runs against at least the baseline and the leading Track-1 candidate.

## Track 3 — Retrieval strategy (hybrid + reranking)

v2 is dense-only. pgvector + Postgres full-text search (D5) makes hybrid retrieval a
query-level experiment rather than an infrastructure project. Variables: dense-only vs
lexical-only vs hybrid (fusion strategy as a sub-variable), and a cross-encoder reranker
(served from the ML sidecar) over the fused candidates. Hypothesis worth testing
explicitly: D&D proper nouns (spell names, monster names, feat names) are exactly where
lexical search beats embeddings, so hybrid should win on entity-heavy queries. The
overfetch/filter/dedupe/trace design from v2 stays and extends to record per-strategy
provenance of every candidate.

## Track 4 — End-to-end RAG quality

Retrieval metrics don't guarantee good answers. On a fixed question set, judge the final
product: answer faithfulness to cited chunks, citation precision/recall (are the right
sentences cited, are citations real), refusal correctness (does Quick Ask refuse exactly
when it should), using an LLM judge (a configured model role per doc 03) with rubrics,
spot-audited by the operator. This track is also where conversation-mode citation
discipline gets measured once conversations exist.

## Sequencing

Track order is 1 → 2 → 3 → 4 in dependency terms, but the baseline run covers all four
metrics from day one so later deltas are comparable. The eval harness is part of the v3
codebase proper (not a side script), runnable against any configured provider, in CI
where cheap (deterministic provider for regression; model-backed runs on demand).
