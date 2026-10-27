---
id: TASK-0048
title: 'First Scene: scripted-dice playtest harness, auditor agent, milestone demo'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-27 02:51'
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
- [x] #11 Spec phase: The M2 demo — ORCHESTRATOR AND OPERATOR, NOT DISPATCHED (US4, US5; AC #4, #5)
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

Demo section C, paid scripted playtest (run 5) 2026-10-26: 20261026T171359Z-greyhollow-ford-provider at 1db60e3. Outcome stalled at the 30-move cap, verdict incomplete, $7.52 over 391 calls of the $22 ceiling. No failed job (DM pipeline healthy after TASK-0102). Findings: 13 fail, 64 warn, 32 note. (a) The scripted seat ran out of script: from pt-19 (17:30) it repeated the fallback move 'I press on toward the ferry before dark.' 12 times after the scene diverged (Snag's standoff at the ferry chain). (b) The in-runtime dm.audit rejected narration until the factual fallback shipped in 23 of about 39 narrated turns (9 more passed after regenerating), from segment 1 on. The fallback text 'X acts, and nothing changes. One action needs a clearer description.' is out of fiction and contradicts state changes it does not cover (F23: encounter ended). (c) 6 hidden-info-leak fails, mostly companion Odo stating the DM-only motive (the bell wards off the river-things). (d) 5 ledger contradictions, including a wrong actor name (F76). Evidence: docs/design/m2-demo/provider-playtest-stalled-5/ (untracked until the demo record commit). Run 4's dir was renamed provider-playtest-failed-4. Stopped before the demo for an operator ruling (m2-demo.md C4).

OPERATOR RULING 2026-10-26, in the operator's words: 'Ruling: card the narration problems (fallback rate and fallback text; companion hidden-info leaks; ledger contradictions) as a new M2 card, own spec and PR, merged before the live demo. Fix the scripted seat's repeated fallback move on the TASK-0048 branch.'

Scripted-seat fix b3f09ca by sonnet-implementer (operator ruling). moves.fallback is now a list (the legacy single object is read as a one-element list). The driver cycles the list with no immediate repeat. A stall stop ends the run as stalled, with run.json stallReason 'seat-exhausted', after 3 consecutive fallback moves whose turns add no ledger 'change' row (a table-mode row counts only on a mode flip). Greyhollow Ford has 5 fallback moves. Contracts 032 scenario.md and data-model.md updated. Server tests with REQUIRE_DATABASE=1: 783 passed, 5 skipped. CI playtest: ended, pass. Orchestrator reviewed the driver diff.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Reconcile merge of origin/main (TASK-0106 #51) by sonnet-implementer: 6eadf52 merge (wiki INDEX and CAPSULES conflicts only), 944f2a1 (checks.test.ts factual-summary test gains the facts v2 fields; assertion unchanged), 4ff5d9e (playtest-harness NEEDS-REVIEW re-pinned with the seat-cycling and stall-stop prose; freshness OK, 47 notes). TEST_DATABASE_URL=… REQUIRE_DATABASE=1 pnpm ci:check exit 0: server 849 passed, 5 skipped. CI playtest: ended, pass. No WS flake. No tick flips.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Demo section D prep 2026-10-26: stack rebuilt at d2d88cb (code 4ff5d9e). The app DB was migrated via TEST_DATABASE_URL, then the test DB. The app restarted with a clean boot (no errors, no unconfigured-purposes warning). Models as in the AI config, with dm.interpret maxTokens 2500 and dm.narrate 1500. Demo session id: 2811b339-bb03-4593-b3fd-0a969a5d2027. Waiting on the operator to create the operator account (auth:create-operator) and play Tamsin in Brave.

Demo section D: operator account created in the app DB on the second attempt. The first went to the test DB because of create-operator's TEST_DATABASE_URL precedence, recorded on TASK-0098. create-operator echoed the password, recorded on TASK-0103. The orchestrator watches session 2811b339-bb03-4593-b3fd-0a969a5d2027 for failed jobs and audit flags.

Demo blocker 2026-10-26: in session 2811b339-bb03-4593-b3fd-0a969a5d2027 the server seated the operator as Tamsin (seq 3), but the play page maps any operator to the DM viewer (apps/web/app/play/use-live-table.ts viewerForUser, spec 030 R4). So the composer listed no character, Action was disabled, and the operator's message went out as talk with characterId null (seq 13); no turn ran. The session was abandoned after scene start. OPERATOR RULING 2026-10-26, in the operator's words: 'Fix the view'. The fix (as offered): an operator is the DM viewer only when holding the DM seat; seated as a character, they view as that player. Then rebuild and restart the demo.

Operator-viewer fix 53a78fa by sonnet-implementer (operator ruling 'Fix the view'): apps/web/app/play/viewer.ts viewerFor(user, projections). The holder of the human DM seat gets dm. A user controlling a party character gets player. An unseated operator gets dm (unchanged). The viewer re-derives as events arrive. The server already decides by seat (session-model gate roles.ts, permissions.ts, authority.ts; ws/registry.ts:62-68), so no server change; a regression test in gate.integration.test.ts covers a seated operator's declare and commit. Spec 030 R4 has an Amended line. ci:check REQUIRE_DATABASE=1 exit 0: server 850 passed, 5 skipped. Not yet confirmed in a live session.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Demo restart: stack rebuilt at 5620ad9 (code 53a78fa), both DBs migrated, clean boot. New demo session id e8c848ec-11e9-442d-9bfa-8c26a0d84fcd. The abandoned session 2811b339 is noted for the record. The operator recreates the operator account (app DB) and starts the scene.

Demo section D 2026-10-26: the operator recreated the operator account (app DB), started session e8c848ec-11e9-442d-9bfa-8c26a0d84fcd (202), and confirmed Action is enabled. The operator-viewer fix 53a78fa is verified live in Brave. The operator is playing Tamsin.

Operator demo findings (live, session e8c848ec), each to be carded in the demo record: (1) No out-of-character 'ask the DM' channel. Clarifying questions ('where am I standing?', 'what color is the boat?', 'do I hear birds?') must be declared as Tamsin's actions, which spends a move and may advance the Director's clocks. Talk never triggers a DM turn (TurnTriggerSchema: commit, approval, npc-turn, scene-start, manual, reconcile). (2) No progress indication between Commit and the DM's narration (a turn takes about 30–60 s), so the table looks stalled.

Operator demo finding (3): on a companion's declared action, the Comment, Approve and Object buttons stay disabled until the comment box has text (apps/web/app/play/components/action-card.tsx disabled={empty}). Approve and Object read as one-click reactions, and requiring text made them look broken. (4, orchestrator-observed) Turn at seq 25-26: the in-runtime dm.audit flagged fail-forward narration of a failed Stealth check as invented-mechanics, which contradicts the doctrine's fail-forward principle, so the plain fallback shipped.

Operator demo finding (5), runtime: in free mode a companion may declare without committing (Odo, act-odo-1, seq 35, 20:58:16). Companion jobs run only after a DM turn ('prompt') or when a hold ends (dm/companion.ts, worker.ts:300), and a human's comment or approval (seq 37-38) does not re-run the companion. So the declaration waits forever under 'Waiting for Brother Odo to commit', and the table looked frozen for over 4 minutes. Workaround in the demo: the human commits their own action to start the next turn.

Demo paused 2026-10-26 at the operator's request (a break of a few hours). Session e8c848ec-11e9-442d-9bfa-8c26a0d84fcd stays live on stacks-task-0048 (app :3048), last seq 77; jobs: companion:succeeded:7, turn:succeeded:11, chronicle:succeeded:9. 8 human actions committed so far, 2 narration fallbacks (seq 25 and 65), no failed turn. Findings 1-5 are logged above. Resume: the operator reopens http://localhost:3048/play/e8c848ec-11e9-442d-9bfa-8c26a0d84fcd in Brave and keeps playing Tamsin; the orchestrator re-arms the session watch. Do not env:down this stack before the demo ends (that would wipe the session).

Operator demo finding (6), UI: dice lines in narration (e.g. 'Tamsin Vale — …: 1d20+2 → 4 = 6 vs DC 12: failure') render as ordinary prose. They should be visually distinct, monospaced like a code block, so rolls read apart from the story text.

OPERATOR RULING 2026-10-26, in the operator's words: 'Ruling: keep playing with the workaround (commit Tamsin's action). Card the companion stall in m-3.' Finding 5 recurred during the resumed demo. Carded on main: TASK-0114.

Demo complete and recorded (draft) at 7ff5e52: scene ended (seq 330), 47 DM turns, 0 failed, 10 fallbacks; audit $2.87 (11/24/23). Record resolutions await the operator's sign-off. Orchestrator handoff written to docs/design/m2-first-scene-sweep-runbook.md ('Handoff — 2026-10-27 UTC') on this branch.

Demo record sign-off (operator, 2026-10-27, in chat with the third orchestrator session): (1) Accept all: every proposed-accepted advisory row and F19 are accepted. (2) Agree, criterion met: F40 carded to TASK-0111; F49 and F52 false positive (row 301: no hostiles left; F52 read the stale journal at row 303); 'narration never contradicts the ledger' is met. (3) F32 false positive (Pell is a world character). (4) Card findings 1, 2, 6 in m-3: TASK-0131 (OOC ask-the-DM channel), TASK-0132 (progress between Commit and narration), TASK-0133 (dice lines distinct). Finding 3 accepted.

spec-bridge sync: Foundations — purpose, schemas and fixtures (US1, US2, US3; AC #1, #2, #3): 9/9 · The harness run (US1; AC #1): 9/9 · The auditor (US2; AC #2, #3): 12/12 · Provider mode, the cost guard and the CLI (US3; AC #3, #1 evidence): 9/9 · Demo runbook and record template (US4, US5 preparation; AC #4, #5): 4/4 · The M2 demo — ORCHESTRATOR AND OPERATOR, NOT DISPATCHED (US4, US5; AC #4, #5): 6/6 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
