# Live run: plan-first-step (spec 064, T029)

Stack `stacks-task-0182` at http://localhost:3182, app rebuilt from this branch,
`DM_FAKE_SCRIPT=greyhollow-plan-approach`. Boot line: `DM script mode: greyhollow-plan-approach (9 calls, 2 dice)`.
Browser: Brave (Playwright, `shoot-live.mjs`). Scene: `greyhollow-ford-duo`. Operator holds Tamsin, a redeemed player holds Kestrel.
Credentials: generated, kept outside the repo. Final run session: `5c0d187e-7e1d-4b1b-a0e2-44923dff5a5e`.

| Step | Result |
|---|---|
| App rebuilt with the branch; script mode on at boot | PASS |
| Operator and player created; duo scene started; opening narration arrived | PASS |
| `declare.mjs` declared and committed `act-197dae73` | PASS |
| Table stays in free mode after the turn (header reads `Free mode`) | PASS |
| Two stealth dice lines: `1d20 -> 8 vs DC 12: failure` (Kestrel), `1d20 -> 15 vs DC 12: success` (Odo) | PASS |
| No encounter opens (no initiative, round or end-turn UI) | PASS |
| Narration covers only the approach: "Tamsin steps out onto the open ground ... The camp lies ahead, and nobody has called out yet." | PASS |
| Debug page: director output holds `overrides` with `held: the plan was cut to its first stage` for `turn` and for `tracker` | PASS |
| Shots at 1280 and 390 px, light and dark (`shots/`): table-operator, table-player, debug; no modal in any of the 12 | PASS |

Notes: the first two runs failed only on driver assertions (a stealth-line text match and a held-line match).
The page showed the right content both times. The assertions were fixed in `shoot-live.mjs`, and the third run is the record.
Text captures: `table-text.txt`, `debug-page.txt`. No product defect found.
