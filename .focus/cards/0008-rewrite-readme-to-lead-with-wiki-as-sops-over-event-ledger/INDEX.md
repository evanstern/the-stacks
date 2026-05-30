---
schema_version: 2
id: 8
uuid: 019df5e6-6b3a-703d-8d91-3cabe91cfc22
title: Rewrite README to lead with wiki-as-SOPs over event-ledger framing
type: card
status: archived
priority: p2
project: the-stacks
created: 2026-05-05
---

# Rewrite README to lead with wiki-as-SOPs over event-ledger framing

## Why

The current README leans on a "library" metaphor — wiki indexing into
RAG, modeled on Dewey decimal and Wikipedia. That's correct but
insufficient. The actual architectural opinion sharpened during the
M1 corpus pick (#4): The Stacks isn't "wiki-over-RAG for documents,"
it's **wiki-as-SOPs over a structured event ledger.**

The application work this is meant to back is time-series-shaped —
property management ledgers, audit trails, trades, sensor readings.
The wiki holds editorial judgment (playbooks, best-practices, runbooks)
that frames the noisy operational record. The corpus pick (Polymarket
trades + prediction-market SOPs) demonstrates this pattern.

The README needs to lead with that framing, not the library framing.

## Don't do this yet

This is deferred until M1's ingest and ask CLI are real (#5 and #6).
Rewriting the pitch without working code under it is performative.
Wait until we have:

- A real ingest run against Polymarket (#5)
- A real `the-stacks ask` query that returns sensible top-k trades
  (#6)
- The asciinema recording for M1

Then rewrite README anchored on those concrete demos.

## What changes

- Lead paragraph: "wiki-as-SOPs over an event ledger" framing,
  with the property-management example or similar to make it
  concrete
- The "Why" section keeps both failure modes (wiki-doesn't-scale,
  RAG-is-structureless) but reframes the synthesis as
  editorial-context-over-operational-record, not librarian-over-stacks
- Stack section unchanged
- Roadmap unchanged
- Demo section gets concrete: the actual Polymarket queries from #6,
  not hypothetical ones
- Library metaphor stays as a secondary "this is how good libraries
  also work" note — it's still true, just not the lead

## Done when

- README lead paragraph reframed (event-ledger + SOP-wiki)
- Demo section anchors on actual M1 demo queries with real
  output samples
- Library metaphor relegated to supporting role, not lead
- Reading the README cold tells you the architectural opinion
  in the first 30 seconds

## Related

- `designs/the-stacks-corpus.md` — where the sharpened framing
  was first written down
- Card #6 — provides the concrete demo content the new README
  pitch will quote from

## Notes

Surfaced 2026-05-05 in the same session as #4 closed. Filed
because raising-without-carding is an anti-pattern.
