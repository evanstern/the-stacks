---
schema_version: 2
id: 5
uuid: 019df5c3-a6be-747d-a297-f7bab8ae3716
title: Pull Polymarket trades to local JSONL corpus
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Pull Polymarket trades to local JSONL corpus

The corpus → local-disk path. Selects the top-N markets from Gamma, pulls every trade for each via Data API `/trades`, writes them to JSONL in the standard envelope.

This is the network-bound stage. Embed pipeline is a separate card (see #11).

**Blocked by:** #4 (corpus pick — done), #9 (Go 1.25 — done)

## Shape

Single subcommand: `the-stacks pull`.

```
the-stacks pull \
  --markets-limit 10 \
  --out ./corpus/polymarket
```

`--markets-limit` defaults to **10** — see #12 / corpus design doc
for sizing rationale. Configurable up to 100 for those who want to
push it.

Steps the binary performs:

1. **Select markets.** Hit `gamma-api.polymarket.com/markets`, `?order=volumeNum&ascending=false&limit=N`, take the top N. Apply filters (sanity floor on `volumeNum`, prefer `closed=true`, manual block-list for distasteful markets). Write the selected market metadata to `<out>/markets.json` (single file, all selected markets).
2. **Pull trades per market.** For each `conditionId`, paginate `data-api.polymarket.com/trades?market=<conditionId>` using the cursor pattern. Write trades to `<out>/trades/<slug>.jsonl`, one trade per line in the envelope format defined in `designs/the-stacks-corpus.md`.
3. **Resume-friendly.** If the JSONL for a market already exists, skip unless `--refresh`. Lets us iterate on the loader without re-pulling.
4. **Progress + rate-limit awareness.** Log per-market progress ("[3/10] dumping market 'will-trump-...' — 47823 trades"). Back off on 429s. Document observed rate limits in the corpus design doc afterward.

## Envelope (recap, full def in design doc)

```json
{
  "source": "polymarket.trade",
  "tags": ["polymarket", "<eventSlug>", "<outcome>", "<side>",
           "<resolved-or-active>"],
  "when": "<ISO-8601 from timestamp>",
  "data": { ...trade fields... }
}
```

## Done when

- `the-stacks pull --markets-limit 3 --out /tmp/test` runs end-to-end (small N for fast iteration)
- `the-stacks pull --markets-limit 10 --out ./corpus/polymarket` runs end-to-end without manual babysitting (the demo default)
- `the-stacks pull --markets-limit 100 ...` is also possible (no hardcoded ceiling), but is not the demo target
- `corpus/polymarket/markets.json` lists the selected markets with full metadata
- `corpus/polymarket/trades/<slug>.jsonl` exists per market, one trade-envelope per line, well-formed JSON each
- Re-running with same args is a no-op (resume works)
- Observed rate limits + total trade count documented in `designs/the-stacks-corpus.md` "API shape" section
- One unit test per non-trivial function (pagination cursor logic, envelope mapping correctness, resume detection)

## Open questions to resolve in implementation

- **Rate limits.** Empirical. Probably fine for single-threaded pulls. If concurrency helps and rate limit is permissive, consider a small worker pool.
- **Market block-list.** Polymarket has some markets the README shouldn't be quoting. Probably a small JSON file in the repo: `corpus/blocklist.json` with conditionIds to skip. Build the flow even if the list starts empty.
- **What about closed markets with stale conditionIds?** Some resolved markets might have moved or been re-keyed. Be defensive — skip and log, don't crash.
- **Storage layout.** One JSONL per market is the proposed default. Alternative: one big JSONL for everything. One-per-market wins on resume + on partial corpus development; locking that.

## Notes

This card was originally "Build ingest + embed pipeline." Split 2026-05-05 after the #4 corpus reframe — pull and embed are genuinely separate stages for an event-ledger corpus, and splitting lets us iterate on chunking strategy cheaply against local JSONL without re-pulling.

Embed pipeline lives at #11.
