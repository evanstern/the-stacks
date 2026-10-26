---
id: TASK-0048
title: 'First Scene: scripted-dice playtest harness, auditor agent, milestone demo'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 17:12'
labels:
  - first-scene
  - test
  - acceptance
milestone: m-2
dependencies:
  - TASK-0046
  - TASK-0047
references:
  - 'https://github.com/bradbushSFAI/tabletop-dm'
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: proof that the First Scene plays well and plays honestly. A harness runs a DM against scripted players with scripted dice. An auditor agent checks the transcript against the roll ledger and the DM doctrine. The milestone demo runs on it.

Why: decision-0021 idea 6. Play quality is judged from evidence, not impressions. The parked combat rules (TASK-0055) are decided from this card's evidence.

Demo: one human player plus AI companions play a scene with exploration, a social beat and a fight, to its end.

Spec: specs/032-playtest-harness
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness runs a playtest with scripted dice and scripted players, and saves the transcript and the ledger.
- [ ] #2 An auditor agent checks the transcript against the ledger and the doctrine's right/wrong pairs, and writes a report.
- [ ] #3 The harness runs in CI against the fake gateway adapter, and on demand against a configured provider.
- [ ] #4 One human player plus AI companions play a scene with exploration, a social beat and a fight to its end.
- [ ] #5 The demo record lists every audit failure and how it was resolved.
- [x] #6 Spec phase: Foundations — purpose, schemas and fixtures (US1, US2, US3; AC #1, #2, #3)
- [x] #7 Spec phase: The harness run (US1; AC #1)
- [x] #8 Spec phase: The auditor (US2; AC #2, #3)
- [x] #9 Spec phase: Provider mode, the cost guard and the CLI (US3; AC #3, #1 evidence)
- [x] #10 Spec phase: Demo runbook and record template (US4, US5 preparation; AC #4, #5)
- [ ] #11 Spec phase: The M2 demo — ORCHESTRATOR AND OPERATOR, NOT DISPATCHED (US4, US5; AC #4, #5)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 5) after TASK-0046 (#49) and TASK-0047 (#47) merged. Worktree .worktrees/task-0048, branch task-0048-playtest, cut from origin/main 718d738. Spec number 032 claimed with a stub.

Spec authoring by opus-implementer: 6f52dc7. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Design: the harness lives in apps/server/src/playtest/ with a pnpm playtest CLI (run, audit, estimate) and its own <base>_playtest database. The auditor uses purpose playtest.audit, runs six code checks plus a per-segment model check, and yields a pass, fail or incomplete report. CI mode runs on the fake gateway inside pnpm test. Provider mode is explicit opt-in: it refuses in CI, needs prices, prints an estimate, and requires --spend-ceiling-usd, with a live budget stop.
Open questions are left for the demo checkpoint: how many paid playtests (default one), and which auditor model (default a different family from dm.narrate). There is no scene-start UI button; the demo uses POST /dm/sessions/<id>/start.
Implementation dispatch grouping: P1 to P5, one per dispatch. P6 is the demo, driven by the orchestrator with the operator.

