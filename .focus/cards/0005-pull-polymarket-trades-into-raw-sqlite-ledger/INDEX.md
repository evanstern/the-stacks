---
schema_version: 2
id: 5
uuid: 019df5c3-a6be-747d-a297-f7bab8ae3716
title: Pull Polymarket trades into raw sqlite ledger
type: card
status: active
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Pull Polymarket trades into raw sqlite ledger

The corpus → local-storage path. Selects the top-N markets from
Gamma, pulls every trade for each via Data API `/trades`, writes
them as rows into a sqlite file with columns mirroring our envelope
contract.

This is the network-bound stage. Embed pipeline (#11) reads from
this DB.

**Blocked by:** #4 (corpus pick — done), #9 (Go 1.25 — done),
#12 (sizing — done)

## Storage model

Single sqlite file (default `./corpus/raw.db`). Two tables:

```sql
CREATE TABLE markets (
  condition_id  TEXT PRIMARY KEY,
  slug          TEXT NOT NULL,
  question      TEXT NOT NULL,
  start_date    INTEGER,
  end_date      INTEGER,
  active        INTEGER NOT NULL,
  closed        INTEGER NOT NULL,
  volume_num    REAL NOT NULL,
  raw           TEXT NOT NULL
);

CREATE TABLE trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT NOT NULL,
  when_unix     INTEGER NOT NULL,
  condition_id  TEXT NOT NULL,
  asset         TEXT NOT NULL,
  side          TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  outcome_idx   INTEGER NOT NULL,
  size          REAL NOT NULL,
  price         REAL NOT NULL,
  proxy_wallet  TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  tags          TEXT NOT NULL,
  data          TEXT NOT NULL,
  FOREIGN KEY (condition_id) REFERENCES markets(condition_id)
);

CREATE INDEX idx_trades_when         ON trades(when_unix);
CREATE INDEX idx_trades_market_when  ON trades(condition_id, when_unix);
CREATE UNIQUE INDEX uq_trades_tx     ON trades(tx_hash, asset, side);
```

`tags`, `data`, and `raw` are sqlite JSON1, indexable on JSON
expressions if we need to (start without).

The envelope `{source, tags, when, data}` is materializable as a
view over `trades`:

```sql
CREATE VIEW trades_envelope AS
SELECT
  source,
  tags,
  strftime('%Y-%m-%dT%H:%M:%SZ', when_unix, 'unixepoch') AS when_iso,
  json_object(
    'conditionId', condition_id, 'asset', asset,
    'size', size, 'price', price, 'side', side,
    'outcome', outcome, 'outcomeIndex', outcome_idx,
    'proxyWallet', proxy_wallet, 'transactionHash', tx_hash,
    'title', (SELECT question FROM markets m
              WHERE m.condition_id = trades.condition_id),
    'marketSlug', (SELECT slug FROM markets m
                   WHERE m.condition_id = trades.condition_id)
  ) AS data
FROM trades;
```

That view is what a future `the-stacks export-jsonl` would dump.

## Shape

Single subcommand: `the-stacks pull`.

```
the-stacks pull \
  --markets-limit 10 \
  --db ./corpus/raw.db
```

`--markets-limit` defaults to **10** (per #12). Configurable up to
100 for those who want to push it.

Steps the binary performs:

1. **Open / create DB.** Apply migrations (CREATE TABLE IF NOT
   EXISTS for the schema above). Idempotent.
2. **Select markets.** Hit
   `gamma-api.polymarket.com/markets?order=volumeNum&ascending=false&limit=N`,
   apply filters (sanity floor, prefer `closed=true`, blocklist).
   UPSERT into `markets`.
3. **Pull trades per market.** For each `condition_id`, paginate
   `data-api.polymarket.com/trades?market=<conditionId>` using the
   cursor pattern. INSERT each trade with `INSERT OR IGNORE` against
   the `uq_trades_tx` constraint, so re-pulls don't duplicate rows.
4. **Resume-friendly.** Skip markets whose newest stored
   `when_unix` is close to the API's reported newest, unless
   `--refresh`. Lets us iterate without re-pulling.
5. **Progress + rate-limit awareness.** Log per-market progress
   ("[3/10] dumping market 'will-trump-...' — 47823 trades, 3.2s").
   Back off on 429s. Document observed rate limits in
   `designs/the-stacks-corpus.md` afterward.

## Done when

- `the-stacks pull --markets-limit 3 --db /tmp/test.db` runs
  end-to-end (small N for fast iteration)
- `the-stacks pull --markets-limit 10 --db ./corpus/raw.db` runs
  end-to-end without manual babysitting (the demo default)
- `the-stacks pull --markets-limit 100 ...` is also possible
  (no hardcoded ceiling), but is not the demo target
- Schema matches the spec above; migrations idempotent
- `markets` table populated for all selected markets
- `trades` table populated, one row per trade in
  envelope-aware columns
- `trades_envelope` view returns valid envelope shape (verifiable
  via a single `SELECT` test)
- Re-running with same args is a near-no-op: skips markets we
  already have unless `--refresh`; INSERT OR IGNORE handles
  partial-state gracefully
- Observed rate limits + total trade count documented in
  `designs/the-stacks-corpus.md` "API shape" section
- One unit test per non-trivial function:
  - Pagination cursor traversal
  - Trade → row mapping correctness (round-trip envelope view)
  - Resume detection (no duplicate inserts on re-run)
  - Migration idempotency

## Open questions to resolve in implementation

- **Rate limits.** Empirical. Probably fine for single-threaded
  pulls. If concurrency helps, consider a small worker pool.
- **Market block-list.** `corpus/blocklist.json` with conditionIds
  to skip. Build the flow even if the list starts empty.
- **Stale conditionIds.** Some resolved markets might have moved
  or been re-keyed. Be defensive — skip and log, don't crash.
- **Trade uniqueness.** `tx_hash + asset + side` is the proposed
  natural key (a single tx can produce multiple Order Filled
  events from buyer + seller perspectives). Verify in
  implementation; widen if collisions surface.
- **WAL mode / pragma settings.** Standard sqlite tuning for
  bulk writes. Set `PRAGMA journal_mode=WAL`,
  `synchronous=NORMAL` during pull.

## Notes

Card history:
- Originally "Build ingest + embed pipeline" against a markdown
  corpus.
- Split 2026-05-05 into pull (#5) + embed (#11) for the
  event-ledger reframe.
- **Rewritten same-day 2026-05-05** to use sqlite for raw events
  instead of JSONL, after Evan flagged that JSONL-as-intermediate
  isn't standard for RAG and that ledger data wants a structured
  store. SQL-native raw layer also makes M2 wiki routing far
  more expressive (`scope: { sql: "..." }` over
  `scope: { paths: [...] }`).

Embed pipeline lives at #11. Release artifact at #13.
