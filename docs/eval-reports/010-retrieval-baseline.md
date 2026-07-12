# Eval report: 010 retrieval baseline — the shipped defaults, justified

**Date**: 2026-07-11 · **Spec**: specs/010-retrieval-eval-harness (FR-004/FR-019, SC-005/SC-006)
**Gold set**: the committed fixture set (12 items: 9 tuning / 3 heldout — synthetic
"Emberfall" corpus, deterministic embeddings, research R8)
**Harness**: `createEvalRun`/`executeEvalRun` over the real engine; run ids below are
reproducible receipts (each question left an `origin:"eval"` retrieval run).

## Question

Which fusion strategy ships as the default — RRF or weighted-sum — and at what
parameters (D11: baseline first, one variable at a time)?

## Runs

| Config | Eval run id | tuning recall@5 | tuning MRR | tuning nDCG@10 | heldout (all) |
|---|---|---|---|---|---|
| `rrf-default` (rrf, k=60) | `6e05e95f-b4ff-4d0f-92a7-d63088147bd1` | 1.000 | **0.944** | **0.916** | 1.000 |
| `weighted-a05` (α=0.5) | `b1cf8bae-38a5-4711-a093-c78f7f71d7f3` | 1.000 | 0.944 | 0.916 | 1.000 |
| `weighted-a07` (α=0.7) | `b0079b04-74df-4616-9d3f-4f4cd1d98974` | 1.000 | 0.833 | 0.834 | 1.000 |

(Variables changed one at a time: fusion strategy, then α. Held-out reported
alongside tuning per FR-013; identical here because the held-out items are all
paraphrase-mapped and both strategies rank their targets first.)

## Decision

**RRF (`rrf_k=60`) ships as the default** (`RETRIEVAL_FUSION=rrf`).

- On this gold set RRF and weighted-α0.5 tie; weighted-α0.7 already degrades
  tuning MRR by 0.111 — the weighted family is **sensitive to a calibration
  parameter that has no principled per-corpus value**, which is exactly the
  operational burden research R1 predicted. RRF has no such knob.
- A tie under measurement resolves to the option with fewer failure modes.

**Reranking ships OFF** (`RETRIEVAL_RERANK=off`): no measurement yet exists to
justify its latency (SC-006's comparison requires a live cross-encoder role);
turning it on before measuring would invert D11.

## Known characteristic (recorded for future candidates)

`websearch_to_tsquery`'s AND semantics: a multi-term query missing one word from
the passage ("grapple stamina **cost**") misses that passage entirely on the FTS
signal — the vector signal absorbs this in production. A future eval candidate:
OR-relaxed fallback FTS queries, measured before adopted.

Observed LIVE during the 010 walkthrough (real MiniLM embeddings, one-chunk
corpus): the natural question "how does a riposte work" missed a passage the
bare keyword "riposte" found — "work" defeated the FTS AND, and the
question-vs-whole-page cosine similarity (~<0.3) fell under the default
`RETRIEVAL_MIN_SIMILARITY` floor. The harness measured it honestly (eval run
scored recall 0 with its receipt). Floor tuning on a real corpus is TASK-10's
first question.

## Limitations, honestly

1. The fixture's vector geometry is **constructed** (hash embeddings + a
   paraphrase map): it proves ranking/fusion/metric math, not semantic quality.
   Validation over the operator's real corpus with a ≥30-item gold set is the
   standing follow-up (board task).
2. The rerank on/off comparison awaits a configured `RERANKER_MODEL_ID` — same
   follow-up.

## Reproduce

Fixture + gold set are committed (`packages/retrieval/src/eval/fixture/`); the
deterministic CI floor (`ci-floor.test.ts`) re-runs the `rrf-default`
measurement inside every `pnpm verify` and fails the build below the pinned
floor — this report's baseline is re-proven on every PR.
