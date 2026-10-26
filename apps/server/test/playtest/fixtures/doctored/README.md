# Doctored playtest run

A copy of the CI run directory of `apps/server/playtests/scenarios/greyhollow-ford.json` with
one planted problem per code check and one flagged DM-runtime audit record. The auditor must
give verdict `fail` with exactly the findings below (checks-only mode; `audit.test.ts`).

| Check id | Row seq | Segment | Planted problem |
|---|---|---|---|
| `dice-language` | 10 | 0 | The prose says "a roll of the dice" and the segment has no roll. |
| `roll-reasons` | 15 | 1 | The ledger roll has an empty reason. The dice line in row 18 is edited to match, so `dice-lines` passes. |
| `prose-digits` | 18 | 1 | The prose holds the digit `3`. |
| `dice-lines` | 26 | 2 | The dice line total reads `= 19 vs DC 12` (the ledger says 14). |
| `life-states` | 50 | 4 | The prose says "Tamsin falls unconscious" and the ledger has no such change. |
| `hidden-info` | 72 | 6 | A public narration repeats Snag's secret ("He will trade the clapper for safe passage if two goblins fall."). |

One `dm-audit` note: a turn job with `audit.flagged: true`, created just before row 61, so the
finding lands on segment 5 and cites row 61.

Expected totals: six `fail` findings, zero `warn`, one `note`; verdict `fail`.
