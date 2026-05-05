package cli

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func newFakePolymarket(t *testing.T, marketIDs []string, tradesByMarket map[string][]map[string]any) (gammaURL, dataURL string, cleanup func()) {
	t.Helper()

	gammaSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		out := make([]map[string]any, 0, len(marketIDs))
		for i, id := range marketIDs {
			out = append(out, map[string]any{
				"conditionId": id,
				"slug":        fmt.Sprintf("slug-%d", i),
				"question":    fmt.Sprintf("Q%d?", i),
				"startDate":   "",
				"endDate":     "",
				"active":      true,
				"closed":      false,
				"volumeNum":   1000.0 - float64(i),
			})
		}
		_ = json.NewEncoder(w).Encode(out)
	}))

	dataSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		market := r.URL.Query().Get("market")
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		all := tradesByMarket[market]
		if offset >= len(all) {
			_, _ = w.Write([]byte("[]"))
			return
		}
		_ = json.NewEncoder(w).Encode(all[offset:])
	}))

	return gammaSrv.URL, dataSrv.URL, func() {
		gammaSrv.Close()
		dataSrv.Close()
	}
}

func makeTrade(idx int, conditionID string) map[string]any {
	return map[string]any{
		"proxyWallet":     fmt.Sprintf("0x%040d", idx),
		"side":            "BUY",
		"asset":           "asset-A",
		"conditionId":     conditionID,
		"size":            1.0,
		"price":           0.5,
		"timestamp":       1700000000 + idx,
		"outcome":         "Yes",
		"outcomeIndex":    0,
		"transactionHash": fmt.Sprintf("0xtx%d", idx),
		"eventSlug":       "evt",
	}
}

func TestRunPullResumeIsNoop(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "raw.db")
	statsPath := filepath.Join(tmp, "stats.json")

	trades := map[string][]map[string]any{
		"cond-A": {makeTrade(1, "cond-A"), makeTrade(2, "cond-A"), makeTrade(3, "cond-A")},
		"cond-B": {makeTrade(4, "cond-B")},
	}
	gURL, dURL, cleanup := newFakePolymarket(t, []string{"cond-A", "cond-B"}, trades)
	defer cleanup()

	args := []string{
		"--markets-limit", "2",
		"--db", dbPath,
		"--blocklist", "",
		"--stats", statsPath,
		"--gamma-url", gURL,
		"--data-url", dURL,
	}

	var out, errOut bytes.Buffer
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("first run: %v\n%s", err, errOut.String())
	}

	out.Reset()
	errOut.Reset()
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("second run: %v\n%s", err, errOut.String())
	}
	if !strings.Contains(out.String(), "already pulled") {
		t.Errorf("expected resume to log 'already pulled'; got:\n%s", out.String())
	}

	tradeCount := dbScalar(t, dbPath, "SELECT COUNT(*) FROM trades")
	if tradeCount != 4 {
		t.Errorf("expected 4 trades after resume, got %d", tradeCount)
	}
}

func TestRunPullBlocklist(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "raw.db")
	blPath := filepath.Join(tmp, "blocklist.json")

	bl := Blocklist{
		ConditionIDs: []string{"cond-B"},
		Reasons:      map[string]string{"cond-B": "test reason"},
	}
	b, _ := json.Marshal(bl)
	_ = os.WriteFile(blPath, b, 0o644)

	trades := map[string][]map[string]any{
		"cond-A": {makeTrade(1, "cond-A")},
		"cond-B": {makeTrade(2, "cond-B")},
	}
	gURL, dURL, cleanup := newFakePolymarket(t, []string{"cond-A", "cond-B"}, trades)
	defer cleanup()

	args := []string{
		"--markets-limit", "2",
		"--db", dbPath,
		"--blocklist", blPath,
		"--stats", filepath.Join(tmp, "stats.json"),
		"--gamma-url", gURL,
		"--data-url", dURL,
	}

	var out, errOut bytes.Buffer
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("RunPull: %v\n%s", err, errOut.String())
	}

	if dbScalar(t, dbPath, "SELECT COUNT(*) FROM markets WHERE condition_id='cond-B'") != 0 {
		t.Errorf("blocked market should not be in markets table")
	}
	if dbScalar(t, dbPath, "SELECT COUNT(*) FROM markets WHERE condition_id='cond-A'") != 1 {
		t.Errorf("non-blocked market should be in markets table")
	}
	if dbScalar(t, dbPath, "SELECT COUNT(*) FROM trades WHERE condition_id='cond-B'") != 0 {
		t.Errorf("blocked market should have no trades")
	}
}

