---
schema_version: 2
id: 12
uuid: 019df60d-7b4f-7400-a014-9c63eeaf8530
title: Document corpus sizing in design doc; soften top-100 to top-10 default
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Document corpus sizing; soften top-100 to top-10 default

The original #4 decision said "top ~100 markets" without sizing the
cost. Real numbers were measured 2026-05-05 against the live API.
Top-100 is a 82 GB JSONL pull, 300 GB+ DB if per-trade, 12+ hours
of CPU embed even at sane chunking. Not appropriate as a default
for a portfolio repo where readers should be able to run the demo.

**Decision (2026-05-05):** Default demo size is **top-10 markets**.
top-100 stays available via flag for those who want it.

## Numbers (anchor in design doc)

Measured 2026-05-05:
- Avg trade USD value: ~$30 (median $16, mean $31)
- Trade envelope: 956 bytes compact JSON
- Top-100 markets total volume: $2.78B → ~93M trades
- API page max: 1000 trades, ~0.1-0.7s latency

Scaling table (Strategy B, 1h windows per market):

| Scope | JSONL | sqlite-vec DB | Pull (5x conc) | Embed (CPU) |
|---|---|---|---|---|
| top-1 | 1.8 GB | 31 MB | ~3 min | ~2 min |
| top-3 | 4.8 GB | 92 MB | ~7 min | ~5 min |
| top-10 | 8.9 GB | 307 MB | ~13 min | ~15 min |
| top-25 | ~22 GB | 770 MB | ~30 min | ~37 min |
| top-100 | 82 GB | 3 GB | ~2.5 hrs | ~2.5 hrs |

## Steps

1. Add a "Sizing" section to `designs/the-stacks-corpus.md` with
   the table above + the measurement methodology
2. Update `designs/the-stacks-corpus.md` "Decision" section: change
   "Top ~100 most-traded markets" to "Top-N markets, default 10
   for the published demo, configurable up to 100 for those
   running their own embed"
3. Add a paragraph noting: published `stacks.db` artifact (#13)
   ships top-10; readers can rebuild larger via `the-stacks pull
   --markets-limit N` + embed
4. Update card #5's done-when to use top-10 as the default demo run

## Done when

- `designs/the-stacks-corpus.md` has the sizing section
- Decision section reflects top-10 default + configurable
- Cross-references to #5 and #13 are in place
- Card #5's body references top-10 as the demo target

## Notes

Filed 2026-05-05 after sizing exercise. The original "top ~100"
in #4 was confident-sounding but not backed by measurement. This
card fixes the design doc with real numbers. Per raise-and-card
rule.
