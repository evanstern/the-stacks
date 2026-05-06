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

const DefaultGammaBaseURL = "https://gamma-api.polymarket.com"

type GammaClient struct {
	BaseURL string
	HTTP    *http.Client
}

func NewGammaClient() *GammaClient {
	return &GammaClient{BaseURL: DefaultGammaBaseURL, HTTP: http.DefaultClient}
}

// TopMarketsByVolume returns the top-N markets ordered by volumeNum descending.
func (c *GammaClient) TopMarketsByVolume(ctx context.Context, limit int) ([]Market, error) {
	q := url.Values{}
	q.Set("order", "volumeNum")
	q.Set("ascending", "false")
	q.Set("limit", strconv.Itoa(limit))

	endpoint := c.BaseURL + "/markets?" + q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gamma get markets: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gamma get markets: status %d: %s", resp.StatusCode, body)
	}

	var raws []json.RawMessage
	if err := json.Unmarshal(body, &raws); err != nil {
		return nil, fmt.Errorf("gamma decode envelope: %w", err)
	}

	markets := make([]Market, 0, len(raws))
	for _, r := range raws {
		var m Market
		if err := json.Unmarshal(r, &m); err != nil {
			return nil, fmt.Errorf("gamma decode market: %w", err)
		}
		m.Raw = append(json.RawMessage(nil), r...)
		markets = append(markets, m)
	}
	return markets, nil
}
