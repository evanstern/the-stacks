package store

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/evanstern/the-stacks/internal/envelope"
	"github.com/evanstern/the-stacks/internal/polymarket"
)

func TestMigrationIdempotent(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	for i := 0; i < 3; i++ {
		s, err := Open(dbPath)
		if err != nil {
			t.Fatalf("Open #%d: %v", i, err)
		}
		s.Close()
	}
}

func TestUpsertMarketAndDateParsing(t *testing.T) {
	s, _ := Open(filepath.Join(t.TempDir(), "t.db"))
	defer s.Close()

	m := polymarket.Market{
		ConditionID: "cond1",
		Slug:        "slug",
		Question:    "Q?",
		StartDate:   "2025-11-25T18:08:21.296Z",
		EndDate:     "2026-12-31T00:00:00Z",
		Active:      true,
		Closed:      false,
		VolumeNum:   12345.6,
		Raw:         json.RawMessage(`{"foo":"bar"}`),
	}
	if err := s.UpsertMarket(m); err != nil {
		t.Fatal(err)
	}

	var startUnix, endUnix int64
	row := s.DB.QueryRow("SELECT start_date, end_date FROM markets WHERE condition_id = ?", "cond1")
	if err := row.Scan(&startUnix, &endUnix); err != nil {
		t.Fatal(err)
	}
	if startUnix == 0 || endUnix == 0 {
		t.Errorf("expected parsed unix dates, got start=%d end=%d", startUnix, endUnix)
	}

	m.Question = "Q updated?"
	if err := s.UpsertMarket(m); err != nil {
		t.Fatal(err)
	}
	var q string
	_ = s.DB.QueryRow("SELECT question FROM markets WHERE condition_id = ?", "cond1").Scan(&q)
	if q != "Q updated?" {
		t.Errorf("upsert did not update question, got %q", q)
	}
}

func TestInsertTradesIdempotent(t *testing.T) {
	s, _ := Open(filepath.Join(t.TempDir(), "t.db"))
	defer s.Close()

	m := polymarket.Market{ConditionID: "cond1", Slug: "s", Question: "Q?", Active: true, Raw: json.RawMessage(`{}`)}
	if err := s.UpsertMarket(m); err != nil {
		t.Fatal(err)
	}

	rows := []envelope.Row{
		{Source: "polymarket.trade", WhenUnix: 100, ConditionID: "cond1", Asset: "a1", Side: "BUY", Outcome: "Yes", OutcomeIndex: 0, Size: 1, Price: 0.5, ProxyWallet: "0x1", TxHash: "0xtx1", TagsJSON: "[]", DataJSON: "{}"},
		{Source: "polymarket.trade", WhenUnix: 101, ConditionID: "cond1", Asset: "a1", Side: "SELL", Outcome: "Yes", OutcomeIndex: 0, Size: 2, Price: 0.6, ProxyWallet: "0x2", TxHash: "0xtx2", TagsJSON: "[]", DataJSON: "{}"},
	}
	n1, err := s.InsertTrades(rows)
	if err != nil {
		t.Fatal(err)
	}
	if n1 != 2 {
		t.Errorf("first insert: got %d rows, want 2", n1)
	}

	n2, err := s.InsertTrades(rows)
	if err != nil {
		t.Fatal(err)
	}
	if n2 != 0 {
		t.Errorf("second insert: got %d rows, want 0 (dedup)", n2)
	}

	var count int
	_ = s.DB.QueryRow("SELECT COUNT(*) FROM trades").Scan(&count)
	if count != 2 {
		t.Errorf("trade count = %d, want 2", count)
	}
}

func TestMarketHasTrades(t *testing.T) {
	s, _ := Open(filepath.Join(t.TempDir(), "t.db"))
	defer s.Close()

	exists, n, _ := s.MarketHasTrades("nope")
	if exists || n != 0 {
		t.Errorf("missing market: exists=%v n=%d", exists, n)
	}

	m := polymarket.Market{ConditionID: "cond1", Slug: "s", Question: "Q?", Raw: json.RawMessage(`{}`)}
	_ = s.UpsertMarket(m)
	exists, n, _ = s.MarketHasTrades("cond1")
	if !exists || n != 0 {
		t.Errorf("market without trades: exists=%v n=%d", exists, n)
	}

	_, _ = s.InsertTrades([]envelope.Row{
		{Source: "polymarket.trade", WhenUnix: 1, ConditionID: "cond1", Asset: "a", Side: "BUY", Outcome: "Y", Size: 1, Price: 0.5, ProxyWallet: "w", TxHash: "tx", TagsJSON: "[]", DataJSON: "{}"},
	})
	exists, n, _ = s.MarketHasTrades("cond1")
	if !exists || n != 1 {
		t.Errorf("market with trades: exists=%v n=%d", exists, n)
	}
}

func TestTradesEnvelopeView(t *testing.T) {
	s, _ := Open(filepath.Join(t.TempDir(), "t.db"))
	defer s.Close()

	m := polymarket.Market{ConditionID: "cond1", Slug: "the-slug", Question: "The Question?", Raw: json.RawMessage(`{}`)}
	_ = s.UpsertMarket(m)
	_, _ = s.InsertTrades([]envelope.Row{
		{Source: "polymarket.trade", WhenUnix: 1700000000, ConditionID: "cond1", Asset: "a1", Side: "BUY", Outcome: "Yes", OutcomeIndex: 0, Size: 1.5, Price: 0.7, ProxyWallet: "0xw", TxHash: "0xtx", TagsJSON: `["polymarket"]`, DataJSON: `{}`},
	})

	var source, tags, whenISO, dataJSON string
	err := s.DB.QueryRow("SELECT source, tags, when_iso, data FROM trades_envelope LIMIT 1").Scan(&source, &tags, &whenISO, &dataJSON)
	if err != nil {
		t.Fatal(err)
	}
	if source != "polymarket.trade" {
		t.Errorf("source = %q", source)
	}
	if whenISO != "2023-11-14T22:13:20Z" {
		t.Errorf("when_iso = %q", whenISO)
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
		t.Fatal(err)
	}
	if data["title"] != "The Question?" {
		t.Errorf("view didn't join title, got %v", data["title"])
	}
	if data["marketSlug"] != "the-slug" {
		t.Errorf("view didn't join marketSlug, got %v", data["marketSlug"])
	}
	if data["conditionId"] != "cond1" || data["asset"] != "a1" {
		t.Errorf("view missing identifying cols")
	}
}
