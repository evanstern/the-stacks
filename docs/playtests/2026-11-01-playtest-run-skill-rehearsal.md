# playtest-run skill rehearsal — 2026-11-01

- **Environment:** local stack `stacks-task-0186`, `http://localhost:3186`, commit `7d9d8518` (branch `task-0186-playtest-run-skill`).
- **Script:** `DM_FAKE_SCRIPT=greyhollow-talk` (boot line `DM script mode: greyhollow-talk (6 calls, 0 dice)`). No paid model ran.
- **Seed:** `greyhollow-ford`. The operator account holds Tamsin; `player2` was created by invitation. Credentials live outside the repo.
- **Card under test:** TASK-0163, AC 4 (sample). **Ceiling:** none needed (scripted, cost $0); the 50% and 80% warnings were exercised on a synthetic ledger.
- **Merged since last run (2026-10-30), from `freshness.mjs`:** PRs #90 to #95; Done cards TASK-0052, TASK-0180, TASK-0182.

Classes: bug, rough edge, missing feature, rules/DM quality, positive.

## Steps exercised

| Step | Command | Result |
|------|---------|--------|
| Target | `pnpm env:up`, migrate both databases, `DM_FAKE_SCRIPT`, `local-table.mjs seed` | Session `9aab706d-e80c-46a2-b36b-c8a6761a7656` started. |
| Freshness | `freshness.mjs --health http://localhost:3186 --since 2026-10-30` | Deployed `7d9d8518` is one commit ahead of `origin/main` (a branch build). Listed 6 PRs and 3 Done cards. |
| Checklist | `checklist.mjs derive`, `set`, `summary`, then `derive --prev` | Ids stable; `pending` rows rolled forward as `not reached`; `pass` rows dropped. |
| Watch | `local-table.mjs talk`, then `watch.mjs` | Reported the scene-start turn, the talk turn, and two chronicle jobs. |
| Spend | `watch.mjs --ceiling` on a synthetic ledger ($0.42) | Warned at 52% of $0.80 and at 84% of $0.50; no repeat warning on the third poll. |
| Triage | `triage.mjs "roll line"` | Found TASK-0169 as the covering card for the sample finding. |
| Wrap | `pnpm playtest audit --session ... --auditor fake` | Verdict `pass`. |

## Checklist

| id | item | source | status | note |
|----|------|--------|--------|------|
| TASK-0163-AC4 | TASK-0163 acceptance criterion #4 | card under test | not reached | rehearsal does not test the AC |
| TASK-0180 | Verify what TASK-0180 changed | merged since last run | pass | talk -> Wenna reply |
| TASK-0182 | Verify what TASK-0182 changed | merged since last run | not reached | no plan-declaration script in this run |
| base-signoff | Group sign-off | baseline | pass | rehearsal: scripted |
| base-floor | Floor passing and absence (30 s, 120 s) | baseline | not reached | |
| base-companion | Companion reacts | baseline | not reached | |
| base-combat | Combat: initiative, a downed hero, ending the encounter | baseline | not reached | |
| base-dmquality | DM quality spot checks | baseline | not reached | |
| base-debug-retry | Debug page and Retry | baseline | not reached | |

## Turns reported by the watch step

| Job | Kind / trigger | Status | Duration | Calls | Cost | What the narration did |
|-----|----------------|--------|----------|-------|------|------------------------|
| 1c44186a | turn / scene-start | succeeded | 0.1 s | 3 | $0 | Opened at the ford: ferry chained, door open, bell silent (#13). |
| cd59c89b | chronicle | succeeded | 0.0 s | 1 | $0 | — |
| 73d1392b | turn / talk | succeeded | 0.1 s | 1 | $0 | Wenna answered the question in character (#16). |
| 7be516b3 | chronicle | succeeded | 0.0 s | 1 | $0 | — |

## Findings

| # | Time | Seat | Class | Observation | Existing card | Card |
|---|------|------|-------|-------------|---------------|------|
| 1 | rehearsal | Tamsin | rough edge (sample, not real) | Sample: "the roll line does not name the check". | TASK-0169 (search "roll line", score 0.58) | None created. Would run: `backlog task create 'Rehearsal sample finding' -l playtest --ref 'docs/playtests/2026-11-01-playtest-run-skill-rehearsal.md' --priority medium -d '...'` if no match covered it. |

## Run summary

- **Session:** `9aab706d-e80c-46a2-b36b-c8a6761a7656`. **Spend:** $0.00 (scripted). **Auditor verdict:** pass (`--auditor fake`).
- **Checklist:** 2 pass, 7 not reached. The not-reached rows roll forward.
- **Defects found in the skill while rehearsing:** `watch.mjs` did not read the `operator` key of the creds file; `freshness.mjs` called a branch build "behind". Both fixed.
