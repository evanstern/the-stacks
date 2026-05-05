---
schema_version: 2
id: 18
uuid: 019dfa6b-18da-7e80-aa72-56b9d7b29998
title: Verify M1 demo questions answerable against 4000-trade-per-market slice; investigate /activity for historical depth
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Verify demo questions vs the 4000-trade slice

#5 surfaced that Polymarket's `/trades` endpoint silently caps
historical depth at offset=3000 + limit=1000, exposing **at most
~4000 most-recent trades per market**. For closed markets like
Trump-2024, those 4000 trades cover a tiny window near *now*,
not the resolution drama in Nov 2024.

The corpus design doc (`designs/the-stacks-corpus.md`) lists
demo questions:
1. *"What was the last week of trading like for Trump-2024 YES?"*
   — pure ledger drill-down (M1)
2. *"How should I read late-stage liquidity drops on a binary
   market?"* — pure SOP read (M2)
3. *"Trump-2024 had this liquidity pattern in the final week —
   what does the playbook say about that?"* — hybrid (M2)

Question 2 is wiki-only, fine. Questions 1 and 3 are at risk:
"the last week" and "the final week before resolution" assume
we have trades from *that* week. We probably don't, for closed
markets.

## Steps

1. **Audit the captured slice for top-10 markets.** What's the
   timestamp range of the trades we actually have, per market?
   For each closed market in the top-10, how far back does our
   4000-trade slice reach? Days? Hours? Across resolution?
2. **Decide which demo questions survive.** Some will need to
   shift from closed/famous markets to active markets (where
   "last week" naturally means "the most recent trades"). That
   may shift demo legibility — "Will Trump win 2028" is less
   gripping than "Will Trump win 2024."
3. **Investigate `/activity` as a historical-depth path.**
   `/activity?user=<wallet>` was rejected during #5's API
   exploration because it requires a per-user filter. But for
   the resolution-period drama on famous markets, walking
   *known whale wallets* via `/activity` might surface trades
   `/trades` won't return. Worth a 30-min spike before #11
   commits to chunk strategy.
4. **Investigate predictiondata.dev as backfill.** Already
   noted in `designs/the-stacks-corpus.md` as a rejected source
   for M1 (license unclear). Worth a license check now that
   we know `/trades` is depth-gated. If their license permits
   redistribution, they could plug the historical hole.
5. **Investigate Polygon RPC + a subgraph.** Polymarket trades
   are on-chain. A subgraph over Polygon could reach all of
   history. More work; only if 1-4 leave demo questions
   unanswered.

## Done when

- `designs/the-stacks-corpus.md` has a "What our slice actually
  contains" subsection with date-range-per-market data from a
  real top-10 pull
- Demo questions are revised (or confirmed) against what the
  slice can answer; updates land in the design doc
- `/activity`, predictiondata.dev license, and subgraph paths
  are each evaluated and documented (one paragraph each, with
  verdict)
- A clear recommendation: M1 ships against the 4000-slice
  (with revised demo questions), OR M1 needs an alternate
  source. Either is fine — pick deliberately.

## Why p1

This is a strategic concern, not a code concern. But #11
(embed) and #6 (ask CLI + demo) both depend on knowing what
questions the corpus can actually answer. Picking a chunk
strategy that's optimized for "final-week resolution drama"
when the corpus doesn't *have* the final week would be wasted
work.

## Notes

Filed 2026-05-05 from #5's PR review. The depth cap was the
single most consequential discovery in the PR — design-doc
honest about it, but the implications need walking through
before #11 starts.
