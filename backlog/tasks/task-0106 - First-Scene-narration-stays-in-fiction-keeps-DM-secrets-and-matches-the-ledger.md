---
id: TASK-0106
title: >-
  First Scene: narration stays in fiction, keeps DM secrets and matches the
  ledger
status: In Progress
assignee: []
created_date: '2026-10-26 17:50'
updated_date: '2026-10-26 18:35'
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
- [ ] #4 A paid provider playtest under an operator-approved ceiling shows the factual fallback in at most 10% of narrated turns, with zero hidden-info-leak and zero ledger-contradiction fails in its audit
- [ ] #5 Existing dm tests and the scripted CI playtest stay green
- [x] #6 Spec phase: Reproduce the run-5 defects (AC #3) — DISPATCH (sonnet)
- [x] #7 Spec phase: Player-facing context (US1; AC #1, #3) — DISPATCH (sonnet)
- [x] #8 Spec phase: Facts and fallback (US2; AC #2, #3) — DISPATCH (sonnet)
- [x] #9 Spec phase: Narrate and audit v2 (US3; AC #3) — DISPATCH (sonnet)
- [ ] #10 Spec phase: Verification run (US4; AC #4) — ORCHESTRATOR-RUN, PAID
- [ ] #11 Spec phase: Full gate (US5; AC #5)
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
