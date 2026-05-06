package polymarket

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
)

const DefaultDataBaseURL = "https://data-api.polymarket.com"

const TradesPageSize = 1000

// MaxHistoricalOffset is the maximum offset the upstream Data API permits.
// Verified empirically (2026-05-05): offsets 0..3000 inclusive return data;
// any larger offset returns HTTP 400 "max historical activity offset of 3000
// exceeded". Combined with TradesPageSize=1000 this caps pulls at ~4000 trades
// per market — the most recent ~4000 trades, since the API serves descending
// by timestamp. See designs/the-stacks-corpus.md "API shape" for context.
const MaxHistoricalOffset = 3000

type DataClient struct {
	BaseURL string
	HTTP    *http.Client
}

func NewDataClient() *DataClient {
	return &DataClient{BaseURL: DefaultDataBaseURL, HTTP: http.DefaultClient}
}

// TradesPage fetches a single page of trades for a market at the given offset.
// Returns up to TradesPageSize trades. A short page (< limit) signals end-of-data.
func (c *DataClient) TradesPage(ctx context.Context, conditionID string, offset, limit int) ([]Trade, error) {
	q := url.Values{}
	q.Set("market", conditionID)
	q.Set("limit", strconv.Itoa(limit))
	if offset > 0 {
		q.Set("offset", strconv.Itoa(offset))
	}
	endpoint := c.BaseURL + "/trades?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("data get trades: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("data get trades: status %d: %s", resp.StatusCode, body)
	}

	var raws []json.RawMessage
	if err := json.Unmarshal(body, &raws); err != nil {
		return nil, fmt.Errorf("data decode envelope: %w", err)
	}
	trades := make([]Trade, 0, len(raws))
	for _, r := range raws {
		var t Trade
		if err := json.Unmarshal(r, &t); err != nil {
			return nil, fmt.Errorf("data decode trade: %w", err)
		}
		t.Raw = append(json.RawMessage(nil), r...)
		trades = append(trades, t)
	}
	return trades, nil
}

// AllTrades walks pagination via offset until an empty/short page is returned
// or the upstream MaxHistoricalOffset cap is reached. onPage is called after
// each successful page (useful for progress reporting). The returned bool
// reports whether the cap was hit (i.e. there are likely older trades the API
// will not serve).
func (c *DataClient) AllTrades(ctx context.Context, conditionID string, onPage func(page []Trade, offset int)) ([]Trade, bool, error) {
	var all []Trade
	offset := 0
	for {
		page, err := c.TradesPage(ctx, conditionID, offset, TradesPageSize)
		if err != nil {
			return nil, false, err
		}
		if onPage != nil {
			onPage(page, offset)
		}
		all = append(all, page...)
		if len(page) < TradesPageSize {
			return all, false, nil
		}
		offset += TradesPageSize
		if offset > MaxHistoricalOffset {
			return all, true, nil
		}
	}
}
