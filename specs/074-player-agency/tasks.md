# Tasks: Player agency — one rule for Director, interpret, narrate and audit

**Input**: `specs/074-player-agency/` (spec.md, plan.md), card TASK-0113.

**Prerequisites**: none beyond `origin/main` b756b68f. The operator has not ruled OQ-1, OQ-2 or
OQ-3; the tasks below implement each default.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Each implementer phase ends with `pnpm ci:check` green and one commit led by
`TASK-0113:`. Touch only the files plan.md "Files the build touches" lists for the phase. Stop and
report if another file is needed. No paid model run; tests use the fake gateway.

## Phase 1: Rule source, Director, interpret, playtest auditor (card AC #3, #4, #5; US1, US4)

- [ ] T001 [US1] In `apps/server/src/dm/doctrine/doctrine.ts`, add `AGENCY_RULE`, `AgencyNode` and
      `agencyRule(node)` (plan D1). Revise the `hero-is-theirs` rule and right text (plan D1).
- [ ] T002 [US1] In `apps/server/src/dm/prompts/director.ts`, add `agencyRule("director")` to SYSTEM
      outside the doctrine cap. Rewrite the `goalNote` shape line (plan D2). Bump to
      `dm.director-v5`.
- [ ] T003 [US1] In `apps/server/src/dm/prompts/interpret.ts`, add `agencyRule("interpret")` to the
      system prompt outside the doctrine cap. Relabel the goal note in the user prompt (plan D2).
      Bump to `dm.interpret-v6`. Leave `OUTPUT_SHAPE` and `STEP_GRAMMAR` unchanged.
- [ ] T004 Bump `apps/server/src/dm/prompts/companion.ts` to `dm.companion-v7` and
      `apps/server/src/dm/prompts/react.ts` to `dm.react-v2` (plan R7). Change no other text.
- [ ] T005 [US4] In `apps/server/src/playtest/auditor/prompt.ts`, add the `## Party` section and
      `agencyRule("auditor")` (plan D5). Bump to `playtest.audit-v2`.
- [ ] T006 [US1] In `apps/server/test/dm/doctrine.test.ts`, assert `agencyRule(node)` holds every
      `AGENCY_RULE` line and the node line for all five nodes, and the revised pair text.