Phase 1 by sonnet-implementer: 8cacbe7. Adds the playtest.audit purpose, scenario and report schemas, and fixtures. The server suite passes 663 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 by sonnet-implementer: d9adaf3. The harness drives the real DM worker and gate in-process. The CI scenario plays to ended, saving run.json, transcript, ledger, jobs and usage. 3 integration cases pass (ended, stalled, failed). The server suite passes 675 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 by sonnet-implementer: 187868b. Adds the auditor: six code checks, a per-segment playtest.audit call, a report with stable ids, and fight stats. The CI playtest verdict is pass (8 segments, 0 findings). The doctored fixture verdict is fail, with 6 fail findings and 1 note. The server suite passes 694 tests; ci:check green.
Orchestrator rulings for Phase 4: the hidden-info check must flag disclosure of tracker STATE, not bare tracker names. The seed's tracker names are everyday words and would raise false positives in the demo. fledOrBargained must be derived from the log (the scene.changed end and bargain narration) rather than stay null, because TASK-0055 reads these stats.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Rulings implemented in 0ce29e8. hidden-info now flags tracker state (fractions, and tracker or clock beside a name or id) plus seed secrets. fledOrBargained is derived from ending-row reasons, with a note when no ending row exists.
Phase 4 by sonnet-implementer: d61a42b. Adds provider mode, budget.ts (estimate, preflight, budget gateway) and the CLI (run, audit, estimate) with exit codes 0/1/3/4/64. All refusal paths are tested with a priced fake provider; no real-provider call was made. CI evidence is committed at specs/032-playtest-harness/evidence/ci-playtest (ended, pass). The server suite passes 724 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 by sonnet-implementer: 1cca8b8. docs/design/m2-demo.md now holds the runbook (steps A to F) and a blank record template, and docs/design/m2-demo/ exists for attachments. ci:check green; this is the green-before-demo gate. The dry check shows pnpm playtest estimate exits 4 until the operator configures AI_PURPOSES and AI_PRICES.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: 954eec8. New note playtest-harness. Of the 12 stale notes, 8 were amended and 4 re-pinned only after reading their diffs. Freshness OK, 45 notes. The m2-demo note is written after the demo.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Operator approved the demo model mapping on 2026-10-26. All eight purposes route through the 9router 'claude' provider:
- dm.director, dm.adjudicate and playtest.audit: cc/claude-opus-5
- dm.interpret, dm.narrate and dm.companion: cc/claude-sonnet-5
- dm.audit and dm.chronicle: cc/claude-haiku-4-5-20251001
AI_PRICES use list rates: opus 5/25, sonnet 2/10, haiku 1/5, ollama/bge-m3 0/0. The operator is adding these to the root .env.
Operator troubleshooting note: on 9router some models need the [1m] context suffix (for example cc/claude-sonnet-5[1m]). If a purpose fails with a model or context error during the demo, try the [1m] form first, and add a matching AI_PRICES key.
bge-m3 check: it is installed locally in ollama (bge-m3:latest). vm-104 has no ollama and the dev .env has no AI_PROVIDERS or AI_PURPOSES.

OPERATOR APPROVAL 2026-10-26 (demo checkpoint B), in the operator's words: 'Approved'. This answers the orchestrator's proposal: a spend ceiling of $20 for the paid scripted playtest run and $6 for the demo-session audit. Models are as in the estimate: opus-5 for director, adjudicate and playtest.audit; sonnet-5 for interpret, narrate and companion; haiku-4-5 for dm.audit and chronicle; bge-m3 local. At list prices the estimate is $1.54 expected and $17.58 upper bound.

Demo step C, paid scripted playtest, 2026-10-26.
Run 1, kept at docs/design/m2-demo/provider-playtest-failed-1: failed at the first dm.director call with $0 spent. Cause: the playtest CLI runs on the host, but the root .env provider baseUrls use host.docker.internal, which resolves only inside containers. Rerun with a per-process AI_PROVIDERS override (localhost:20128 and localhost:11434). The runbook and CLI need a fix (finding).
Run 2, at docs/design/m2-demo/provider-playtest: outcome failed, verdict incomplete, $0.67 over 32 calls. Three turns completed: exploration, then the social beat with Persuasion 19-1=18 against DC 12, a success. The fourth turn failed with 'stopped at director: invalid-output'. Its first dm.director attempt hit exactly maxTokens 600, so the JSON was truncated, and the retry failed the schema too. The job error drops the schema issues, which is a diagnosability gap.
Auditor findings: F1, a check reporting a dice line in narration #10 where none was expected (to inspect, possibly a false positive). F2, narration #16 says the search found no print, though #10 and #11 described clawed tracks (a real continuity contradiction). F3, 'creak again' is a false positive, since #10 had the creak. F4, a DM-runtime audit regenerated #16 on its 3rd attempt (ledger-mismatch, player-agency, doctrine, invented-mechanics).
Next step: the operator decides whether to raise the dm.* maxTokens and rerun.

