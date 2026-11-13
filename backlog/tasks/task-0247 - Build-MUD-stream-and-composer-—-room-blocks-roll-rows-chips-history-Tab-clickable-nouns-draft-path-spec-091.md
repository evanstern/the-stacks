---
id: TASK-0247
title: >-
  Build: MUD stream and composer — room blocks, roll rows, chips, history, Tab,
  clickable nouns, draft path (spec 091)
status: Done
assignee: []
created_date: 2026-11-05 05:48
updated_date: '2026-11-13T17:05:00Z'
labels:
  - web
  - ux
  - ws:table-ux
milestone: m-10
dependencies:
  - TASK-0199
  - TASK-0236
priority: medium
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Stream and composer emit Intent pills; absorbs 0132, 0133, 0162, 0169, 0187, 0190, 0243; amend spec 091.

Intent: keep the spec 091 stream, roll rows and composer baseline. Clickable nouns, ways and Tab completion draft Intent pills at the `draft` commit state, which lives only in the client. Slash commands parse through the N-01 (TASK-0266) text grammar. Roll rows render the code facts from TASK-0245. Absorbed: progress indicator between fact rows and narration (0132); roll rows before prose (0133); draft kept until echo (0162); roll rows name check and mode (0169); 1024 px column (0187); dialogue rows (0190); both d20s shown (0243). Amend spec 091 after CP-4. UI: no modals.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): second half of the TASK-0236 table redesign (docs/design/mud-ux/decision.md): scene fields, room blocks, roll rows, rules lines, filter chips, and a MUD composer with one draft(text) path, built on spec 066.

Spec: specs/091-mud-stream-and-composer
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Roll rows render code facts before prose, name the check and roll mode, and show both d20s.
- [x] #2 A progress indicator shows between fact rows and narration until the first narration token arrives.
- [x] #3 NPC dialogue renders as distinct rows, and the transcript column is capped at 1024 px and centred.
- [x] #4 Spec 091 is amended against Intent contract v1.1 and reviewed by the operator at C-AMD before implementation.
- [x] #5 Fact rows render from the ledger at resolve time, not from the narration text (spec 098 OQ-3).
- [x] #6 Spec phase: Wiki re-ground
- [x] #7 Spec phase: Verify
- [ ] #8 Spec phase: Scene fields and seed ways (R1; FR-008 data; plan D1, D2, DA4, D8)
- [ ] #9 Spec phase: Stream items and the narration filter (US3, US6; FR-006, FR-007, FR-026, FR-027, FR-029 data; plan D3, DA1, DA2)
- [ ] #10 Spec phase: Stream rendering (US3, US6; FR-008 to FR-011, FR-026 to FR-030; plan DA3, D5)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0132 (Show progress between Commit and the DM's narration) by replan-2026-11: Progress indicator between fact rows and narration.

Merged from TASK-0133 (Render dice lines before and distinct from narration prose) by replan-2026-11: Roll rows render before prose.

