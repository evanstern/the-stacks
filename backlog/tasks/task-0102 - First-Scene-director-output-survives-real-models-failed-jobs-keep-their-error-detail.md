---
id: TASK-0102
title: >-
  First Scene: director output survives real models; failed jobs keep their
  error detail
status: In Progress
assignee: []
created_date: '2026-10-26 14:50'
updated_date: '2026-10-27 02:56'
labels:
  - first-scene
  - dm
  - ai
milestone: m-2
dependencies: []
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with real models through the gateway, the DM runtime's director node yields schema-valid output, so a turn no longer fails with 'stopped at director: invalid-output'. When any node's output does fail validation, the job record keeps the schema issues and enough of the raw output to diagnose it.

Why: TASK-0048's paid scripted playtests (docs/design/m2-demo/provider-playtest*) stalled at the third or fourth turn in 2 of 2 runs.
- Run 2: the director hit maxTokens 600 and its JSON was truncated.
- Run 4: with maxTokens 1500, the director produced 962 and then 280 tokens, and both failed the schema, so it was not truncation.
- The failed job's error is only 'stopped at director: invalid-output'. apps/server/src/dm/pipeline/call.ts builds detail.issues, but the job error drops it.
The M2 demo cannot reach the scene's end until this is fixed. Carded by operator ruling 2026-10-26; it fixes code from TASK-0046 (specs/031-dm-runtime) and blocks TASK-0048's demo phase.

Approach: capture the real failing director output first, from a run against the configured provider under an operator-approved spend ceiling. Then fix the prompt, the schema or the parsing, whichever the evidence shows. No vendor SDK (decision-0007). The engine still owns every number.

Spec: specs/033-director-robustness
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A failed node-output validation stores its schema issues, the purpose and a bounded excerpt of the raw output in the turn job's error detail, and a test proves it.
- [x] #2 The real failing director output is captured and committed as a fixture, and a test reproduces the failure against it.
- [x] #3 The director accepts real-model output for the Greyhollow Ford scene: a provider-mode playtest gets past the turn where runs 2 and 4 failed, with no director invalid-output.
- [x] #4 Any schema or prompt change keeps every existing dm test green, and the scripted CI playtest still passes.
- [x] #5 Spec phase: Persist diagnostics (US1; AC #1)
- [x] #6 Spec phase: Capture the real failure (US2; AC #2) — ORCHESTRATOR-RUN, PAID
- [x] #7 Spec phase: Classify and fix (US2, US3; AC #2, #3)
- [x] #8 Spec phase: Verification run (US3; AC #3) — ORCHESTRATOR-RUN, PAID
- [x] #9 Spec phase: Full gate (US4; AC #4)
- [x] #10 Spec phase: Phase 3b: Interpret fix and the skill gate (US5; AC #3, amendment) — DISPATCH (sonnet)
- [x] #11 Spec phase: Phase 4b: Verification rerun (US5; AC #3, amendment) — ORCHESTRATOR-RUN, PAID
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (operator ruling: a new M2 card fixed in its own PR before the demo resumes). Worktree .worktrees/task-0102, branch task-0102-director-robustness, cut from origin/main 60e8f89. Spec number 033 claimed with a stub.

Spec authoring by opus-implementer: e84da5a. Clarify was skipped.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Design: the failure record goes in jobs.result.failure (issues, plus attempt excerpts up to 8000 chars). jobs.error stays a fixed string. normalizeDirector is lenient but never touches a number. Phases 2 and 4 are paid, orchestrator-run captures in a composite worktree (origin/task-0048-playtest plus this branch, never pushed). The spec defaults on its open questions stand. Q5 is moot, since 31f61f7 is now pushed.

Phase 1 by sonnet-implementer: 1ab1136. A failed turn now writes jobs.result.failure {node, kind, message, detail: {purpose, promptVersion, issues, attempts[{attempt, outputTokens, chars, issues, excerpt}]}}. jobs.error stays a fixed string. /turns never serves the record. The server suite passes 657 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approved: spend ceiling $22 for the TASK-0102 capture run and $22 for its verification run.'

