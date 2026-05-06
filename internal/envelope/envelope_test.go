package envelope

import (
	"encoding/json"
	"testing"

	"github.com/evanstern/the-stacks/internal/polymarket"
)

func TestFromTradeMapping(t *testing.T) {
	rawTrade := `{
		"proxyWallet": "0xabc",
		"side": "BUY",
		"asset": "asset123",
		"conditionId": "cond123",
		"size": 41.66,
		"price": 0.024,
		"timestamp": 1778018282,
		"title": "Will X happen?",
		"slug": "will-x-happen",
		"eventSlug": "x-event",
		"outcome": "Yes",
		"outcomeIndex": 0,
		"transactionHash": "0xtx",
		"name": "branko"
	}`
	var trade polymarket.Trade
	if err := json.Unmarshal([]byte(rawTrade), &trade); err != nil {
		t.Fatal(err)
	}
	trade.Raw = json.RawMessage(rawTrade)

	market := &polymarket.Market{
		ConditionID: "cond123",
		Slug:        "will-x-happen",
		Question:    "Will X happen?",
		Closed:      false,
	}

	row, err := FromTrade(trade, market)
	if err != nil {
		t.Fatal(err)
	}
	if row.Source != SourcePolymarketTrade {
		t.Errorf("source = %q", row.Source)
	}
	if row.WhenUnix != 1778018282 {
		t.Errorf("when_unix = %d", row.WhenUnix)
	}
	if row.ConditionID != "cond123" || row.Asset != "asset123" || row.Side != "BUY" {
		t.Errorf("identifying cols mismatch: %+v", row)
	}
	if row.Outcome != "Yes" || row.OutcomeIndex != 0 {
		t.Errorf("outcome cols mismatch")
	}
	if row.Size != 41.66 || row.Price != 0.024 {
		t.Errorf("numeric cols mismatch")
	}
	if row.ProxyWallet != "0xabc" || row.TxHash != "0xtx" {
		t.Errorf("identity cols mismatch")
	}

	var tags []string
	if err := json.Unmarshal([]byte(row.TagsJSON), &tags); err != nil {
		t.Fatalf("tags unmarshal: %v", err)
	}
	wantTags := []string{"polymarket", "x-event", "Yes", "BUY", "active"}
	if len(tags) != len(wantTags) {
		t.Fatalf("tags = %v, want %v", tags, wantTags)
	}
	for i := range tags {
		if tags[i] != wantTags[i] {
			t.Fatalf("tags[%d] = %q, want %q", i, tags[i], wantTags[i])
		}
	}

	var data map[string]any
	if err := json.Unmarshal([]byte(row.DataJSON), &data); err != nil {
		t.Fatalf("data unmarshal: %v", err)
	}
	for _, redundant := range []string{"conditionId", "asset", "size", "price", "side", "outcome", "outcomeIndex", "proxyWallet", "transactionHash", "timestamp", "slug"} {
		if _, ok := data[redundant]; ok {
			t.Errorf("data still contains redundant key %q", redundant)
		}
	}
	if data["title"] != "Will X happen?" {
		t.Errorf("data.title = %v", data["title"])
	}
	if data["marketSlug"] != "will-x-happen" {
		t.Errorf("data.marketSlug = %v", data["marketSlug"])
	}
	if data["eventSlug"] != "x-event" {
		t.Errorf("data.eventSlug = %v", data["eventSlug"])
	}
	if data["name"] != "branko" {
		t.Errorf("data.name passthrough = %v", data["name"])
	}
}

func TestDeriveTagsClosedMarket(t *testing.T) {
	tr := polymarket.Trade{Side: "SELL", Outcome: "No", EventSlug: "evt"}
	tags := DeriveTags(tr, &polymarket.Market{Closed: true})
	if tags[4] != "resolved" {
		t.Errorf("closed market should yield 'resolved', got %q", tags[4])
	}
}

func TestDeriveTagsNilMarket(t *testing.T) {
	tr := polymarket.Trade{Side: "BUY", Outcome: "Yes", EventSlug: "evt"}
	tags := DeriveTags(tr, nil)
	if tags[4] != "active" {
		t.Errorf("nil market should yield 'active', got %q", tags[4])
	}
}
