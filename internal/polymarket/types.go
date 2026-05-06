// Package polymarket contains HTTP clients for Polymarket's public APIs:
// the Gamma API (market metadata) and the Data API (trade ledger).
package polymarket

import "encoding/json"

// Market is the subset of fields we extract from the Gamma /markets response.
// The full response is preserved as Raw for storage in the markets.raw column.
type Market struct {
	ConditionID string  `json:"conditionId"`
	Slug        string  `json:"slug"`
	Question    string  `json:"question"`
	StartDate   string  `json:"startDate"` // ISO 8601 string, may be empty
	EndDate     string  `json:"endDate"`
	Active      bool    `json:"active"`
	Closed      bool    `json:"closed"`
	VolumeNum   float64 `json:"volumeNum"`

	// Raw is the full JSON object for this market as returned by Gamma,
	// captured so the markets.raw column can hold the unmodified upstream
	// envelope.
	Raw json.RawMessage `json:"-"`
}

// Trade is the subset of fields we extract from the Data /trades response.
// Raw is the full JSON object for the trade as returned upstream.
type Trade struct {
	ProxyWallet     string  `json:"proxyWallet"`
	Side            string  `json:"side"`
	Asset           string  `json:"asset"`
	ConditionID     string  `json:"conditionId"`
	Size            float64 `json:"size"`
	Price           float64 `json:"price"`
	Timestamp       int64   `json:"timestamp"`
	Title           string  `json:"title"`
	Slug            string  `json:"slug"`
	EventSlug       string  `json:"eventSlug"`
	Outcome         string  `json:"outcome"`
	OutcomeIndex    int     `json:"outcomeIndex"`
	TransactionHash string  `json:"transactionHash"`

	Raw json.RawMessage `json:"-"`
}
