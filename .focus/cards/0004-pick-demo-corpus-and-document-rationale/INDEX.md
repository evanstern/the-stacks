---
schema_version: 2
id: 4
uuid: 019df5c3-a6ac-76ee-a701-d4e4749fc30b
title: Pick demo corpus and document rationale
type: card
status: done
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Pick demo corpus and document rationale

The README runs against this corpus. It has to be:

- **Public domain or permissively licensed** (redistributable)
- **Substantive enough to need retrieval** (not 12 documents)
- **Coherent enough that a curated wiki layer makes sense** in M2
- **Recognizable** to a hiring manager skimming the README
- **Time-series-shaped.** This is the reframe (2026-05-05): The Stacks is for *ledgers* with a thick context layer, not for prose corpora. Application work this is meant to support looks like `{source, tags, when, data}` events plus SOPs/playbooks/best-practices framing them. The corpus must reflect that shape.

## Decision (2026-05-05)

**Corpus:** Polymarket public Data API. **Scope:** Top ~100 most-traded markets, all-time. **License path:** Public REST endpoints, no auth required, redistributable.

### Why

Polymarket events are natively ledger-shaped — every trade and activity event is a timestamped, structured envelope around an opinionated payload. Maps directly onto the `{source, tags, when, data}` interface The Stacks is being aimed at. Famous markets ("Will Trump win the 2024 election?") make the README's demo queries instantly legible. The wiki layer writes itself as prediction-market SOPs and playbooks — exactly the "editorial-judgment over a noisy ledger" story the architectural opinion needs.

### Sources rejected

- **Goldsky Mirror** — Evan's first suggestion. Confirmed paid product, requires a database sink, not redistributable. Stays as a candidate *future* alternative ingest path for streaming dogfood.
- **predictiondata.dev** CSV downloads — 3yr history pre-packaged, but redistribution license is unclear and they require an API key. Worth keeping as a backfill fast-path if we later need depth, but not the canonical M1 source.
- **Project Gutenberg / Postgres docs / Kubernetes docs / Wikipedia** — all rejected for being prose corpora. Wrong shape for the actual application work this design is meant to back.

## Steps

1. Write `designs/the-stacks-corpus.md` documenting the pick, the rationale, sources rejected, and the redistribution story.
2. Verify the Polymarket Data API endpoints and rate limits empirically (one curl against `/trades` and `/activity`, confirm the shape).
3. Sketch the corpus envelope: how `{source, tags, when, data}` maps onto a Polymarket trade and onto an activity event.
4. Draft 3-5 demo questions that exercise both pure-RAG (M1) and wiki+RAG (M2) modes. Examples: - "What was the last week of trading like for Trump-2024 YES?"
     (pure ledger drill-down)
   - "How should I read late-stage liquidity drops on a binary market?"
     (pure SOP / wiki page)
   - "Trump-2024 had this liquidity pattern in the final week — what
     does the playbook say about that?" (hybrid: SOP + scoped trades)
5. Pick the ~100-market candidate set criterion. Probably "highest `volumeNum` from Gamma `/markets`, all-time, with status=resolved or active." Document the query.

## Done when

- `designs/the-stacks-corpus.md` lands with the decision, rationale, rejected alternatives, and license/redistribution note
- Polymarket API shape verified with one live curl logged in the doc
- Ledger envelope mapping (`{source, tags, when, data}` for a trade and for an activity event) written into the design
- 3-5 demo questions drafted in the doc
- Top-100 selection criterion documented (the query that picks them)

## Notes

The architectural opinion just sharpened: The Stacks isn't "wiki-over-RAG for documents." It's **wiki-as-SOPs over a structured event ledger**. That sentence belongs in the README too, eventually. Note for the next pass on README.md.
