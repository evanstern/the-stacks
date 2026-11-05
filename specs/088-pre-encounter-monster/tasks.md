# Tasks: An encounter monster can be acted on before its encounter starts

**Input**: `specs/088-pre-encounter-monster/` (spec.md, plan.md)

**Prerequisites**: TASK-0244 and TASK-0242 are merged to `main`. TASK-0203 is merged, or its
`prompts/interpret.ts` and `prompts/director.ts` hunks are known. The operator rules OQ-1 to OQ-4;
the tasks below implement every OQ at (a). A different ruling changes the plan.md design section
named under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and
the branch commits. Each phase ends with `pnpm ci:check` green (DB suites skip without a database)
and one commit led by `TASK-0238:`. Edit only the hunks plan D1 to D7 name.

## Phase 1: Seam check (no source change)

- [ ] T001 Merge `origin/main` into the branch. Confirm TASK-0244 and TASK-0242 are merged
      (`git log origin/main --oneline --grep TASK-0244`, then `--grep TASK-0242`). Stop and report
      if either is missing.
- [ ] T002 Re-read the merged diffs of TASK-0244, TASK-0242 and TASK-0203 for
      `gates/plan-gate.ts`, `nodes/resolve.ts`, `facts.ts`, `prompts/narrate.ts`,
      `prompts/interpret.ts`, `prompts/director.ts` and `talk-turn.ts`. List each hunk that moves a
      seam plan D1 to D6 names: `checkPlan`'s `joining` input, `directorOpening`'s arrivals loop and
      encounter start, `factEntries`' refused line, `buildNarrationFacts`' `followUps`, the
      fallback's refused branch, the interpret and director prompt sections.
- [ ] T003 Read each prompt's current `PROMPT_VERSION` on `main` (director, interpret, narrate).
      Write the three target versions into plan.md D3, D5 and D6.
- [ ] T004 Confirm plan R2 from `docs/playtests/2026-11-03-runbook-b-playtest.md` findings 16 and
      19: the refused id at seq 73-92 is not `goblin-3`. If it is `goblin-3`, stop and report: the
      plan gate seam differs from R2. If the log does not name the id, record that in plan.md R2
      and go on: T013 tests both shapes.
- [ ] T005 Amend plan.md for every moved seam (file, function, hunk) and commit
      `TASK-0238: seam check`. With no moved seam, append a "Seam check 2026-11-xx: no change" line
      to plan.md and commit it.

## Phase 2: Monster arrivals, runnable encounters and the interpret section (card AC #1, #2)

- [ ] T006 In `apps/server/src/dm/gates/plan-gate.ts`, add `encounterRan`, `unseenMonsters` and
      `arrivingMonsters` (plan D1).
- [ ] T007 In `apps/server/src/dm/nodes/director.ts`, apply plan D2: the runnable rule, the
      monster arrival legality and its override, and the `unseenMonsters` prompt input.
- [ ] T008 In `apps/server/src/dm/talk-turn.ts`, make `legalEscalation` use `encounterRan`
      (plan D2).
- [ ] T009 In `apps/server/src/dm/prompts/director.ts`, apply plan D3 hunks 1-4.
- [ ] T010 In `apps/server/src/dm/nodes/resolve.ts`, apply plan D4: monster arrivals as keyed
      `combatant.add` opening moves, one fresh projections load after the arrivals group, and
      `joining` from `arrivingMonsters`.
- [ ] T011 In `apps/server/src/dm/prompts/interpret.ts`, apply plan D5: the version bump and the
      "Arriving this beat" section.
- [ ] T012 Append the monster arrivals amendment to `specs/031-dm-runtime/contracts/director.md`
      (plan D7).
- [ ] T013 Edit `apps/server/test/dm/director.test.ts`, `plan-gate.test.ts`,
      `interpret-prompt.test.ts` and `talk-turn.integration.test.ts` per plan D8. Cover both
      refused-id shapes: `goblin-lookout` refused `not-in-snapshot`, `goblin-3` passed via
      `joining`.
