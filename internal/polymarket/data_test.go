package polymarket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestAllTradesPagination(t *testing.T) {
	page1 := makeTrades(1000, 0)
	page2 := makeTrades(1000, 1000)
	page3 := makeTrades(523, 2000)

	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		var page []map[string]any
		switch offset {
		case 0:
			page = page1
		case 1000:
			page = page2
		case 2000:
			page = page3
		default:
			page = []map[string]any{}
		}
		calls++
		_ = json.NewEncoder(w).Encode(page)
	}))
	defer srv.Close()

	c := &DataClient{BaseURL: srv.URL, HTTP: srv.Client()}
	all, capped, err := c.AllTrades(context.Background(), "cond123", nil)
	if err != nil {
		t.Fatalf("AllTrades: %v", err)
	}
	if capped {
		t.Errorf("expected capped=false on natural end-of-data")
	}
	if want := 1000 + 1000 + 523; len(all) != want {
		t.Fatalf("got %d trades, want %d", len(all), want)
	}
	if calls != 3 {
		t.Fatalf("expected 3 HTTP calls, got %d", calls)
	}
}

func TestAllTradesStopsAtMaxOffset(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		page := makeTrades(1000, 0)
		_ = json.NewEncoder(w).Encode(page)
	}))
	defer srv.Close()
	c := &DataClient{BaseURL: srv.URL, HTTP: srv.Client()}
	all, capped, err := c.AllTrades(context.Background(), "cond", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !capped {
		t.Errorf("expected capped=true when API would always return full pages")
	}
	wantCalls := MaxHistoricalOffset/TradesPageSize + 1
	if calls != wantCalls {
		t.Errorf("calls = %d, want %d (offsets 0,%d,%d,%d)", calls, wantCalls, TradesPageSize, 2*TradesPageSize, MaxHistoricalOffset)
	}
	if len(all) != wantCalls*1000 {
		t.Errorf("trade count = %d, want %d", len(all), wantCalls*1000)
	}
}

func TestAllTradesEmptyFirstPage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("[]"))
	}))
	defer srv.Close()
	c := &DataClient{BaseURL: srv.URL, HTTP: srv.Client()}
	all, _, err := c.AllTrades(context.Background(), "cond", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 0 {
		t.Fatalf("want 0 trades, got %d", len(all))
	}
}

func TestTradesPageDecodesFixture(t *testing.T) {
	body, err := os.ReadFile(filepath.Join("testdata", "trades_sample.json"))
	if err != nil {
		t.Skip("no fixture")
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(body)
	}))
	defer srv.Close()
	c := &DataClient{BaseURL: srv.URL, HTTP: srv.Client()}
	page, err := c.TradesPage(context.Background(), "cond", 0, 1000)
	if err != nil {
		t.Fatalf("TradesPage: %v", err)
	}
	if len(page) == 0 {
		t.Fatal("expected trades from fixture")
	}
	for i, tr := range page {
		if tr.ConditionID == "" {
			t.Fatalf("trade %d has empty conditionId", i)
		}
		if tr.TransactionHash == "" {
			t.Fatalf("trade %d has empty transactionHash", i)
		}
		if len(tr.Raw) == 0 {
			t.Fatalf("trade %d has empty raw", i)
		}
	}
}

func makeTrades(n, baseOffset int) []map[string]any {
	out := make([]map[string]any, n)
	for i := 0; i < n; i++ {
		out[i] = map[string]any{
			"proxyWallet":     fmt.Sprintf("0x%040d", baseOffset+i),
			"side":            "BUY",
			"asset":           "asset123",
			"conditionId":     "cond123",
			"size":            1.0,
			"price":           0.5,
			"timestamp":       1000000 + baseOffset + i,
			"outcome":         "Yes",
			"outcomeIndex":    0,
			"transactionHash": fmt.Sprintf("0xtx%d", baseOffset+i),
		}
	}
	return out
}