func TestRunPullStatsTaxonomy(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "raw.db")
	statsPath := filepath.Join(tmp, "stats.json")
	blPath := filepath.Join(tmp, "blocklist.json")

	bl := Blocklist{ConditionIDs: []string{"cond-B"}, Reasons: map[string]string{"cond-B": "blocked"}}
	b, _ := json.Marshal(bl)
	_ = os.WriteFile(blPath, b, 0o644)

	trades := map[string][]map[string]any{
		"cond-A": {makeTrade(1, "cond-A")},
		"cond-B": {makeTrade(2, "cond-B")},
		"cond-C": {makeTrade(3, "cond-C")},
	}
	gURL, dURL, cleanup := newFakePolymarket(t, []string{"cond-A", "cond-B", "cond-C"}, trades)
	defer cleanup()

	args := []string{
		"--markets-limit", "3",
		"--db", dbPath,
		"--blocklist", blPath,
		"--stats", statsPath,
		"--gamma-url", gURL,
		"--data-url", dURL,
	}
	var out, errOut bytes.Buffer
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("first run: %v\n%s", err, errOut.String())
	}

	out.Reset()
	errOut.Reset()
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("second run: %v\n%s", err, errOut.String())
	}

	statsBytes, err := os.ReadFile(statsPath)
	if err != nil {
		t.Fatal(err)
	}
	var runs []map[string]any
	if err := json.Unmarshal(statsBytes, &runs); err != nil {
		t.Fatal(err)
	}
	if len(runs) != 2 {
		t.Fatalf("expected 2 stat runs, got %d", len(runs))
	}
	last := runs[1]
	if got := int(last["markets_resumed"].(float64)); got != 2 {
		t.Errorf("markets_resumed = %d, want 2 (cond-A, cond-C)", got)
	}
	if got := int(last["markets_blocked"].(float64)); got != 1 {
		t.Errorf("markets_blocked = %d, want 1 (cond-B)", got)
	}
	if got := int(last["markets_failed"].(float64)); got != 0 {
		t.Errorf("markets_failed = %d, want 0", got)
	}
	if got := int(last["markets_pulled"].(float64)); got != 0 {
		t.Errorf("markets_pulled on second run = %d, want 0", got)
	}
}

func TestRunPullFailureExitsNonZero(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "raw.db")

	gammaSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{{
			"conditionId": "cond-X", "slug": "x", "question": "Q?",
			"active": true, "closed": false, "volumeNum": 1.0,
		}})
	}))
	defer gammaSrv.Close()
	dataSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "synthetic upstream failure", http.StatusInternalServerError)
	}))
	defer dataSrv.Close()

	args := []string{
		"--markets-limit", "1",
		"--db", dbPath,
		"--blocklist", "",
		"--stats", filepath.Join(tmp, "stats.json"),
		"--gamma-url", gammaSrv.URL,
		"--data-url", dataSrv.URL,
	}
	var out, errOut bytes.Buffer
	err := RunPull(context.Background(), args, &out, &errOut)
	if err == nil {
		t.Fatalf("expected non-nil error when a market fetch fails; out=%s err=%s", out.String(), errOut.String())
	}
	if !strings.Contains(err.Error(), "failed during pull") {
		t.Errorf("error didn't mention pull failure, got: %v", err)
	}
}

func TestAppendStatHandlesCorruptFile(t *testing.T) {
	tmp := t.TempDir()
	statsPath := filepath.Join(tmp, "stats.json")
	if err := os.WriteFile(statsPath, []byte("not json at all"), 0o644); err != nil {
		t.Fatal(err)
	}

	var stderr bytes.Buffer
	if err := appendStat(statsPath, runStat{TradesInserted: 42}, &stderr); err != nil {
		t.Fatalf("appendStat should warn-and-continue, got error: %v", err)
	}
	if !strings.Contains(stderr.String(), "unreadable") {
		t.Errorf("expected stderr warning, got: %s", stderr.String())
	}

	out, err := os.ReadFile(statsPath)
	if err != nil {
		t.Fatal(err)
	}
	var runs []runStat
	if err := json.Unmarshal(out, &runs); err != nil {
		t.Fatalf("file should be valid JSON after recovery, got: %v\n%s", err, out)
	}
	if len(runs) != 1 || runs[0].TradesInserted != 42 {
		t.Errorf("expected single fresh entry, got %+v", runs)
	}
}

func TestRunPullMissingBlocklistOK(t *testing.T) {
	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "raw.db")

	trades := map[string][]map[string]any{"cond-A": {makeTrade(1, "cond-A")}}
	gURL, dURL, cleanup := newFakePolymarket(t, []string{"cond-A"}, trades)
	defer cleanup()

	args := []string{
		"--markets-limit", "1",
		"--db", dbPath,
		"--blocklist", filepath.Join(tmp, "does-not-exist.json"),
		"--stats", filepath.Join(tmp, "stats.json"),
		"--gamma-url", gURL,
		"--data-url", dURL,
	}
	var out, errOut bytes.Buffer
	if err := RunPull(context.Background(), args, &out, &errOut); err != nil {
		t.Fatalf("RunPull: %v\n%s", err, errOut.String())
	}
	if dbScalar(t, dbPath, "SELECT COUNT(*) FROM trades") != 1 {
		t.Errorf("expected 1 trade")
	}
}

func dbScalar(t *testing.T, path, query string) int {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	var n int
	if err := db.QueryRow(query).Scan(&n); err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	return n
}
