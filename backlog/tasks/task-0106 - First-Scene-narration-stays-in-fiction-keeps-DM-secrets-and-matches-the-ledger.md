---
id: TASK-0106
title: >-
  First Scene: narration stays in fiction, keeps DM secrets and matches the
  ledger
status: In Progress
assignee: []
created_date: '2026-10-26 17:50'
updated_date: '2026-10-26 20:13'
labels:
  - first-scene
  - dm
  - ai
milestone: m-2
dependencies: []
priority: high
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with real models, DM narration and companion speech pass the runtime audit at a normal rate, stay in fiction, never reveal DM-only facts, and never contradict the ledger. When the factual fallback does ship, it is in-fiction prose that covers every state change in the turn.

Why: TASK-0048's paid scripted playtest run 5 (20261026T171359Z-greyhollow-ford-provider, docs/design/m2-demo/provider-playtest-stalled-5/) had no failed job but 13 audit fails:
- The in-runtime dm.audit rejected narration until the factual fallback shipped in 23 of about 39 narrated turns, from the first turn. 9 more passed only after regenerating.
- The fallback text (apps/server/src/dm/fallback.ts) says 'X acts, and nothing changes. One action needs a clearer description.' It is out of fiction and contradicts state changes it does not cover (F23: an encounter ended).
- 6 hidden-info-leak fails, mostly companion Odo stating the DM-only motive (the bell wards off the river-things). Suspect: the companion and narrate prompts receive DM-only seed facts.
- 5 ledger contradictions, including a wrong actor name (F76) and a melee jab narrated as a thrown dagger (F17).
The M2 demo criterion 'the narration never contradicts the ledger' would fail. Carded by operator ruling 2026-10-26: own spec and PR, merged before the live demo (TASK-0048 Phase 6). It fixes code from TASK-0046 (specs/031-dm-runtime).

Approach: diagnose from run 5's evidence first (the dm.audit issue mix per rejected attempt, and which prompt carries which DM-only fact), then fix prompts, context filtering and the fallback, whichever the evidence shows. The engine still owns every number. Verify with an operator-approved paid provider run. The scripted seat's repeated fallback move is fixed on the TASK-0048 branch, not here.

Spec: specs/034-narration-quality
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Companion and narrate prompts receive no DM-only seed fact, proven by a test over the assembled prompts for the Greyhollow Ford seed
- [x] #2 The factual fallback is in-fiction prose with no system commentary, and it states every ledger change in the turn (including encounter start and end and table-mode changes), with tests
- [x] #3 The causes of run 5's dm.audit rejections are classified from evidence, and each selected cause has a fix with a test
- [x] #4 A paid provider playtest under an operator-approved ceiling shows the factual fallback in at most 10% of narrated turns, with zero hidden-info-leak and zero ledger-contradiction fails in its audit
- [x] #5 Existing dm tests and the scripted CI playtest stay green
- [x] #6 Spec phase: Reproduce the run-5 defects (AC #3) — DISPATCH (sonnet)
- [x] #7 Spec phase: Player-facing context (US1; AC #1, #3) — DISPATCH (sonnet)
- [x] #8 Spec phase: Facts and fallback (US2; AC #2, #3) — DISPATCH (sonnet)
- [x] #9 Spec phase: Narrate and audit v2 (US3; AC #3) — DISPATCH (sonnet)
- [ ] #10 Spec phase: Verification run (US4; AC #4) — ORCHESTRATOR-RUN, PAID — RUN, FAILED, SUPERSEDED BY 5b
- [ ] #11 Spec phase: Phase 4b: Party-name filter and narrate v3 (US3; AC #3) — DISPATCH (sonnet)
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (operator ruling: new M2 card, own spec and PR, merged before the live demo). Worktree .worktrees/task-0106, branch task-0106-narration-quality, cut from origin/main 81dfb7d. Spec number 034 claimed with a stub.

Spec authoring by opus-implementer: 179a7fd (spec, plan, research, quickstart, tasks; contracts player-facing-context, narration-facts, fallback-summary, audit-criteria; evidence/run5-classification.json). Clarify was skipped. Run 5: 23 of 39 narrated turns fell back. 184 audit issues: 68 auditor error, 27 narrator, 85 craft, 4 unverifiable. Selected causes: A1 party not named, A2 no-effect undefined, A3 clarify relayed verbatim, A4 LLM doctrine/other issues block. Leaks L1, L2, L3, L5. Contradictions F17, F23, F76, F81. F77 is a playtest-auditor false positive.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Orchestrator rulings on the spec's open points: (1) Seat-fallback cut: ratified. Exclude turns that are only a seat fallback move (any text in the scenario's moves.fallback list, now 5 entries after TASK-0048 b3f09ca), and report the all-turns rate beside it. (2) Location-secret clause edit: ratified, because the seed already makes the clause public. (3) Playtest-auditor false positives and new player-agency fails at verification: ratified, commit the evidence and stop for an operator ruling. (4) Director losing Snag's motive: revisit card TASK-0107 (m-3, trigger). (5) Director/interpret user-id transcript naming: revisit card TASK-0108 (m-3, trigger). (6) goalNote leak: accepted as unverifiable now; the Phase 5 audit is the check.

