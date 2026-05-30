---
schema_version: 2
id: 11
uuid: 019df5fc-9335-7b19-b2d7-a39f17eede84
title: Embed raw ledger into sqlite-vec (chunk strategy experiment + embed pipeline)
type: card
status: archived
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Embed raw ledger into sqlite-vec

Reads from the raw sqlite ledger produced by #5, converts trade
rows into chunks (by some strategy), embeds chunks via Ollama,
stores chunks + vectors in `stacks.db`. Then `the-stacks ask` (#6)
becomes possible.

**Blocked by:** #5 (pull)

## The chunk question

The central design call. Trades are tiny (~14 columns of mostly
numeric data per row). Embedding individual trades is wasteful and
probably useless — "buy 15.46 shares at 0.97" doesn't carry enough
semantic content to retrieve anything against.

Three candidate strategies to evaluate empirically. With the raw
data in sqlite, most of these are SQL aggregations rather than
file walks.

### A. Per-trade

One chunk = one trade, rendered as a sentence:
*"On 2024-11-04 14:32 UTC, a buyer purchased 15.46 shares of YES on
'Will Trump win the 2024 election' at $0.97."*

```sql
SELECT * FROM trades_envelope ORDER BY when_unix
```

- Pro: maximal granularity, simplest mental model
- Con: tens of millions of chunks at top-100 scale; useless
  retrieval (near-duplicate hits)

### B. Per-time-window per-market (hourly buckets)

One chunk = synthesized summary of all trades for one market in
one time window:
*"In the hour ending 2024-11-04 15:00 UTC, the Trump-2024 YES
market saw 247 trades totaling $89,231 in volume, with prices
ranging $0.94-$0.98 (median $0.96)..."*

```sql
SELECT condition_id,
       (when_unix / 3600) * 3600 AS bucket_start,
       COUNT(*) AS n_trades,
       SUM(size * price) AS volume_usd,
       MIN(price) AS price_min,
       MAX(price) AS price_max,
       AVG(price) AS price_avg
FROM trades
GROUP BY condition_id, bucket_start
```

- Pro: 1000x fewer chunks, semantic content richer, SQL-native
- Con: window size is a hyperparameter; summarization template
  to write

### C. Per-market summary + per-significant-event

One chunk = whole-market context blob (question, dates, total
volume, resolution). Plus "significant events" detected from
the trade stream (price moves > N%, volume spikes, near-resolution
behavior). All detection runnable as SQL window functions.

- Pro: closest to what humans want to retrieve, smallest DB
- Con: "significant event" detection is heuristic territory

### Plan

Don't pick in chat. Build the pipeline so chunk strategy is
swappable, run all three over a 3-market subset of the corpus,
measure:

- Chunks generated per market
- Embed time
- DB size
- Retrieval quality on the demo questions from #4 (subjective:
  do top-5 results look sensible?)

Document findings in `designs/the-stacks-corpus.md` and lock the
M1 default. Other strategies stay in the codebase as alternatives.

## Pipeline shape

```
the-stacks embed \
  --raw ./corpus/raw.db \
  --db  ./stacks.db \
  --strategy time-window \
  --window 1h
```

Steps:

1. **Open raw DB** (read-only) and `stacks.db` (read-write,
   migrate as needed).
2. **Apply chunk strategy.** Each strategy is a Go interface
   producing `(text, metadata, when_start, when_end, condition_id)`
   tuples, typically backed by SQL queries against `raw.db`.
3. **Embed.** HTTP to local Ollama, model `nomic-embed-text`,
   batched. Default batch=32.
4. **Store.** Single `stacks.db` with:
   - `markets` table — copy from raw.db (denormalized for
     standalone serving), so `stacks.db` is self-contained for
     the demo
   - `chunks(id, condition_id, strategy, when_start, when_end,
     text, vec_rowid)` — vec_rowid links to sqlite-vec table
   - `chunks_vec` virtual table from sqlite-vec, 768d float32
5. **Resume.** Track `(condition_id, strategy)` pairs already
   embedded; skip on re-run.

## Why two databases (raw.db and stacks.db)

`raw.db` is the full ledger — large (1-2 GB at top-10), kept
locally during corpus refresh, NOT shipped. `stacks.db` is
just chunks + vectors + denormalized market context — small
(~300 MB at top-10), shipped as the release artifact (#13).
Readers get `stacks.db`; only refreshers (us) need `raw.db`.

## Done when

- `the-stacks embed --raw <r> --db <d> --strategy <s>` runs
  end-to-end for each of A/B/C on a 3-market subset
- Findings written to `designs/the-stacks-corpus.md`: chunks
  generated, embed time, DB size, qualitative retrieval notes
- M1 default chunk strategy locked in the design doc
- Full top-10 corpus embedded under the chosen strategy,
  runtime documented
- `stacks.db` is fully self-contained (carries `markets` + chunks
  + vectors); reader doesn't need `raw.db` to query
- Re-running on same input is no-op (resume works)
- One unit test per strategy implementation (deterministic given
  same input)
- Friendly error if Ollama isn't running (with `ollama serve` +
  `ollama pull nomic-embed-text` instructions)

## Open questions

- **Embedding model.** `nomic-embed-text` is the design default.
  Revisit only if M1 retrieval quality is bad.
- **Vector dimension.** `nomic-embed-text` is 768d. sqlite-vec
  virtual table dim must match.
- **Batch size for Ollama embed.** Empirical. Start with 32.

## Notes

Created 2026-05-05 from the split of original #5 ("ingest + embed
pipeline"). Then **revised same-day 2026-05-05** to read from
sqlite (#5 storage rewrite) instead of JSONL files. Most chunk
strategies are now SQL aggregations rather than file walks —
strategy B becomes literally `GROUP BY condition_id, bucket_start`.
