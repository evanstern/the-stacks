# Eval report: 010 retrieval — real-corpus validation & floor tuning

**Date**: 2026-07-12 · **Spec**: specs/010-retrieval-eval-harness (FR-004/FR-015/FR-019,
SC-005/SC-006) · **Supersedes** the fixture-only baseline of 2026-07-11 (kept in git
history; its RRF-vs-weighted decision still stands — re-confirmed below on real data).

**Corpus**: the operator's real ingested corpus — a saved D&D Beyond "Monsters (G)"
listing (36 chunks, `ddb-saved-html`) plus a homebrew "Emberfall" rules page (1
multi-topic chunk, `generic-html`). Real MiniLM (`all-MiniLM-L6-v2`, 384-d) embeddings.
**Gold set**: 41 items authored over that corpus (31 tuning / 10 heldout), natural-question,
definitional, and keyword phrasings — deliberately mixed so the eval separates the floor's
effect on question *style* from its effect on *content placement*.
**Harness**: the real engine via `POST /api/evals/runs`; every item left an `origin:"eval"`
retrieval receipt. Run ids are reproducible receipts.

## Questions

1. Do the shipped fusion defaults (RRF vs weighted-α0.5) hold on a real corpus? (D11)
2. TASK-10's first question: is `RETRIEVAL_MIN_SIMILARITY=0.3` too high for
   natural-question phrasing against real embeddings?

## Runs

Per-slice, computed by contracts/metrics.md. All eval-run ids below are live receipts.

| Config | Floor | Eval run id | tuning r@5 | tuning MRR | tuning nDCG@10 | heldout (all) |
|---|---|---|---|---|---|---|
| `rrf-default` | 0.3 | `7be1e7a6-34f0-407e-b260-85c015d5ca13` | 0.935 | 0.871 | 0.888 | 1.000 |
| `weighted-a05` | 0.3 | `1f562aef-38ba-4298-912c-68cdda272edb` | 0.935 | 0.871 | 0.888 | 1.000 |
| `rrf-floor-020` | 0.2 | `a2354392-cc8c-4a92-b813-f4dda28d8595` | **1.000** | **0.898** | **0.924** | 1.000 |
| `rrf-floor-015` | 0.15 | `e7a85a52-70b7-4622-8011-49e4fd261160` | 1.000 | 0.898 | 0.924 | 1.000 |
| `rrf-floor-000` | 0.0 | `53cf40a3-aa18-453c-9f87-ad265ef3d638` | 1.000 | 0.882 | 0.912 | 1.000 |
| `weighted-floor-015` | 0.15 | `1f628cba-a766-48ee-b2ad-127dfda50acf` | 1.000 | 0.898 | 0.924 | 1.000 |

(Variables changed one at a time: fusion first, then the floor. Heldout is perfect for
every config — its 10 items are all clean single-topic monster questions whose answer
ranks first regardless.)

## Answer 1 — fusion: RRF still ships as the default

On real embeddings **RRF and weighted-α0.5 are identical** (row 1 vs row 2, and row 3 vs
row 6 at the tuned floor). This corpus is small and single-signal-dominant, so fusion
choice is a wash — consistent with the fixture baseline, where weighted only *diverged*
(worse) when α was pushed off 0.5. A tie resolves to the option with no per-corpus
calibration knob: **RRF**.

## Answer 2 — the floor: 0.3 was too high; 0.2 is the measured knee

**Yes, 0.3 was too high.** The two — and only two — items `rrf-default` (floor 0.3) misses
are the buried-topic riposte natural-questions:

- `"how does a riposte work"` and `"How does a riposte work?"` → rank `None` (0 results).

Both recover the instant the floor drops to 0.2 (tuning recall@5 0.935 → 1.000, MRR
0.871 → 0.898). The mechanism, measured directly:

- The riposte rule is *one sentence* inside a chunk dominated by grappling and torchlight.
  Query-vs-whole-chunk cosine for riposte phrasings: `riposte` 0.161, `what is a riposte`
  0.167, **`how does a riposte work` 0.209** — all below the 0.3 floor. (By contrast
  `how does grappling work` scores 0.542: grappling *is* the chunk.)
- FTS can't rescue the natural question either: `websearch_to_tsquery`'s AND-semantics
  turn `"how does a riposte work"` into `riposte & work`; the chunk has "riposte" but not
  "work", so the FTS signal returns nothing. The bare keyword `riposte` still hits via FTS
  — which is why the *keyword* gold item passes and only the *natural-question* one failed.

**But do not remove the floor.** `rrf-floor-000` REGRESSES MRR (0.898 → 0.882) and nDCG
(0.924 → 0.912) versus 0.2/0.15: with no floor, weak vector matches surface *above* the
true answer on some items. The floor earns its keep; it was just set too high. 0.15 and
0.2 tie on every metric here, so **0.2** is the choice — it keeps the most headroom against
honest-empty on genuinely unrelated queries while recovering buried-topic questions.

### Decision applied

`RETRIEVAL_MIN_SIMILARITY` default lowered **0.3 → 0.2** (`.env.example`, `config.ts`
fallback, contracts/api.md §5). `RETRIEVAL_FUSION=rrf` and `RETRIEVAL_RERANK=off` unchanged.

The deterministic CI-floor fixture keeps its **own** floor pinned at 0.3 explicitly
(`ci-floor.test.ts`, `search.test.ts`): its hash-constructed embeddings place *unrelated*
text at ~0.2–0.3 (real MiniLM puts it near 0), so the fixture's honest-empty guarantee is
calibrated to 0.3. The operational default and the fixture floor are now decoupled on
purpose — a different number for a different, real embedding space.

## Two engine bugs found and fixed while validating

Real data exercised paths the synthetic fixtures never did:

1. **`ddb-saved-html` detect missed real saved pages.** A browser "Save Page As" inlines
   every stylesheet/script into `<head>`, pushing `<body>` past the 64 KiB detect prefix
   (observed: `<body>` at byte ~135k of 733k). Detect required the *article* in the prefix,
   so it scored 0 and the page fell through to "unsupported type." Fix: detect on the
   prefix-stable identity signals (saved-from stamp, canonical, og:url), which always sit
   in the first few KiB; `transform()` re-checks the full bytes. `generic-html` got the
   parallel fix for its own fallback path. Both pinned by large-preamble regression tests.
2. **The worker never marked jobs succeeded.** `main.ts` handled a job but never called
   `complete()`, so every job sat in `claimed` and `reclaimStale` re-ran it each visibility
   timeout — forever. Idempotent handlers (R8/R9) hid it: re-runs converged to the same
   rows. Surfaced here as an ingest job at 38 attempts (max 3) and an eval run re-executing
   once a minute. Fix: `complete(db, job.id)` after a clean handle.

## Limitations, honestly

1. **rerank on/off (SC-006) is still unmeasured**: `RERANKER_PROVIDER`/`RERANKER_MODEL_ID`
   are empty (role disabled, fail-fast). Measuring it needs a cross-encoder role configured
   and served by the sidecar — the remaining open follow-up.
2. **Heldout is uninformative here** (all 10 items perfect): the corpus has no hard
   held-out cases. A larger real corpus with more buried-topic and multi-passage questions
   would exercise the floor and nDCG harder.
3. The floor tuning is validated on ONE real embedding model (MiniLM). A different
   embedding space would need its own knee measured — the knob exists for exactly that.

## Reproduce

Ingest a saved DDB page + a homebrew rules page, author the gold set on `/evals/gold`, then
`POST /api/evals/runs` with `overrides:{minSimilarity:…}` per row above; compare on `/evals`.
The deterministic CI floor (`ci-floor.test.ts`) re-runs the fixture baseline inside every
`pnpm verify` and fails below the pinned floor — the fusion/metric math is re-proven per PR.
