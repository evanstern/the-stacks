// Package cli holds the-stacks subcommand entrypoints. Each exported Run*
// function is dispatched from cmd/the-stacks/main.go.
package cli

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/evanstern/the-stacks/internal/envelope"
	"github.com/evanstern/the-stacks/internal/polymarket"
	"github.com/evanstern/the-stacks/internal/store"
)

type pullFlags struct {
	marketsLimit int
	dbPath       string
	refresh      bool
	blocklist    string
	concurrency  int
	statsPath    string
	gammaURL     string
	dataURL      string
}

type Blocklist struct {
	ConditionIDs []string          `json:"condition_ids"`
	Reasons      map[string]string `json:"reasons"`
}

type runStat struct {
	StartedAt        string  `json:"started_at"`
	FinishedAt       string  `json:"finished_at"`
	MarketsRequested int     `json:"markets_requested"`
	MarketsPulled    int     `json:"markets_pulled"`
	MarketsSkipped   int     `json:"markets_skipped"`
	TradesInserted   int     `json:"trades_inserted"`
	ElapsedSeconds   float64 `json:"elapsed_seconds"`
	PeakRatePerSec   float64 `json:"peak_rate_per_sec"`
	Concurrency      int     `json:"concurrency"`
	MarketsLimit     int     `json:"markets_limit"`
}

// RunPull is the entrypoint for `the-stacks pull`. args is os.Args[2:].
func RunPull(ctx context.Context, args []string, stdout, stderr io.Writer) error {
	f := pullFlags{}
	fs := flag.NewFlagSet("pull", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.IntVar(&f.marketsLimit, "markets-limit", 10, "number of top-volume markets to pull")
	fs.StringVar(&f.dbPath, "db", "./corpus/raw.db", "sqlite database path")
	fs.BoolVar(&f.refresh, "refresh", false, "re-fetch markets we already have data for")
	fs.StringVar(&f.blocklist, "blocklist", "./corpus/blocklist.json", "blocklist JSON path (optional)")
	fs.IntVar(&f.concurrency, "concurrency", 1, "concurrent market fetches (default 1)")
	fs.StringVar(&f.statsPath, "stats", "./corpus/pull-stats.json", "JSON manifest of run stats")
	fs.StringVar(&f.gammaURL, "gamma-url", polymarket.DefaultGammaBaseURL, "gamma API base URL (override for tests)")
	fs.StringVar(&f.dataURL, "data-url", polymarket.DefaultDataBaseURL, "data API base URL (override for tests)")

	if err := fs.Parse(args); err != nil {
		return err
	}
	if f.marketsLimit <= 0 {
		return fmt.Errorf("--markets-limit must be > 0")
	}
	if f.concurrency != 1 {
		fmt.Fprintln(stderr, "warning: --concurrency != 1 not implemented in this PR; running serially")
	}

	if err := os.MkdirAll(filepath.Dir(f.dbPath), 0o755); err != nil {
		return fmt.Errorf("mkdir db dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(f.statsPath), 0o755); err != nil {
		return fmt.Errorf("mkdir stats dir: %w", err)
	}

	bl, err := loadBlocklist(f.blocklist)
	if err != nil {
		return err
	}
	blocked := map[string]string{}
	for _, id := range bl.ConditionIDs {
		blocked[id] = bl.Reasons[id]
	}

	st, err := store.Open(f.dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	gamma := &polymarket.GammaClient{BaseURL: f.gammaURL, HTTP: defaultHTTP()}
	data := &polymarket.DataClient{BaseURL: f.dataURL, HTTP: defaultHTTP()}

	startedAt := time.Now()
	fmt.Fprintf(stdout, "fetching top %d markets by volume from %s\n", f.marketsLimit, f.gammaURL)
	markets, err := gamma.TopMarketsByVolume(ctx, f.marketsLimit)
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "got %d markets\n", len(markets))

	stat := runStat{
		StartedAt:        startedAt.UTC().Format(time.RFC3339),
		MarketsRequested: f.marketsLimit,
		Concurrency:      f.concurrency,
		MarketsLimit:     f.marketsLimit,
	}

	for i, m := range markets {
		idx := i + 1
		if reason, ok := blocked[m.ConditionID]; ok {
			fmt.Fprintf(stdout, "[%d/%d] skipping %q (blocked: %s)\n", idx, len(markets), m.Slug, reason)
			stat.MarketsSkipped++
			continue
		}

		if !f.refresh {
			exists, n, err := st.MarketHasTrades(m.ConditionID)
			if err != nil {
				return err
			}
			if exists && n > 0 {
				fmt.Fprintf(stdout, "[%d/%d] skipping %q (already pulled, %d trades)\n", idx, len(markets), m.Slug, n)
				stat.MarketsSkipped++
				if err := st.UpsertMarket(m); err != nil {
					return err
				}
				continue
			}
		}

		if err := st.UpsertMarket(m); err != nil {
			return err
		}

		marketStart := time.Now()
		trades, capped, err := data.AllTrades(ctx, m.ConditionID, nil)
		if err != nil {
			fmt.Fprintf(stderr, "[%d/%d] error fetching trades for %q: %v\n", idx, len(markets), m.Slug, err)
			stat.MarketsSkipped++
			continue
		}

		rows := make([]envelope.Row, 0, len(trades))
		for _, t := range trades {
			row, err := envelope.FromTrade(t, &m)
			if err != nil {
				return err
			}
			rows = append(rows, row)
		}
		inserted, err := st.InsertTrades(rows)
		if err != nil {
			return err
		}
		stat.TradesInserted += inserted
		stat.MarketsPulled++

		dur := time.Since(marketStart)
		rate := 0.0
		if dur.Seconds() > 0 {
			rate = float64(len(trades)) / dur.Seconds()
		}
		if rate > stat.PeakRatePerSec {
			stat.PeakRatePerSec = rate
		}
		cappedNote := ""
		if capped {
			cappedNote = " [capped at API max offset]"
		}
		fmt.Fprintf(stdout, "[%d/%d] dumping market %q — %d trades (%d new), %.1fs (%.0f t/s)%s\n",
			idx, len(markets), m.Slug, len(trades), inserted, dur.Seconds(), rate, cappedNote)
	}

	finished := time.Now()
	stat.FinishedAt = finished.UTC().Format(time.RFC3339)
	stat.ElapsedSeconds = finished.Sub(startedAt).Seconds()

	fmt.Fprintf(stdout, "done: %d trades inserted across %d markets in %.1fs (peak %.0f t/s)\n",
		stat.TradesInserted, stat.MarketsPulled, stat.ElapsedSeconds, stat.PeakRatePerSec)

	if err := appendStat(f.statsPath, stat); err != nil {
		fmt.Fprintf(stderr, "warning: failed to append stats: %v\n", err)
	}
	return nil
}

func loadBlocklist(path string) (Blocklist, error) {
	if path == "" {
		return Blocklist{}, nil
	}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return Blocklist{}, nil
	}
	if err != nil {
		return Blocklist{}, fmt.Errorf("read blocklist: %w", err)
	}
	var bl Blocklist
	if err := json.Unmarshal(b, &bl); err != nil {
		return Blocklist{}, fmt.Errorf("parse blocklist: %w", err)
	}
	return bl, nil
}

func appendStat(path string, stat runStat) error {
	var stats []runStat
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &stats)
	}
	stats = append(stats, stat)
	out, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, out, 0o644)
}

func defaultHTTP() *http.Client {
	return &http.Client{Timeout: 60 * time.Second}
}
