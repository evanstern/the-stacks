---
schema_version: 2
id: 11
uuid: 019df5fc-9335-7b19-b2d7-a39f17eede84
title: Embed local corpus into sqlite-vec (chunk strategy experiment + embed pipeline)
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Embed local corpus into sqlite-vec

Reads the local JSONL corpus produced by #5, converts trade events
into chunks (by some strategy), embeds chunks via Ollama, stores in
sqlite-vec. Then `the-stacks ask` (#6) becomes possible.

**Blocked by:** #5 (pull)

## The chunk question

The central design call. Trades are tiny (one trade ≈ 50 fields,
mostly numeric). Embedding individual trades is wasteful and
probably useless — "buy 15.46 shares at 0.97" doesn't carry enough
semantic content to retrieve anything against.

Three candidate strategies to evaluate empirically:

### A. Per-trade

One chunk = one trade, rendered as a sentence:
*"On 2024-11-04 14:32 UTC, a buyer purchased 15.46 shares of YES on
'Will Trump win the 2024 election' at $0.97."*

- Pro: maximal granularity, simplest mental model
- Con: tens of millions of chunks for the corpus, embed cost,
  retrieval will return near-duplicate hits

### B. Per-time-window per-market (e.g. hourly buckets)

One chunk = a synthesized summary of all trades for one market
in one time window. E.g. "In the hour ending 2024-11-04 15:00 UTC,
the Trump-2024 YES market saw 247 trades totaling $89,231 in
volume, with prices ranging $0.94-$0.98 (median $0.96)..."

- Pro: chunk count drops 100x-1000x, semantic content richer
- Con: window size is a hyperparameter, summarization logic to
  write, partial windows at market edges

### C. Per-market summary + per-significant-event

One chunk = whole-market context blob (question, dates, total
volume, resolution). Plus "significant events" detected from the
trade stream (price moves > N%, volume spikes, near-resolution
behavior).

- Pro: closest to what humans want to retrieve, smallest DB
- Con: "significant event" detection is itself non-trivial,
  relies on heuristics we'd have to defend

### Plan

Don't pick in chat. Build the pipeline so chunk strategy is
swappable, run all three over a 5-market subset of the corpus,
measure:

- Chunks generated per market
- Embed time
- DB size
- Retrieval quality on the demo questions from #4 (subjective —
  do top-5 results look sensible?)

Document findings in `designs/the-stacks-corpus.md` and lock the
M1 default. Other strategies stay in the codebase as alternatives.

## Pipeline shape

```
the-stacks embed \
  --in ./corpus/polymarket \
  --db ./stacks.db \
  --strategy time-window \
  --window 1h
```

Steps:

1. **Walk the JSONL.** Read `<in>/markets.json` for context, then
   stream `<in>/trades/*.jsonl`.
2. **Apply chunk strategy.** Pluggable interface; produce
   `(text, metadata)` tuples per chunk.
3. **Embed.** HTTP to local Ollama, model `nomic-embed-text`,
   batched.
4. **Store.** sqlite-vec. Schema:
   - `markets(condition_id TEXT PRIMARY KEY, slug, question, ...)`
   - `chunks(id INTEGER PRIMARY KEY, condition_id TEXT, strategy
     TEXT, when_start INTEGER, when_end INTEGER, text TEXT,
     embedding BLOB)` — embedding via sqlite-vec
5. **Resume.** Track which (market, strategy) pairs have been
   embedded; skip on re-run.

## Done when

- `the-stacks embed --in <corpus> --db <db> --strategy <s>` runs
  end-to-end for each of the three candidate strategies on a
  5-market subset
- Findings written to `designs/the-stacks-corpus.md`: chunks
  generated, embed time, DB size, qualitative retrieval notes
- M1 default chunk strategy locked in the design doc
- Full corpus embedded under the chosen strategy, runtime
  documented
- Re-running on same input is no-op (resume works)
- One unit test per strategy implementation (deterministic given
  same input)
- Friendly error if Ollama isn't running (with the `ollama serve`
  + `ollama pull nomic-embed-text` instructions)

## Open questions

- **Embedding model.** `nomic-embed-text` is the design default.
  Revisit only if M1 retrieval quality is bad.
- **Vector dimension.** `nomic-embed-text` is 768d. sqlite-vec
  table dim must match.
- **Batch size for Ollama embed.** Empirical. Start with 32.

## Notes

Created 2026-05-05 from the split of original #5 ("ingest + embed
pipeline"). Split rationale: pull is network-bound and slow; embed
is CPU/Ollama-bound and fast to iterate. Separating lets us
re-run embed strategy experiments cheaply against a stable local
corpus.
