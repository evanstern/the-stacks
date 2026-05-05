// Package envelope maps Polymarket trades to the {source, tags, when, data}
// envelope shape that the trades table stores.
package envelope

import (
	"encoding/json"
	"fmt"

	"github.com/evanstern/the-stacks/internal/polymarket"
)

const SourcePolymarketTrade = "polymarket.trade"

// Row is the materialized trade row written into the trades table.
type Row struct {
	Source       string
	WhenUnix     int64
	ConditionID  string
	Asset        string
	Side         string
	Outcome      string
	OutcomeIndex int
	Size         float64
	Price        float64
	ProxyWallet  string
	TxHash       string
	TagsJSON     string
	DataJSON     string
}

// FromTrade builds a Row from a polymarket.Trade. The market is consulted for
// closed/active state used in the tags array; if nil, "active" is assumed.
func FromTrade(t polymarket.Trade, market *polymarket.Market) (Row, error) {
	tags := DeriveTags(t, market)
	tagsBytes, err := json.Marshal(tags)
	if err != nil {
		return Row{}, fmt.Errorf("marshal tags: %w", err)
	}

	dataBytes, err := buildData(t)
	if err != nil {
		return Row{}, fmt.Errorf("build data: %w", err)
	}

	return Row{
		Source:       SourcePolymarketTrade,
		WhenUnix:     t.Timestamp,
		ConditionID:  t.ConditionID,
		Asset:        t.Asset,
		Side:         t.Side,
		Outcome:      t.Outcome,
		OutcomeIndex: t.OutcomeIndex,
		Size:         t.Size,
		Price:        t.Price,
		ProxyWallet:  t.ProxyWallet,
		TxHash:       t.TransactionHash,
		TagsJSON:     string(tagsBytes),
		DataJSON:     string(dataBytes),
	}, nil
}

// buildData produces the trades.data JSON column: the upstream trade object
// minus the redundant identifying columns (kept as their own typed columns),
// plus title/marketSlug/eventSlug for display.
func buildData(t polymarket.Trade) ([]byte, error) {
	var m map[string]any
	if len(t.Raw) > 0 {
		if err := json.Unmarshal(t.Raw, &m); err != nil {
			return nil, err
		}
	} else {
		m = map[string]any{}
	}

	for _, k := range []string{
		"conditionId", "asset", "side", "outcome", "outcomeIndex",
		"size", "price", "proxyWallet", "transactionHash", "timestamp",
		"slug",
	} {
		delete(m, k)
	}

	if _, ok := m["title"]; !ok && t.Title != "" {
		m["title"] = t.Title
	}
	if t.Slug != "" {
		m["marketSlug"] = t.Slug
	}
	if _, ok := m["eventSlug"]; !ok && t.EventSlug != "" {
		m["eventSlug"] = t.EventSlug
	}

	return json.Marshal(m)
}