Phase 1 by sonnet-implementer: f99591b. Fixture run5-narration-quality.json plus narration-quality-repro.test.ts: 11 tests, green on the unfixed code, reproducing F23, L1-L3, F17, F76, A3 and A4. Server REQUIRE_DATABASE=1: 706 passed, 5 skipped. Lint, typecheck and boundaries pass. Stack stacks-task-0106 is up (:3106), both DBs migrated. Note: a fresh worktree needs pnpm build once before vitest resolves @the-stacks/srd.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 by sonnet-implementer: 05eac3d (seed edits), 58eb3c3 (PlayerSeedView in seed/views.ts; narrate and companion builders take it; named public transcript lines; director-v2, chronicle-v2, companion-v2), 6be4d1f (tests and ticks). AC #1 test player-facing-prompts.test.ts: 9 assembled prompts contain no dmOnlySeedText string, no river-things or wards, no DM-visibility marker, and no seat user id. Reproduction tests L1-L3 and F76 now assert the fixed behavior. Server REQUIRE_DATABASE=1: 714 passed, 5 skipped. Lint, typecheck and boundaries pass. The playtest CLI is not on this branch (TASK-0048's); the composite covers it in Phase 5.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approved: spend ceiling $22 for the TASK-0106 verification run (Phase 5).'

Phase 3 by sonnet-implementer: 2552170 (facts v2: party with controller, npcNames, public events, setting, roll target; factEntries renders the roll reason and target), 767bbec (fallback rewrite: deterministic in-fiction sentences per change and event kind, closing 'What does X do?' on clarify, no trackers, no digits), 16ef7a8 (tests: fallback.test.ts with 15 tests including a 400-case property test; F17 and F23 repros now assert the fixed behavior). Run-5 seq 88 fallback: 'Kestrel acts, and nothing changes. The fight is over.' became 'Kestrel goes ahead with it. The fighting stops.' Server REQUIRE_DATABASE=1: 734 passed, 5 skipped.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 by sonnet-implementer: 752d98a (narrate-v2 and audit-v2: party and world sections, the no-effect definition, open-question rule), 7391633 (audit node: code derives pass or fail; deterministic, ledger-mismatch, invented-mechanics and player-agency issues block; LLM doctrine and other issues are advisory; regenerates carry only blocking issues; new clarify check requires a closing question; issue details quote the matched text; per-attempt word count), 7c62548 (tests, A3 and A4 repros now assert the fixed behavior). Server REQUIRE_DATABASE=1: 742 passed, 5 skipped. Lint, typecheck and boundaries pass.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 setup 2026-10-26: composite .worktrees/task-0106-run = origin/task-0048-playtest a99ddd8 (holds seat fix b3f09ca) + merge of origin/task-0106-narration-quality → fda4abf (clean merge, never pushed). Stack stacks-task-0106-run (:7902), both DBs migrated (app DB via TEST_DATABASE_URL), app restarted. Pre-check B1: server tests 829 passed, 1 failed: TASK-0048's test/playtest/checks.test.ts 'passes the DM runtime's factual summary, with a recorded death' builds NarrationFacts by hand in the pre-034 shape (no events/party/setting), and the new factualSummary throws on facts.events. Orchestrator ruling: a fixture-shape lag in TASK-0048's test, not a runtime defect; the provider run proceeds. The test's facts literal gains the new fields in TASK-0048's reconcile merge after TASK-0106 lands. CI playtest in composite: ended, pass. Estimate upper bound $21.60, ceiling $22 (operator approval above). B2/B3: moves.fallback is now a 5-entry list; the C5 selector matches any of those texts.

Phase 5 verification 2026-10-26: run 20261026T183818Z-greyhollow-ford-provider at composite fda4abf. FAIL on AC #4. Outcome stalled (seat-exhausted) after 11 moves, no failed job, $7.18 over 321 calls of $22. Fallback rate excluding seat-fallback turns 12/34 = 0.35 (bar 0.10; run 5 was 0.50); all turns 13/38. hidden-info-leak 0 (run 5: 6). ledger-contradiction 3 (bar 0). player-agency 4. Classification (evidence/verify-…/classification.md): E1 dm.narrate maxTokens 500 with hidden reasoning, 17 of 79 calls at the cap and 9 empty attempts (config). E2 dm.audit still flags world NPCs (Pell, Snag) as player-agency, 10 of 21 blocks (code filter, needs a catalog row). E3 the narrator invents hero wounds and moves the hero on a foe's failed attack (narrate-v3 rule, needs a catalog row). F4 is a playtest-auditor false positive, F32 a chronicle conflation (journal), F54 a runtime ordering quirk (an action that ended the encounter then resolved refused). Evidence: ed46cec. STOPPED for an operator ruling before further spend.