2026-10-26: on the operator's go, the root .env and worktree .env dm.* maxTokens were raised: director 1500, adjudicate 1500, interpret 1200, companion 800, chronicle 1000; narrate 500 and audit 300 unchanged. Run 2 was moved to docs/design/m2-demo/provider-playtest-failed-2. Run 3 refused with exit 3 and $0 spent: the new upper-bound estimate is $20.82 (expected $1.90), above the approved $20 ceiling. Waiting on the operator to approve a higher ceiling.
TASK-0101 progress: the operator added NINEROUTER_API_KEY to vm-104 ~/dev/.env. A read-only check with that key from vm-104 lists the realm 9router's models: cc/claude-opus-5, cc/claude-fable-5, cc/claude-sonnet-5, cc/claude-haiku-4-5-20251001.

OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approved: spend ceiling $22 for the paid scripted playtest rerun. Run it.'

Run 4, $22 ceiling, at docs/design/m2-demo/provider-playtest: outcome failed, verdict fail, $0.44 over 20 calls. Two turns succeeded. The third failed again with 'stopped at director: invalid-output'. This time it was NOT truncation: the director output 962 and then 280 tokens, both under the 1500 cap, and both failed the schema. The schema issues are not recorded anywhere, so the cause is unknown without a code change.
Findings so far, to resolve in the demo record:
D1 (blocker): the director's real-model output fails its schema (2 of 2 runs). The scene stalls at the third or fourth turn, and the M2 demo cannot reach the scene's end until this is fixed.
D2: a failed job's error keeps only the kind and drops the schema issues.
D3: the playtest dice-lines check reports dice lines in scene-start narration #10, which has none ('expected 0, found 1' in run 2 and 'found 2' in run 4). Likely a false positive in the check.
D4: the playtest CLI on the host cannot use host.docker.internal provider URLs.
Doctrine warnings from the auditor are expected quality findings: hero-is-theirs, fail-forward, end-on-demand, one-sense. The DM-runtime audit also shipped its factual fallback once.
Paid runs are paused until D1 is fixed.

Harness fixes by sonnet-implementer: 31f61f7.
D3: splitNarration treated everything after the first blank line as dice lines. Now only a final block whose every line carries an arrow or auto-fail counts. Regression tests use the real #10 texts from both runs.
D4: the CLI rewrites host.docker.internal to localhost when /.dockerenv is absent (override PLAYTEST_HOST_NETWORK=0 or 1) and logs the rewrite.
Orchestrator gate: ci:check with REQUIRE_DATABASE=1 and the worktree's TEST_DATABASE_URL is green, 730 server tests. The implementer's DB auth failures came from a wrong URL, not the code.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Harness fix 0fd4941 by sonnet-implementer: the Greyhollow Ford scenario's maxWallMs is raised from 900000 to 3600000 (60 min), and maxMoves stays 30. Evidence: TASK-0102's rerun 20261026T155348Z ran 29 turns with 0 failed jobs but timed out at the 15-min cap in fight round 4, at about 35 s per real-model turn. Contract specs/032-playtest-harness/contracts/scenario.md updated. Lint, typecheck and the CI playtest (ended, pass) are green. The server unit suite without a DB fails only adjudicate.integration ('requires a database'), as before.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Reconcile merge of origin/main (TASK-0102 #50) by sonnet-implementer: 77e6c75 merge, ef714d3 wiki re-ground (playtest-harness NEEDS-REVIEW, prose amended; freshness OK, 46 notes), 79c035a spec 033 T038 tick (post-merge). TEST_DATABASE_URL=… REQUIRE_DATABASE=1 pnpm ci:check exit 0: server 774 passed, 5 skipped. CI playtest: ended, pass. No WS flake.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approved: spend ceiling $22 for the M2 demo's paid scripted playtest (section C). The $6 demo-session audit ceiling stands.' Models are unchanged except dm.interpret maxTokens 2500 (operator approval on TASK-0102).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
