---
id: TASK-0048
title: 'First Scene: scripted-dice playtest harness, auditor agent, milestone demo'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 14:03'
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
