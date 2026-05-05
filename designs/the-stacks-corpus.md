# The Stacks — M1 demo corpus

> **Status:** decided 2026-05-05
> **Decision:** Polymarket public Data API, top ~100 markets by volume, all-time
> **Companion to:** `the-stacks.md`

---

## The reframe

The original design (`the-stacks.md`) imagined a "Library of Congress"
demo corpus — Project Gutenberg, Postgres docs, Wikipedia. Big static
prose. That was wrong for what this tool is actually for.

The application work this is meant to back is **time-series-shaped**.
A schemaless event envelope:

```json
{
  "source": "polymarket",
  "tags": ["sports", "mlb", "binary-resolution"],
  "when": "2026-05-04T22:30:00Z",
  "data": { "...": "schemaless payload" }
}
```

Property management ledgers. Audit trails. Trades. Sensor readings. The
operational record of *what happened*. Not prose to summarize — a stream
of events to query.

The Stacks isn't "wiki-over-RAG for documents." It's **wiki-as-SOPs over
a structured event ledger.** The wiki holds editorial judgment — the
playbooks, best-practices, runbooks that frame the noise. The stacks hold
the events.

The corpus has to reflect that shape, or M1's demo doesn't generalize to
the real use case.

## The pick: Polymarket

Polymarket is a public on-chain prediction market. Every trade, position,
and resolution event is on-chain and exposed via free, unauthenticated REST
endpoints at `data-api.polymarket.com` and `gamma-api.polymarket.com`.

**Why this corpus:**

- **Natively ledger-shaped.** Each trade is already an event with a
  timestamp, a market identifier, structured tags (asset, side, outcome,
  user wallet), and a payload (size, price). It maps onto our envelope
  with almost no transformation.
- **Demo legibility.** "Will Trump win the 2024 election?" is a market
  every reader instantly understands. The README's queries don't need
  domain explanation.
- **A wiki layer with real editorial weight.** Prediction markets have
  rich SOP-shaped knowledge — how to read late-stage liquidity, what
  resolution disputes look like, which market types are gameable. The
  wiki+RAG demo for M2 has obvious queries.
- **Volume.** Top markets do tens of millions in volume; even a focused
  100-market subset puts us comfortably in the millions-of-events
  range. Real stress test.
- **Free and redistributable.** Public REST endpoints, no auth, no rate
  limits we care about, on-chain data is inherently public-domain in
  the practical sense.

**Demo question prototypes:**

- *"What was the last week of trading like for Trump-2024 YES?"*
  — pure ledger drill-down (M1: pure RAG over trade events)
- *"How should I read late-stage liquidity drops on a binary market?"*
  — pure SOP read (M2: wiki-only mode)
- *"Trump-2024 had this liquidity pattern in the final week — what
  does the playbook say about that?"*
  — hybrid (M2: wiki page anchors, RAG drills into scoped trade events)

These are exactly the three modes the M2 side-by-side demo needs.

## Sources rejected

| Source | Why no |
|---|---|
| Goldsky Mirror (Polymarket) | Paid product, requires customer-side database sink, not redistributable. Stays as a candidate *future* alternative ingest path for streaming-shaped dogfood, not the canonical M1 source. |
| predictiondata.dev | 3yr Polymarket history pre-packaged as CSV.gz, ~500M rows. Requires API key, redistribution license unclear. Worth keeping as a backfill fast-path if we later need raw historical depth, but the official API is the cleaner story. |
| kingsets.com | Free, but only last 30 days of trades — not enough history for a stress test. |
| Project Gutenberg | Wrong shape. Prose. |
| Wikipedia article dump | Wrong shape. Prose. |
| Postgres / Kubernetes docs | Wrong shape, also: every RAG demo has done this. |
| Encyclopedia Britannica 1911 | Cute, but wrong shape. |

## API shape (verified 2026-05-05)

### Trades — `GET https://data-api.polymarket.com/trades`

Returns the on-chain trade ledger. No auth. Sample (truncated):

