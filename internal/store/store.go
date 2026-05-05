// Package store wraps the sqlite ledger: open + migrate + write paths for
// the markets and trades tables.
package store

import (
	"database/sql"
	_ "embed"
	"fmt"
	"time"

	"github.com/evanstern/the-stacks/internal/envelope"
	"github.com/evanstern/the-stacks/internal/polymarket"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

type Store struct {
	DB *sql.DB
}

// Open opens (or creates) a sqlite DB at path, applies migrations, and sets
// WAL + synchronous=NORMAL + foreign_keys=ON pragmas.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	for _, p := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA foreign_keys=ON",
	} {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", p, err)
		}
	}
	if _, err := db.Exec(schemaSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// UpsertMarket inserts or updates a single market row.
func (s *Store) UpsertMarket(m polymarket.Market) error {
	startUnix := isoToUnix(m.StartDate)
	endUnix := isoToUnix(m.EndDate)
	_, err := s.DB.Exec(`
		INSERT INTO markets (condition_id, slug, question, start_date, end_date, active, closed, volume_num, raw)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(condition_id) DO UPDATE SET
			slug=excluded.slug,
			question=excluded.question,
			start_date=excluded.start_date,
			end_date=excluded.end_date,
			active=excluded.active,
			closed=excluded.closed,
			volume_num=excluded.volume_num,
			raw=excluded.raw
	`,
		m.ConditionID, m.Slug, m.Question, startUnix, endUnix,
		boolToInt(m.Active), boolToInt(m.Closed), m.VolumeNum, string(m.Raw),
	)
	if err != nil {
		return fmt.Errorf("upsert market %s: %w", m.ConditionID, err)
	}
	return nil
}

// MarketHasTrades returns (exists, tradeCount).
func (s *Store) MarketHasTrades(conditionID string) (bool, int, error) {
	var exists int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM markets WHERE condition_id = ?", conditionID).Scan(&exists); err != nil {
		return false, 0, err
	}
	if exists == 0 {
		return false, 0, nil
	}
	var n int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM trades WHERE condition_id = ?", conditionID).Scan(&n); err != nil {
		return true, 0, err
	}
	return true, n, nil
}

// InsertTrades writes a batch of trade rows under a single transaction using
// INSERT OR IGNORE against uq_trades_tx so re-pulls dedup naturally.
// Returns the number of rows actually inserted.
func (s *Store) InsertTrades(rows []envelope.Row) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	tx, err := s.DB.Begin()
	if err != nil {
		return 0, err
	}
	stmt, err := tx.Prepare(`
		INSERT OR IGNORE INTO trades
		(source, when_unix, condition_id, asset, side, outcome, outcome_idx, size, price, proxy_wallet, tx_hash, tags, data)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	defer stmt.Close()

	inserted := 0
	for _, r := range rows {
		res, err := stmt.Exec(r.Source, r.WhenUnix, r.ConditionID, r.Asset, r.Side, r.Outcome, r.OutcomeIndex, r.Size, r.Price, r.ProxyWallet, r.TxHash, r.TagsJSON, r.DataJSON)
		if err != nil {
			_ = tx.Rollback()
			return inserted, err
		}
		n, err := res.RowsAffected()
		if err != nil {
			_ = tx.Rollback()
			return inserted, fmt.Errorf("rows affected: %w", err)
		}
		inserted += int(n)
	}
	if err := tx.Commit(); err != nil {
		return inserted, err
	}
	return inserted, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// isoToUnix parses an ISO 8601 timestamp like "2026-12-31T00:00:00Z" and
// returns it as int64 unix seconds, or untyped-nil if empty/unparseable.
// The any return type lets database/sql bind it as SQL NULL when nil.
func isoToUnix(s string) any {
	if s == "" {
		return nil
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			u := t.Unix()
			return u
		}
	}
	return nil
}
