# Tasks: Scene-start intros

**Input**: `specs/076-scene-start-intros/` (spec.md, plan.md). Plan research R1 to R9 and design
D1 to D8 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. DB tests run with `REQUIRE_DATABASE=1` on the
worktree's own stack, exporting only `TEST_DATABASE_URL` from the worktree `.env`. No paid model
run: tests use the fake gateway.

**Overlap rule**: this task is spine #17. Before Phase 2, merge `origin/main` into the branch and
confirm TASK-0113, 0127 and 0170 have merged (plan "Overlap"). Keep TASK-0113's scene-start rule
and scripted wording where it landed (D4, D8). Do not edit `prompts/audit.ts`, `facts.ts`,
`talk-turn.ts`, `prompts/common.ts`, `dm/snapshot/` or `dm/scene-start.ts`. If a task seems to
need one, stop and report.

## Phase 1: The opening premise (card AC #1; US1)

**Goal**: every seed declares why the party is here, the loader requires it, and the player view
carries it.

**Independent test**: `seed.test.ts` passes with the new cases; every shipped seed loads.

- [ ] T001 [US1] In `apps/server/src/dm/seed/schema.ts`, apply plan D1: required
      `opening.premise` (`Text(500)`).
- [ ] T002 [US1] Add the plan D2 premise after `framing` in `apps/server/seeds/greyhollow-ford.json`,
      `greyhollow-ford-duo.json`, `greyhollow-ford-trio.json` and `greyhollow-ford-reed-camp.json`.
      Copy `greyhollow-ford.json` byte for byte to
      `specs/031-dm-runtime/data/greyhollow-ford.seed.json`.
- [ ] T003 [US1] In `apps/server/src/dm/seed/views.ts`, apply plan D3: `openingPremise`.
- [ ] T004 [P] [US1] Extend `apps/server/test/dm/seed.test.ts` as plan "Tests" says: the missing
      premise names `opening.premise`; every shipped seed has one; no premise holds a DM-only
      string.
- [ ] T005 Amend `specs/031-dm-runtime/contracts/scene-seed.md` and
      `specs/034-narration-quality/contracts/player-facing-context.md` as plan "Contracts" says.
      Commit as `TASK-0171 phase 1: opening premise`.

## Phase 2: The opening prompt (card AC #2, #5; US1, US2, US4)

**Goal**: the scene-start prompt carries the place, premise, goal, party with controllers and the
NPCs present at the first beat, from the player view only.

**Independent test**: `scene-start-intros.test.ts` prompt and leak cases and the `narrate.test.ts`
cases pass; every non-scene-start narrate test passes unchanged.

- [ ] T006 [US1] [US2] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D4: export
      `openingSection`, use it in `buildNarratePrompt` in place of the `scene` array, bump
      `PROMPT_VERSION`.
- [ ] T007 [US2] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D5: the scene-start
      `beatNpcIds`.
- [ ] T008 [P] [US1] [US2] [US4] Create `apps/server/test/dm/scene-start-intros.test.ts` with the
      plan "Tests" `openingSection`, non-scene-start, leak and `@ts-expect-error` cases.
- [ ] T009 [P] [US2] Extend `apps/server/test/dm/narrate.test.ts`: the version pin and the
      scene-start present-NPC cases of plan "Tests".
- [ ] T010 Run the unit suite and `player-facing-prompts.test.ts`, `duo-views.test.ts`,
      `trio-views.test.ts`. Commit as `TASK-0171 phase 2: opening prompt`.

## Phase 3: The name check, the fallback and the scripts (card AC #3, #4; US2, US3)

**Goal**: an opening that leaves someone out is blocked and regenerated; the fallback names
everyone; every scripted opening passes.

**Independent test**: the captured-replay cases and `scene-start-intros.integration.test.ts`
pass; every scripted scene and playtest integration test stays green.

- [ ] T011 [US3] In `apps/server/src/dm/nodes/audit.ts`, apply plan D6: `beforeClosingQuestion`,
      `namesCharacter`, and the scene-start block in `deterministicChecks`.
- [ ] T012 [US3] In `apps/server/src/dm/fallback.ts`, apply plan D7: the scene-start party and
      present-NPC sentences.
- [ ] T013 [US2] Apply plan D8 to the eight scripted openings:
      `apps/server/test/dm/scripts/scene-start.json`,
      `apps/server/test/dm/scripts/greyhollow-ford-full.json`,
      `apps/server/test/playtest/fixtures/downed-seat.json`,
      `apps/server/dm-scripts/greyhollow-live.json`, `greyhollow-human-dm.json`,
      `greyhollow-plan-approach.json`, `greyhollow-talk.json`, `runbook-a-reed-camp.json`.
- [ ] T014 [US2] Create `apps/server/test/dm/scripts/scene-start-intro-regenerate.json` per plan
      D8.
- [ ] T015 [P] [US3] Add to `apps/server/test/dm/scene-start-intros.test.ts` the helper cases and
      the captured replay of plan "Tests" (R6 texts as constants with their source paths).
- [ ] T016 [P] [US3] Extend `apps/server/test/dm/fallback.test.ts` with the scene-start names
      case; the property test stays green.
- [ ] T017 [US2] Create `apps/server/test/dm/scene-start-intros.integration.test.ts` per plan
      "Tests" and run it with `REQUIRE_DATABASE=1`.
- [ ] T018 Run the full server suite with `REQUIRE_DATABASE=1`, including
      `dm-scripts.test.ts`, `scene.integration.test.ts`, `script-env.integration.test.ts` and
      `test/playtest/harness.integration.test.ts`. Amend
      `specs/034-narration-quality/contracts/audit-criteria.md` and
      `specs/034-narration-quality/contracts/fallback-summary.md` as plan "Contracts" says.
      Commit as `TASK-0171 phase 3: name check, fallback, scripts`.

## Phase 4: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T019 Update `docs/wiki/seed-npc-presence.md` (NEEDS-REVIEW): `opening.premise` in the seed
      declaration; the scene-start NPC list in "NPC lists from presence" (first beat's declaration
      and S1, not the Director's beat). Add `greyhollow-ford-reed-camp.json` to its sources if it
      states the premise.
- [ ] T020 Update `docs/wiki/dm-narration-quality.md` (NEEDS-REVIEW): `openingPremise` in the
      player view; the opening section; the scene-start name check under "Audit"; the scene-start
      fallback sentences; the new narrate prompt version.
- [ ] T021 Re-verify and re-pin every other note citing a changed file: `dm-runtime.md` (seed
      schema, seeds, `nodes/narrate.ts`, `greyhollow-live.json`), `dm-failure-and-gates.md` (seed
      schema), `debug-view.md` (`seed/views.ts`), `playtest-harness.md` (reed-camp seed and script),
      `ai-gateway.md` (`greyhollow-live.json`), `dm-talk-triggers.md` (`greyhollow-talk.json`),
      `output-claim-gate.md` if the gate names it, and any note the freshness gate reports.
- [ ] T022 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: one sentence for scene-start
      intros (TASK-0171, specs/076).
- [ ] T023 Run the freshness gate and the spec-bridge gate
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .`). Commit
      as `TASK-0171 phase 4: wiki re-ground`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4. Phase 1 waits on TASK-0127 (shared `seed/schema.ts`).
Phases 2 and 3 wait on TASK-0113, 0127 and 0170 (shared `prompts/narrate.ts`, `nodes/audit.ts`,
`fallback.ts`). Phase 3 must land the D8 script edits in the same commit as the D6 check, or the
scripted scenes drain their fake provider.