Merged from TASK-0162 (Play composer keeps a line's draft until its echo lands) by replan-2026-11: Composer keeps draft until echo.

Merged from TASK-0169 (Roll lines name the ability, skill and roll mode of the check) by replan-2026-11: Roll rows name check and mode.

Merged from TASK-0187 (Play route: cap the transcript at 1024 px, centered) by replan-2026-11: Column width.

Merged from TASK-0190 (Narration sets NPC dialogue apart from the prose) by replan-2026-11: Dialogue rows.

Merged from TASK-0243 (Dice lines hide the dropped die on advantage and disadvantage) by replan-2026-11: Show both d20s.

Rewritten by replan-2026-11. Stream and composer emit Intent pills; absorbs 0132, 0133, 0162, 0169, 0187, 0190, 0243; amend spec 091.

AC re-authored by replan-2026-11.

T015 (spec 092): amend spec 091: draft(text) -> draft(intent); closed command set -> the full verb table; /help is the Help action and composer help moves to /? (Q1); unknown /words are refused, not sent as speech; FR-024 'no new gate request' is superseded once TASK-0268 lands. Review at C-AMD.

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 098 OQ-3.

Spec 066 OQ-3 (operator C-AMD ruling 2026-11-11, "Approve all"): AC #10 moved to TASK-0199. AC #3 narrows to pills, Tab completion and inline PARSE_* wording, because TASK-0199-web's Send already parses every slash verb.

Claimed 2026-11-13 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0247, branch task-0247-mud-stream, cut from origin/main f761f1c6. No spec dir: signed escape line covers this task.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

C-AMD ruling (operator, 2026-11-13, verbatim): "Approve all". Applies spec 091 OQ-A1..A15 and the seed note as recommended. Split: AC #1, #2, #3, #6 move to TASK-0329 (Intent pills, spec 091 part 2); this card keeps AC #4, #5, #7, #8, #9. OQ-A8: R1 (a) re-confirmed as the C-GATE ruling for the SceneSchema optional fields. Follow-ups carded: TASK-0330 (OQ-A4), TASK-0331 (OQ-A5), TASK-0332 (OQ-A15). TASK-0318 folded into TASK-0329; TASK-0325 closes on this merge (FR-011). 0275/0277 hold for TASK-0329; 0276 holds for this card.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 1 landed 1f0fb167. Orchestrator finding: plan D2 put the duo ways (loft, ferry, causeway) on all four seeds, but greyhollow-ford-reed-camp has no loft or ferry zone, and the seed validator only refuses hidden zones, not missing ones. Fix rides Phase 2: refuse a /move to a zone the seed lacks; reed-camp keeps only ways its zones support. Within the ruled spec's intent (DA4: ways validated as contract text).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 2 landed 4dcaeb44 (+ fix-up af26b1a9: unknown-zone ways refused; reed-camp keeps /move #causeway only). Implementer call accepted: hp.changed rules lines infer damage/healing from the HP delta, because ledger rows carry no cause.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 3 landed ad99be2c. Open: npc_say talk rows carry characterId null, so the row label falls to actorLabel; Phase 4 adds a test that an npc_say row is named for the NPC (T018 'named dialogue row').

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 4 landed 471e4a9f: contrast pairs pass 4.5:1 light/dark, no app.css change; additive Amendment (TASK-0247) blocks in five contract files (R1 (a) via OQ-A8), ws-protocol and proposal-seam untouched. npc_say rows now name the NPC from the scene cast (test failed first, fixed in view-model.ts).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 5 landed c3a6486c: 11 NEEDS-REVIEW notes (gate list, wider than tasks.md's 5); prose amended in dm-runtime, dm-narration-quality, seed-npc-presence, session-model, play-route; six re-pin-only, each a one-line pin diff, reasons in the commit report. plan empty, freshness OK (65).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (live-check verifier)

Live check a66b84c2: 8/8 pass, no modal, no overflow. Findings triaged by orchestrator: (1) Rules chip hides narration why/ruling/State rules lines -> breaks FR-009, fix; (2) echoed declaration dialogue row ends with a stray ". -> fix; (3) roll detail repeats the d20 face -> fix; (4) Table talk hides the room block -> correct per FR-009 (room = In character), no change.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (live-check fixes)

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5 (play-route re-pin)

Live-check fixes 84636aab (rules lines as Rules items, restate quote-period stripped, roll face list once); play-route re-verified and re-pinned 86c7450d.

Final gates (orchestrator, after merging origin/main): REQUIRE_DATABASE=1 pnpm ci:check exit 0; check-boundaries exit 0; wiki plan empty; freshness OK (65); spec-bridge check exit 0.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (CI failure diagnosis)

PR #177 CI failed twice on ai-actor-parity companion attempt test (run 43455978886). Diagnosis: no branch cause (siblings pass, seed load clean, path unchanged vs main, 19/19 local incl. CPU load). Carded TASK-0333 (instrument; trigger: next failure). Full CI re-run.

PR #177 CI run 43459199179 (head e3aa4af0) failed the same ai-actor-parity companion attempt test: 3 of 3 CI runs on this branch, 0 in 100 on main. Treated as branch-specific in CI, not a flake. Merge held; put to operator.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (CI root-cause attempt 1; incomplete, instrumentation 294c441d)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (CI root-cause attempt 2)

CI on 294c441d: attempt 1 pass, attempt 2 fail with an empty companion log, so the job exits silently. Branch record 4 fail / 1 pass. Next: expose plays and fake-gateway purposes; merge only after 2 consecutive green runs on the fix.

CI root cause (evidence, run 43463700007): companion job played (declare seq 15, commit seq 16 accepted, logs empty); only gateway purpose so far was dm.companion, so the listener-enqueued commit turn (adjudicate/narrate, which writes the carriers) had not run when the test read rows. Test race, not production. Fix 41f191dd: odoTurn drains until the fake gateway records a call beyond the companion's (bounded). CI run 43465351532 green on attempts 1 and 2. Instrumentation kept (TASK-0333 AC1). Open: why this branch hit the window more often than main; carried on TASK-0333.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Scene fields and seed ways (R1; FR-008 data; plan D1, D2, DA4, D8): 7/7 · Stream items and the narration filter (US3, US6; FR-006, FR-007, FR-026, FR-027, FR-029 data; plan D3, DA1, DA2): 7/7 · Stream rendering (US3, US6; FR-008 to FR-011, FR-026 to FR-030; plan DA3, D5): 9/9 · Contrast and contract blocks (FR-021, FR-022; SC-003, SC-007; plan D9, "Contract amendments"): 3/3 · Wiki re-ground: 2/2 · Verify: 2/2). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