- [ ] T007 [US1] In `apps/server/test/dm/assemble.test.ts`, pin `dm.director-v5`. Assert the
      director system prompt holds `agencyRule("director")` and the goal-note shape line holds
      "names no party member's act, method, skill or reaction" (card AC #4).
- [ ] T008 [US1] In `apps/server/test/dm/interpret-prompt.test.ts`, pin `dm.interpret-v6`. Assert
      the system prompt holds `agencyRule("interpret")`. Build the prompt with goal note
      "Approach beat: call Stealth (Kestrel leads, +5)" and assert the user prompt labels it
      "pacing advice only; it never adds a step, a method or a skill" (card AC #5).
- [ ] T009 Re-pin versions in `apps/server/test/dm/companion-addressee.test.ts`,
      `apps/server/test/dm/react-prompt.test.ts` and
      `apps/server/test/dm/talk-turn.integration.test.ts` (run the last with
      `REQUIRE_DATABASE=1` on the worktree stack).
- [ ] T010 [US4] Create `apps/server/test/playtest/auditor-prompt.test.ts`: a seed with Tamsin
      (`human`) and Brother Odo (`companion`) lists "Tamsin Vale (human player)" and "Brother Odo
      (AI companion)"; the prompt holds `agencyRule("auditor")`; a null seed renders
      "(party unknown)" and still holds the rule (card AC #3).
- [ ] T011 Amend `specs/031-dm-runtime/contracts/doctrine.md` (the `hero-is-theirs` row) and
      `specs/032-playtest-harness/contracts/auditor.md` (the Party section, `playtest.audit-v2`).
- [ ] T012 Run `pnpm ci:check`.

## Phase 2: Facts, narrate, audit (card AC #1, #2; US2, US3)

- [ ] T013 [US2] In `apps/server/src/dm/facts.ts`, add `FactBand`, optional `FactRoll.band`,
      `FactInvoluntary`, optional `NarrationFacts.involuntary` and the pure `deriveInvoluntary`
      (plan D3). Set `involuntary` in `buildNarrationFacts` from this turn's action, NPC-turn and
      settle rows. Import no engine value.
- [ ] T014 [US2] In `apps/server/src/dm/audit-words.ts`, add `DEFENCE_VERBS` and
      `SCENE_START_VERBS` (plan R5). Leave `ACT_VERBS` unchanged.
- [ ] T015 [US2] In `apps/server/src/dm/prompts/narrate.ts`, render `Reflex:` lines in
      `factEntries`. Replace the party line with `agencyRule("narrate")`. Rewrite the miss line and
      add the scene-start line (plan D4). Bump to `dm.narrate-v8`.
- [ ] T016 [US2] In `apps/server/src/dm/prompts/audit.ts`, rewrite definition 1 with
      `agencyRule("audit")` (plan D4). Bump to `dm.audit-v5`.
- [ ] T017 [US2] [US3] In `apps/server/src/dm/nodes/audit.ts` `deterministicChecks`, add the miss-
      defence and scene-start-hero checks (plan D4). Mark the lexical window with a `ponytail:`
      comment (plan Risks).
- [ ] T018 [US2] In `apps/server/test/dm/facts.test.ts`, test `deriveInvoluntary`: a critical hit
      on a party member gives `stagger`; damage of exactly half max HP gives `heavy-hit`, one less
      gives none; a failed DEX save gives `flinch` "failed dex save"; the same rows on a monster give
      none; a failed death save gives none; a crit with heavy damage gives both; max HP 0 gives no
      heavy-hit.
- [ ] T019 [US2] [US3] Create `apps/server/test/dm/fixtures/player-agency-captures.json` with the
      prose of verify 20261026T192319Z seq 10, 82, 87 and 126 (copied from the evidence
      `transcript.jsonl`, prose paragraph only) and the minimal facts each needs.
- [ ] T020 [US2] [US3] Create `apps/server/test/dm/player-agency.test.ts`: seq 82 fails with one
      blocking `player-agency` issue naming Tamsin; seq 87 and seq 126 pass the agency checks
      (card AC #2, SC-001); seq 10 at scene start fails on "Tamsin Vale leads"; each
      `apps/server/seeds/*.json` `opening.framing` at scene start passes (card AC #1, SC-002); a
      member whose own declared action says "I duck behind the post" is exempt on that beat.
- [ ] T021 [US2] In `apps/server/test/dm/narrate.test.ts`, pin `dm.narrate-v8` and `dm.audit-v5`.
      Assert narrate and audit system prompts hold their `agencyRule` text, the narrate system holds
      the new miss line, a scene-start narrate user prompt holds the opening line, and facts with a
      `stagger` render a `Reflex:` line in both user prompts. Replace the assertion on "beyond their
      declared action" with the new definition text.
- [ ] T022 Amend `specs/034-narration-quality/contracts/audit-criteria.md` (the two checks,
      definition 1, `dm.audit-v5`) and `specs/034-narration-quality/contracts/narration-facts.md`
      (`involuntary`, `band`, the rule lines, `dm.narrate-v8`).
- [ ] T023 Run `pnpm ci:check`.

## Phase 3: Wiki (re-ground)

- [ ] T024 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
      freshness . docs/wiki` and list every stale note.
- [ ] T025 Review `docs/wiki/dm-narration-quality.md` (NEEDS-REVIEW): the agency rule, involuntary
      facts, the reserved band, the two deterministic checks, the prompt-version paragraph
      (`dm.narrate-v8`, `dm.audit-v5`, `dm.director-v5`, `dm.companion-v7`, `dm.react-v2`).
- [ ] T026 Review `docs/wiki/dm-runtime.md` (NEEDS-REVIEW): the doctrine section (`AGENCY_RULE`,
      revised pair), the Director goal-note rule, `dm.interpret-v6`.
- [ ] T027 Re-pin or review `output-claim-gate`, `dm-talk-triggers`, `dm-failure-and-gates`
      (`dm.interpret-v6`) and `playtest-harness` (the Party section, `playtest.audit-v2`). Re-pin a
      note with a computed re-pin only when its text still holds.
- [ ] T028 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for every note whose description
      changed. Add one sentence on TASK-0113 to the INDEX overview.
- [ ] T029 Run the freshness gate (prints `OK`), the spec-bridge gate (exits 0) and
      `pnpm ci:check`.

## Dependencies

- Phase 1 before Phase 2: Phase 2's narrate and audit prompts render `agencyRule` from Phase 1.
- Phase 3 last.
- Phase 1 changes narrate and audit prompt text (the revised pair) without bumping them; Phase 2
  bumps both. The PR lands both phases together.

## Parallel opportunities

- Within Phase 1, T005 and T010 (playtest auditor) touch no DM prompt file.
- Within Phase 2, T018 and T019 touch disjoint files.

## Card AC to task map

| Card AC | Tasks |
|---|---|
| #1 scene-start framing | T015, T017, T019, T020 |
| #2 miss rule measured, fixed, tested | plan R2 (measurement), T014, T015, T017, T019, T020 |
| #3 playtest auditor companion rule | T005, T010, T011 |
| #4 Director goal note | T001, T002, T007 |
| #5 interpret steps | T001, T003, T008 |
| Ruling, research (a)–(e), band reservation | T001, T013, T015, T016, T018, T021 |
