# Metric Contract: pinned definitions (FR-015)

These definitions are the ONLY metric semantics the harness may implement. They
are pinned here so every eval run — whatever the configuration — measures the
same thing; changing a definition is a contract change (new name, never a silent
redefinition).

**Setup**: for gold item *i*, `expected_i` is its expected-passage set (matched
by `contentSha256` against the returned results' snapshots — so a re-ingested
identical passage still counts). `rank_i` = position (1-based) of the FIRST
returned result whose hash ∈ `expected_i`, over the run's recorded results.
`unresolvable` items (data-model.md) are EXCLUDED from every metric's
denominator and reported as their own count — never scored as misses.

## recall@k  (k ∈ {5, 10})

`recall@k = |{ i : rank_i ≤ k }| / |resolvable items|`

The fraction of questions whose answer surfaced in the top k. Primary
product-truth metric (SC-001's formal cousin).

## MRR (mean reciprocal rank)

`MRR = mean over resolvable items of (1 / rank_i)`, `0` when no expected passage
appears anywhere in the recorded results (rank_i undefined).

Rewards putting the answer FIRST — the metric closest to Quick Ask's future UX.

## nDCG@10 (binary relevance)

`DCG@10 = Σ_{p=1..10} rel_p / log2(p + 1)` where `rel_p = 1` if the result at
position p's hash ∈ `expected_i`, else 0; `IDCG@10` = the DCG of the ideal
ordering (all |expected_i| relevant passages first, capped at 10);
`nDCG@10 = mean(DCG/IDCG)` over resolvable items.

Credits ranking MULTIPLE expected passages well — matters once gold items carry
more than one expected passage.

## Slices

Every metric is computed and reported PER SPLIT: `tuning` and `heldout`,
never blended. Configuration choices cite tuning metrics; the final choice's
report must show held-out metrics alongside (FR-013, SC-005). The deterministic
CI slice computes the same definitions over the fixture gold set and asserts the
pinned floor (values fixed when the fixture lands; regression = build failure,
FR-017/SC-004).

## Implementation note

`packages/retrieval/src/eval/metrics.ts` implements exactly these formulas as
pure functions over `(results, expectedHashes)[]` — unit-tested against
hand-computed examples in this contract's terms, no DB, no engine.