Phase 2 setup 2026-10-26 (orchestrator): composite worktree .worktrees/task-0102-run = origin/task-0048-playtest 639a94c + merge of origin/task-0102-director-robustness → 15f15fe (detached, never pushed). The merge conflicted only in .specify/feature.json (Spec Kit pointer, no code); resolved in the composite to the 033 side, neither branch touched. Stack stacks-task-0102-run (app :4951, db :16951, test-db :26951), both DBs migrated by hand (TASK-0098). dm.director maxTokens 1500 (claude/cc/claude-opus-5). Estimate: expected $1.90, upper bound $20.82. Capture ceiling $22 (operator approval above).

Phase 2 capture attempt 1 (runId 20261026T150802Z-greyhollow-ford-provider) was killed by SIGTERM when the desktop app restarted. It wrote no run directory, and the stack's DBs came back empty, so its spend is unrecorded (cc/ routes are subscription-backed). The DBs were re-migrated. The capture is rerun under the same $22 approval, detached with nohup.

Phase 2 capture 2026-10-26: run 20261026T150925Z-greyhollow-ford-provider, composite 15f15fe. Outcome failed: 12 turns succeeded and 5 moves committed (past the run 2/4 failure turns), then the turn at triggerSeq 114 (pt-5, reed-camp fight) stopped at director: invalid-output. Both attempts had goalNote over 300 chars (367 and 309; 783 and 245 output tokens). Spend $2.82 over 121 calls of the $22 ceiling. Fixture and evidence: cfd4929. Classification: C4 only, no prompt change (evidence/classification.md).

Phase 3 by sonnet-implementer: 900f48c (T013 reproduction, green on unfixed code) and 75ba690 (C4: normalizeDirector caps goalNote and beat/tableMode/scene/trackers reason at 300 chars at a word boundary; optional normalize hook on callJson; only the director passes it; no prompt change, PROMPT_VERSION stays dm.director-v1). Server suite with REQUIRE_DATABASE=1: 677 passed, 5 skipped. Lint, typecheck and boundaries pass. No WS flake. Orchestrator reviewed the diff.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 setup: composite at aa960b3 (branch tip 3bd622e merged in). Verification ceiling $22 (operator approval above).

Phase 4 verification 2026-10-26: run 20261026T152743Z-greyhollow-ford-provider, composite aa960b3. Spend $1.00 over 51 calls of the $22 ceiling. 4 moves committed and no director invalid-output, so quickstart C5 passes literally. But the run failed at turn job 6 (npc-turn, triggerSeq 61, act-kestrel-1): stopped at interpret: invalid-output. Attempt 1 hit maxTokens 1200 inside a code fence. Attempt 2 applied an invented condition 'spotted-lookout' (not in the condition enum). The run did not reach the reed-camp turn, so the C4 fix is proven offline only. Interpret is out of this spec's scope (contracts/director-output.md, 'Out of scope'). Evidence and second fixture: c085844. STOPPED for an operator ruling before any further spend.

OPERATOR RULING 2026-10-26, in the operator's words: 'Ruling: amend spec 033 to cover the interpret failure too, fix it in TASK-0102's PR, and rerun verification before Phase 5.' Operator requirement, in the operator's words: 'Conditions, spells, and other "rules" with definitions absolutely need to be deterministically defined and resolvable. It should not be possible for the AI to "invent" a condition without it being rejected by a gating mechanism.'

OPERATOR RULING 2026-10-26, in the operator's words: 'Card both follow-ups (spells resolved by SRD id; modifiers and DCs derived from sheets) in m-3. They do not block the M2 demo.' Carded on main as TASK-0104 (modifiers and DCs from combatant stats) and TASK-0105 (spells by SRD id, depends on TASK-0104). The spec 033 amendment is dispatched to opus-implementer and covers the interpret prompt, interpret truncation, and the skill gate.

Spec amendment by opus-implementer: a845ad2 (US5, FR-018 to FR-028; contracts/interpret-output.md and contracts/rules-terms.md; Phase 3b T025–T034, Phase 4b T035–T038, Phase 5 T039). Orchestrator rulings on its open points: (1) adjudicate also renders the closed lists and bumps to dm.adjudicate-v2, ratified; (2) the engine event schema stays a nullable string, ratified, because the gate sits at the command and narrowing needs an event version bump (constitution IV). Finding: interpret attempt 1 reported 1200 output tokens for 331 visible chars, so hidden reasoning counts against maxTokens (R10).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

