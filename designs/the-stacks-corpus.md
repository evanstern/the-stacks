# The Stacks — M1 demo corpus

> **Status:** decided 2026-05-05
> **Decision:** Polymarket public Data API. Top-N markets by volume,
> default **N=10** for the published demo, configurable up to 100 for
> those running their own embed.
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
  10-market subset puts us comfortably in the millions-of-events
  range. (See "Sizing" below for the scaling table.)
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

The envelope `{source, tags, when, data}` is the **contract** —
the cross-source schema The Stacks speaks. It is *not* the on-disk
storage format. Storage is sqlite (see #5 for schema), and the
envelope is materializable via the `trades_envelope` SQL view. JSONL
export is available on demand via `the-stacks export-jsonl` if
needed for piping into other tools.

A Polymarket **trade** maps to the envelope as:

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

## Scope criterion (top-N markets)

```
GET https://gamma-api.polymarket.com/markets
    ?order=volumeNum
    &ascending=false
    &limit=N
```

**Default N = 10** for the published `stacks.db` artifact (see #13).
Anyone wanting to rebuild a larger corpus can pass
`the-stacks pull --markets-limit 100` and re-embed locally.

Filter rules to firm up in the ingest card (#5):

- Skip markets with `volumeNum < $X` (TBD — sanity floor)
- Bias toward `closed=true` for the demo (resolved markets have a
  complete narrative arc; active markets are noisy and time-varying)
- Manually curate out anything overtly distasteful — Polymarket has
  some markets the README shouldn't be quoting. Editorial judgment
  applies to the corpus selection itself, not just the wiki layer.

## Sizing

All numbers measured 2026-05-05 against the live API:

- Mean trade USD value: ~$31 (median ~$16)
- Per-trade row size in raw sqlite: ~700 bytes (envelope-aware
  columns + JSON1 `data`/`tags`)
- API page max: 1000 trades, ~0.1-0.7s latency per page
- Top-100 markets total volume: $2.78B → ~93M estimated trades

Scaling table, **chunk strategy B** (one chunk per 1-hour window
per market — see #11 for strategy comparison):

| Scope | raw.db (sqlite) | stacks.db (chunks+vectors) | Pull (5x conc) | Embed (CPU) |
|---|---|---|---|---|
| top-1 | ~1.4 GB | ~31 MB | ~3 min | ~2 min |
| top-3 | ~3.6 GB | ~92 MB | ~7 min | ~5 min |
| **top-10 (demo default)** | **~6.5 GB** | **~307 MB** | **~13 min** | **~15 min** |
| top-25 | ~16 GB | ~770 MB | ~30 min | ~37 min |
| top-100 | ~60 GB | ~3 GB | ~2.5 hrs | ~2.5 hrs |

`raw.db` lives on the refresh host (us), never ships. `stacks.db`
is the published artifact (#13) — small, self-contained, what
readers download.

Reader-side hardware (running the published demo): ~500 MB disk
for the downloaded `stacks.db.gz`, a few hundred MB RAM, no GPU.
The reader never pulls or embeds — they
`the-stacks fetch-corpus` (#13) and start querying.

**Why top-10 not top-100 as default:** The architectural opinion
is fully demonstrated at 10 famous markets (~10M trades, sub-second
queries on the resulting DB). Going to top-100 multiplies cost
~10x without proportional gain in legibility or "the demo
convinces me" weight. top-100 stays available via flag for
anyone who wants to push it.

**Where the embed actually runs:** Free-tier GCP e2-micro is the
target host for the periodic corpus refresh (744 vCPU-hr/month
free tier covers a top-10 embed easily). Local laptop also works
for top-10 (~30 min total). top-100 wants more — we're not
hosting top-100 in v0.

## Redistribution / license

The Polymarket Data API is documented as public, no-auth, no API key.
On-chain data is in practice public-domain. The corpus shipping
flow:

1. **Selected market list** — committed to repo as JSON
   (`corpus/markets-top10.json`, ~tens of KB).
2. **Raw ledger (`raw.db`)** — produced by `the-stacks pull`, NOT
   committed and NOT shipped. Lives on the refresh host (free-tier
   e2-micro or local laptop). Held there because re-chunking
   experiments (#11) read from it cheaply, but readers don't need
   it to query.
3. **Pre-built `stacks.db`** — produced by `the-stacks embed` from
   `raw.db`. Carries chunks + vectors + denormalized market
   context (so it's self-contained for serving). Published as a
   GitHub Release artifact (see #13). Gzipped, with a sha256
   sidecar. ~150 MB download, decompresses to ~300 MB.
4. **Reproducible refresh path** —
   `the-stacks pull && the-stacks embed && gh release create ...`
   documented in `docs/publishing-corpus.md` (created in #13).

Reader's path: `the-stacks fetch-corpus` (~30 sec, no Ollama
needed) → `the-stacks ask "..."`. Pull and embed are *our* tools,
not theirs.

## Open questions for downstream cards

For #5 (pull):
- Polymarket Data API rate limits — empirical, not documented.
  Document observed limits in this doc after the first real top-10
  run.
- Pagination cursor patterns for high-volume markets. Verified
  page max = 1000 trades.

For #11 (embed):
- Trade-event chunking. Three strategies described in #11; pick
  empirically against a 5-market subset, document the lock-in
  back into this doc.
- Embedding model: `nomic-embed-text` is the default; revisit only
  if retrieval quality is bad.

Out of scope for M1:
- Live-update / streaming corpus. Goldsky becomes relevant here,
  post-M3.
