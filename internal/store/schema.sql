CREATE TABLE IF NOT EXISTS markets (
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

CREATE TABLE IF NOT EXISTS trades (
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

CREATE INDEX IF NOT EXISTS idx_trades_when
  ON trades(when_unix);
CREATE INDEX IF NOT EXISTS idx_trades_market_when
  ON trades(condition_id, when_unix);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trades_tx
  ON trades(tx_hash, asset, side);

CREATE VIEW IF NOT EXISTS trades_envelope AS
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