OPERATOR APPROVAL 2026-10-26 (T035), in the operator's words: 'Approved: raise dm.interpret maxTokens from 1200 to 2500 in the root .env and the composite and TASK-0048 worktree .env files, for the TASK-0102 verification rerun and the demo. The $22 rerun ceiling stands.' Applied: dm.interpret maxTokens 2500 in the root .env, .worktrees/task-0102-run/.env and .worktrees/task-0048/.env. Each file had exactly one match and no other value changed.

Phase 3b by sonnet-implementer: 12591c3 (T025 reproduction, green on unfixed code) and 4552254 (T026–T034). The skill enum is defined once in the engine (check.roll command), and the server derives SkillSchema, CONDITION_KEYS and SKILL_KEYS from it. STEP_GRAMMAR now renders the closed condition, skill and damage-type lists and lives in prompts/step-grammar.ts, which keeps the narrate no-engine-import boundary test intact. dm.interpret-v2 and dm.adjudicate-v2. Interpret stays strict, with no normalizer. Tests: server REQUIRE_DATABASE=1 695 passed, 5 skipped; engine 221; session-model 566. Lint, typecheck and boundaries pass. No WS flake. Orchestrator reviewed the diff. The CI playtest is not on this branch; it runs in the composite (T022).
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4b setup: composite at 5fd107f (branch tip with 4552254). Scripted CI playtest in the composite (T022 precheck): outcome ended, verdict pass, run 20261026T155331Z-greyhollow-ford-ci. Rerun ceiling $22 (operator: 'The $22 rerun ceiling stands'). Estimate upper bound $21.60.

Phase 4b verification rerun 2026-10-26: run 20261026T155348Z-greyhollow-ford-provider, composite 5fd107f. PASS under the amended rule (quickstart C): no failed turn job (29 turn, 10 companion and 7 chronicle jobs succeeded), 6 moves committed, $5.07 over 265 calls of the $22 ceiling. Outcome timed-out: the scenario's maxWallMs of 900000 (15 min) cut the run in fight round 4, with about 35 s per AI turn. That limit is a TASK-0048 harness defect, fixed on the TASK-0048 branch before the demo's paid playtest. Evidence: b40d9f0. Total paid spend for TASK-0102: $2.82 + $1.00 + $5.07 = $8.89, plus attempt 1 (unrecorded).

Phase 5 by sonnet-implementer: f73c7f5 (Amended-by lines in 031 turn-jobs, node-seam, director, nodes and scene-seed, and in 026 commands) and 0de627c (ticks). TEST_DATABASE_URL=… REQUIRE_DATABASE=1 pnpm ci:check exit 0: server 695 passed and 5 skipped, srd 140, engine 221, session-model 566, web 21. No WS flake. T022: the composite CI playtest passed (ended, verdict pass). T024: the composite was torn down and env:prune --check is clean.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: 6ae6e4a. dm-runtime, dm-turn-jobs and dnd5e-engine were NEEDS-REVIEW, with prose amended. ingestion was re-pin only. New note dm-failure-and-gates, split from dm-runtime over the size budget. CAPSULES and INDEX updated. Freshness: OK, 45 notes fresh. spec-bridge check ok, 32 linked.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Merged via PR #50 (merge commit 9658265, 2026-10-26).

Done flip held: the spec-bridge gate needs T038 ticked. T038 (conditional on a failure) did not trigger and is annotated so. Its tick rides the TASK-0048 branch per the runbook's post-merge rule, and TASK-0102 flips to Done when TASK-0048 merges.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Turn jobs that fail now keep their diagnosis in jobs.result.failure (node, kind, purpose, prompt version, issues, bounded attempt excerpts), and jobs.error stays a fixed string. The director accepts real-model output: normalizeDirector caps goalNote and reason text at 300 chars and never touches a number (catalog row C4, chosen from the captured run). By operator ruling, the scope widened to interpret and the rules-term gate. Skills are now a closed 18-key enum defined in the engine. Interpret and adjudicate prompts v2 render the closed condition, skill and damage-type lists, and interpret stays strict. Spells (TASK-0105) and modifiers/DCs (TASK-0104) are carded for m-3. Verified by three paid runs ($8.89): the final run had 29 turns and 0 failed jobs. Also: ci:check with REQUIRE_DATABASE=1 green, scripted CI playtest pass, wiki freshness OK, spec-bridge ok.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