```json
[
  {
    "proxyWallet": "0x5904fcc9...8940f",
    "side": "BUY",
    "asset": "85138606...897084",
    "conditionId": "0x92103465...48099",
    "size": 15.4639,
    "price": 0.97,
    "timestamp": 1777946602,
    "title": "Milwaukee Brewers vs. St. Louis Cardinals",
    "slug": "mlb-mil-stl-2026-05-04",
    "eventSlug": "mlb-mil-stl-2026-05-04",
    "outcome": "St. Louis Cardinals",
    "outcomeIndex": 1,
    "transactionHash": "0x269d5026...dc678"
  }
]
```

Useful filters (per docs): `market` (conditionId), `asset_id`,
`maker_address`, `before` / `after` timestamps, paginated via cursor.

### Markets — `GET https://gamma-api.polymarket.com/markets`

Returns market metadata. Useful for picking the top-N corpus and for
joining trades to human-readable context. Sample (truncated to relevant
fields):

```json
{
  "question": "Will Jesus Christ return before 2027?",
  "conditionId": "0x0b4cc3b7...134bee",
  "slug": "will-jesus-christ-return-before-2027",
  "endDate": "2026-12-31T00:00:00Z",
  "liquidity": "736319.04692",
  "startDate": "2025-11-25T18:08:21.296Z",
  "active": true,
  "closed": false,
  "volumeNum": 61354906.33647933
}
```

`?order=volumeNum&ascending=false&limit=N` is the selection query for
the top-volume corpus.

## Ledger envelope mapping

A Polymarket **trade** maps to our envelope as:

```json
{
  "source": "polymarket.trade",
  "tags": [
    "polymarket",
    "<eventSlug>",
    "<outcome>",
    "<side>",
    "<resolved-or-active>"
  ],
  "when": "<ISO-8601 from timestamp>",
  "data": {
    "conditionId": "0x...",
    "asset": "...",
    "size": 15.4639,
    "price": 0.97,
    "side": "BUY",
    "outcome": "St. Louis Cardinals",
    "outcomeIndex": 1,
    "proxyWallet": "0x...",
    "transactionHash": "0x...",
    "title": "Milwaukee Brewers vs. St. Louis Cardinals",
    "marketSlug": "mlb-mil-stl-2026-05-04",
    "eventSlug": "mlb-mil-stl-2026-05-04"
  }
}
```

A Polymarket **market** record (from Gamma) is *not* a ledger event —
it's a context object. Markets become wiki-or-metadata-layer entries,
not chunks. They give the trade events something to point at.

## Scope criterion (top ~100 markets)

```
GET https://gamma-api.polymarket.com/markets
    ?order=volumeNum
    &ascending=false
    &limit=100
```

Filter rules to firm up in the ingest card (#5):

- Skip markets with `volumeNum < $X` (TBD — sanity floor)
- Bias toward `closed=true` for the demo (resolved markets have a
  complete narrative arc; active markets are noisy and time-varying)
- Manually curate out anything overtly distasteful — Polymarket has
  some markets the README shouldn't be quoting. Editorial judgment
  applies to the corpus selection itself, not just the wiki layer.

## Redistribution / license

The Polymarket Data API is documented as public, no-auth, no API key.
On-chain data is in practice public-domain. The corpus we publish
alongside the README will be:

1. The list of selected `conditionId`s + market metadata snapshot
   (committed to repo as JSON, ~hundreds of KB)
2. The trades pulled for those markets, written to disk as JSONL in
   the envelope format above (NOT committed — produced by ingest, kept
   in `corpus/` which is gitignored)
3. A reproducible `the-stacks ingest --polymarket-corpus` flow so
   anyone can rebuild from scratch

This means the README demo runs against deterministic, reproducible
data without needing to ship gigabytes of trades in the repo.

## Open questions for #5 (ingest pipeline)

- Polymarket Data API rate limits — empirical, not documented. Worth
  finding out before doing 100-market backfill.
- Pagination strategy for high-volume markets (millions of trades per
  market for Trump-2024). Cursor-based, but how aggressive can we be?
- Trade-event chunking for embedding: each trade is small. Either we
  embed individual trades (volume), batch by time-window (probably
  better), or embed at the *market summary* level and let the wiki
  layer do the routing. Decision deferred — this is exactly the
  kind of thing #5 should figure out empirically.
- Live-update story for the dogfood. M1 is one-shot ingest. Streaming
  comes later (Goldsky becomes relevant again here, post-M3).
