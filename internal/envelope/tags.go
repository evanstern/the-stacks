package envelope

import "github.com/evanstern/the-stacks/internal/polymarket"

// DeriveTags builds the tags array stored as JSON in trades.tags:
// ["polymarket", <eventSlug>, <outcome>, <side>, <"resolved"|"active">]
func DeriveTags(t polymarket.Trade, market *polymarket.Market) []string {
	state := "active"
	if market != nil && market.Closed {
		state = "resolved"
	}
	return []string{"polymarket", t.EventSlug, t.Outcome, t.Side, state}
}