OPERATOR APPROVAL 2026-10-26, in the operator's words (the message arrived cut at 300 chars): 'Approved: raise dm.narrate maxTokens from 500 to 1500 in the root .env and the composite and TASK-0048 worktree .env files; amend spec 034 with E2 (player-agency blocks only when it names a party character) and E3 (narrate-v3: a foe's failed attack leaves the hero unchanged and unmoved); rerun verif'. Applied: dm.narrate maxTokens 1500 in the root .env, .worktrees/task-0106-run/.env and .worktrees/task-0048/.env (exactly one match each). The estimate's upper bound is now $23.40, above the $22 ceiling, so the rerun ceiling and the F4/F32/F54 and AC #4 bar rulings were not received and are re-asked before the rerun.

Spec amendment by opus-implementer: 5ed2fe4. E2: a player-agency issue blocks only when its detail names a party term (full name, characterId or given name; companions count; fixed title list; whole-word, case-insensitive). On the Phase 5 evidence this keeps 13 of 21 blocking. E3: narrate-v3 rule (a foe's failed attack, grab or save leaves the party member unchanged and unmoved; no wound without a damage fact). Audit stays v2. Phases 4b (T048–T052, sonnet) and 5b (T053–T057, orchestrator, paid) added; Phase 5 is marked run, failed, superseded.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
OPERATOR APPROVAL AND RULINGS 2026-10-26, in the operator's words: 'Approved: $25 ceiling for the TASK-0106 rerun. F4 is a false positive. Card F32 and F54. AC #4's contradiction bar counts narration-caused contradictions only.' Carded: TASK-0109 (F32, chronicle conflation) and TASK-0110 (F54, action refused after ending the encounter), both m-3.
Orchestrator rulings on the amendment's open points: (1) the 'first-named character' rule is NOT adopted; it goes beyond the approved E2 wording, and the 5b result decides whether it is needed. (2) Closing-question complaints filed as player-agency (3 of 13) are recorded only; the 5b result shows their weight.

Phase 4b by sonnet-implementer: 050dbdc (E2 party-name filter in nodes/audit.ts; the contract's 11-case table plus 4 node tests), db1da9f (E3 narrate-v3 rule verbatim after 'No rules effect'), e1d9743 (ticks). Server REQUIRE_DATABASE=1: 761 passed, 5 skipped. Lint, typecheck and boundaries pass. No WS flake.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5b setup: composite at 3ae5a54 (Phase 4b tip merged in). dm.narrate maxTokens 1500 confirmed (T053). Ceiling $25 (operator approval above). Estimate upper bound $23.40.

Phase 5b rerun 2026-10-26: run 20261026T192319Z-greyhollow-ford-provider at composite 3ae5a54. FAIL on AC #4, rate only. Fallback rate 4/22 = 0.18 (bar 0.10; verify 1 was 0.35, run 5 0.50); all turns 6/27. hidden-info-leak 0. Narration-caused ledger-contradiction 0. player-agency 3 (F1 hero moved at scene start; F6 a v3 breach; F7 companion treated as hero). Stalled seat-exhausted after 11 moves, $5.37 over 235 calls of $25. Causes: R1 the deterministic digits check failed all 3 attempts in 3 of the 4 non-seat fallbacks, and its detail does not quote the match; R2 the seat declares actions for an unconscious Tamsin; R3 one invented near-miss. E1 mostly fixed (2 of 51 narrate calls at 1500). Evidence and classification: 30aefb4. STOPPED for an operator ruling before further spend. Total TASK-0106 paid spend: $7.18 + $5.37 = $12.55.

OPERATOR RULING 2026-10-26, in the operator's words: 'Ruling: accept TASK-0106 with the AC #4 rate bar at 20%. Leaks and contradictions are at zero. Card R1 (digits), R2 (seat acts for a downed hero) and the player-agency residue in m-3. Proceed to Phase 6, PR and the demo.' Carded on main: TASK-0111 (R1 digits check), TASK-0112 (R2 seat and downed hero), TASK-0113 (player-agency residue: F1, F6, F7, seq 130). AC #4 is met under the ruling: the rerun rate was 0.18 against the 0.20 bar, with 0 leaks and 0 narration-caused contradictions.

Phase 6 by sonnet-implementer: c5836ae. TEST_DATABASE_URL=… REQUIRE_DATABASE=1 pnpm ci:check exit 0: srd 140, engine 221, session-model 566, server 761 passed and 5 skipped, web 21 plus 125. No WS flake. Amended-by lines in 031 audit.md, nodes.md, scene-seed.md, companions.md and doctrine.md. T045: the composite CI playtest at 3ae5a54 passed (ended, pass). T046: the composite was torn down and env:prune --check is clean.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: ac81163. dm-runtime was NEEDS-REVIEW, split. New note dm-narration-quality covers PlayerSeedView, named transcripts, facts v2, audit pass/fail and the party-name filter, the in-fiction fallback and the prompt versions. CAPSULES and INDEX updated. Freshness: OK, 46 notes fresh. T047 is done before the PR rather than after the merge (runbook doctrine).
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