- [ ] T014 Run `pnpm ci:check`. Commit `TASK-0238: monster arrivals and the interpret section`.

## Phase 3: A refused action is not narrated as done (card AC #3)

- [ ] T015 In `apps/server/src/dm/facts.ts`, give a refused action `followUps: []` (plan D6).
- [ ] T016 In `apps/server/src/dm/prompts/narrate.ts`, apply plan D6: the version bump, the refused
      fact line, and the SYSTEM rule.
- [ ] T017 In `apps/server/src/dm/fallback.ts`, skip `changeSentences` for a refused action
      (plan D6).
- [ ] T018 Edit `apps/server/test/dm/facts.test.ts`, `narrate.test.ts` and `fallback.test.ts` per
      plan D8. One test builds facts for a refused action with follow-ups and asserts the rendered
      entries hold "it did not happen" and no "not yet attempted" line.
- [ ] T019 Run `pnpm ci:check`. Commit `TASK-0238: a refused action did not happen`.

## Phase 4: The run 1 replays (merge condition; card AC #1, #2, #3)

- [ ] T020 Bring up the worktree stack: `pnpm env:up`, migrate both databases by hand, restart the
      app. Read `TEST_DATABASE_URL` with `sed` from `.env`; never `source` it.
- [ ] T021 Write `apps/server/test/dm/scripts/parley-lookout.json` for plan D9's variants: the duo
      seed, the influence-opposed Persuasion reading on `goblin-3`, and the coin-toss reading.
- [ ] T022 Write `apps/server/test/dm/pre-encounter-monster.integration.test.ts` with plan D9
      variants 1-4: seq 52-58 (free-mode arrival), seq 73-92 unseen (same-beat encounter start),
      seq 73-92 arrived earlier, and the control. Each variant asserts zero `UNKNOWN_COMBATANT`
      verdicts except the control. Variants 1-3 assert the opposed `check.resolved` row.
- [ ] T023 Run the plan D10 mutation guards by hand. Record each failing test name in the commit
      body. Restore the code.
- [ ] T024 Run `REQUIRE_DATABASE=1` for the new test and `revealed-npc.integration.test.ts`,
      `opposition-and-help.integration.test.ts`, `attack-anyone.integration.test.ts` and
      `talk-turn.integration.test.ts`. Re-run a 5 s timeout once and report it (TASK-0154).
- [ ] T025 Run `pnpm ci:check`. Commit `TASK-0238: run 1 seq 52-58 and 73-92 replays`. Leave the
      stack up.

## Phase 5: Wiki re-ground

- [ ] T026 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
      freshness . docs/wiki` and list the stale notes.
- [ ] T027 Review and update `docs/wiki/seed-npc-presence.md` (monster arrivals beside NPC
      arrivals; the fresh load), `dm-failure-and-gates.md` (`joining` now holds monster arrivals;
      the run-encounter rule; the refused fact line) and `actor-snapshot.md` (rule 4 holds an
      arrived monster; `build.ts` unchanged). Re-pin each.
- [ ] T028 Review `docs/wiki/presence.md`. It lists no touched source, so change only a stale
      claim about encounter monsters, and say so in the commit body.
- [ ] T029 Re-pin every other stale note listing a touched source: `dm-runtime.md`,
      `dm-turn-jobs.md`, `party-panel.md`, `turn-floor.md`, `output-claim-gate.md`,
      `dm-narration-quality.md` (the narrate version, the refused rule) and `dm-talk-triggers.md`
      (`legalEscalation`). Verify each claim the diff touches before re-pinning.
- [ ] T030 Update `docs/wiki/CAPSULES.md` and `INDEX.md` for every changed note description.
- [ ] T031 Run the freshness gate (prints `OK`) and
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` (exits 0).
      Commit `TASK-0238: wiki re-ground`.

## Dependencies

- Phase 1 blocks every other phase.
- Phase 3 is independent of Phase 2 (disjoint files) and may run in either order.
- Phase 4 needs Phases 2 and 3 (variant 4 asserts the Phase 3 fact line).
- Phase 5 runs last.
