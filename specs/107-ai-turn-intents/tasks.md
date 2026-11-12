# Tasks: AI companion and monster turns emit Intents

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total**: 36 tasks in 5 phases. One phase is one sonnet dispatch. Each phase's commit leaves
`pnpm ci:check` green (plan.md "Phase coupling").

Before Phase 1, run `pnpm install --frozen-lockfile`, `pnpm env:up`, and migrate both databases
by hand. Export only `TEST_DATABASE_URL` as `VAR="$(sed …)"`.

## Phase 1: Monster turns emit Intents in code (AC #2, AC #3 monster half)

- [x] T001 Add optional `tactics: z.enum(["nearest","weakest"]).default("nearest")` to the encounter monster entry in `apps/server/src/dm/seed/schema.ts`.
- [x] T002 Create `apps/server/src/dm/monster-policy.ts` with `monsterStages(p, seed, combatantId)` per plan.md D3.
- [x] T003 Write `apps/server/test/dm/monster-policy.test.ts`: one case per D3 step (no combatant, no attacks, no foes, engaged melee, ranged, move then attack, `weakest`, tie by initiative, no placements).
- [x] T004 In `apps/server/src/dm/nodes/interpret.ts`, build the monster reading from `monsterStages` with `say: null`, and drop `null` from the model's expected reading ids.
- [x] T005 In `apps/server/src/dm/prompts/interpret.ts`, remove the monster-turn instruction lines and the `Monster turn:` user line; bump `PROMPT_VERSION` to `dm.interpret-v18`.
- [x] T006 In `apps/server/src/dm/pipeline/runner.ts`, add `NPC_DIRECTOR` and choose it for an `npc-turn` job with an empty beat and a monster turn (plan.md D4).
- [x] T007 Update `interpret-intents.test.ts`, `interpret-prompt.test.ts`, `npc-turn-narration.test.ts` and `runner.test.ts` for the code monster reading and the code Director.
- [x] T008 Rescript every DM script and fixture that scripts a monster turn: remove its `dm.director` and `dm.interpret` calls (`test/dm/scripts/*.json`, `test/playtest/fixtures/downed-seat.json`).
- [x] T009 Write `apps/server/test/dm/npc-turn-intents.integration.test.ts`: spec US-2 scenarios 1, 2, 5 and 6 with a strict fake gateway.
- [x] T010 Run `pnpm ci:check` with `REQUIRE_DATABASE=1`; fix until green; commit `TASK-0299: Phase 1 monster turns emit Intents in code (T001-T010)`.

## Phase 2: Companion turns emit Intents (AC #1, card note)

- [x] T011 Export `COMPANION_TURN_KINDS` and `CompanionIntentBodySchema` from `apps/server/src/dm/nodes/schemas.ts` (plan.md D1).
- [x] T012 In `apps/server/src/dm/nodes/interpret.ts`, make `isSlash` and `parseSlashItem` multi-line (plan.md D2).
- [x] T013 In `apps/server/src/dm/nodes/interpret.ts`, build the zero-stage hold reading for an AI companion item whose text is `HOLD_ACT_TEXT` (plan.md D2).
- [x] T014 Add `turn` to `CompanionOutput` in `apps/server/src/dm/companion.ts`.
- [x] T015 In `runCompanionJob`, on the active turn with no open action: stamp, validate, check the round trip, declare the slash lines and commit; else take the hold act and log `dm.companion.turn-invalid` (plan.md D5).
- [x] T016 In `apps/server/src/dm/prompts/companion.ts`, describe the `turn` field and its kinds; ask for `turn` on the companion's own turn; bump `PROMPT_VERSION` to `dm.companion-v9`.
- [x] T017 In `apps/server/src/dm/prompts/companion.ts`, render each comment actor with `dmActorLabel` and `seatsOf` (spec 096 OQ1).
- [x] T018 Update `interpret-intents.test.ts` for multi-line slash items (all ok, one refused line, over 6 lines) and the hold reading.
- [x] T019 Update `companion.integration.test.ts`, `companion-own-turn.integration.test.ts`, `companion-react.integration.test.ts` and `companion-addressee.test.ts` for the `turn` field and the comment label.
- [x] T020 Rescript every DM script and fixture that scripts a companion's own turn: add `turn` to the `dm.companion` reply and remove that turn job's `dm.interpret` call.
- [x] T021 Write `apps/server/test/dm/companion-turn-intents.integration.test.ts`: spec US-1 scenarios 1–4 with a strict fake gateway.
- [x] T022 Run `pnpm ci:check` with `REQUIRE_DATABASE=1`; fix until green; commit `TASK-0299: Phase 2 companion turns emit Intents (T011-T022)`.

## Phase 3: AI-actor parity tests (AC #3)

- [x] T023 Create `apps/server/test/dm/ai-actor-parity.integration.test.ts` with a world at a companion's turn and a monster's turn.
- [x] T024 Companion source: `attack` settled, `attack` refused `OUT_OF_REACH`, `attempt` `needs_ruling` answered by the AI seat (spec US-3 #1–#3).
- [x] T025 Monster source: `attack` settled, `attack` refused out of reach, `move` then `attack` settled (spec US-3 #4).
- [x] T026 A hand-submitted companion Intent with another character's actor is refused `NOT_YOUR_ACTOR` (spec US-3 #5).
- [x] T027 Schema and round-trip test: for each `COMPANION_TURN_KINDS` kind and the monster kinds, a stamped Intent parses with `IntentSchema` and `parse(toText(i))` deep-equals `i` (spec US-3 #6).
- [x] T028 Run `pnpm ci:check` with `REQUIRE_DATABASE=1`; commit `TASK-0299: Phase 3 AI-actor gate and planner parity tests (T023-T028)`.

## Phase 4: 4v4 round under 60 s (AC #4)

- [ ] T029 Create the fixture seed `apps/server/test/dm/fixtures/greyhollow-ford-4v4.json` (plan.md D6).
- [ ] T030 Create `apps/server/test/dm/scripts/ai-round-4v4.json` with the scripted calls and dice (plan.md D6).
- [ ] T031 Create `apps/server/test/ai-round.bench-test.ts`: setup, the timed round, the call-count and time assertions, and the printed per-job times.
- [ ] T032 Run `pnpm check:timing` and `node scripts/check-no-wallclock-tests.mjs`; then `pnpm ci:check` with `REQUIRE_DATABASE=1`; commit `TASK-0299: Phase 4 4v4 round bench under 60 s (T029-T032)`.

## Phase 5: Wiki re-ground

Run the wiki-update plan loop. Classify each note RE-PIN-ONLY or NEEDS-REVIEW from
`git diff <old-pin>..HEAD -- <sources>`. Amend prose before bumping a pin.

- [ ] T033 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: monster policy, code Director on monster turns, companion `turn`, multi-line slash items, `dm.interpret-v18`, `dm.companion-v9`.
- [ ] T034 NEEDS-REVIEW `docs/wiki/dm-turn-jobs.md`, `docs/wiki/turn-floor.md` and `docs/wiki/seed-npc-presence.md` (the `tactics` field); re-pin any other note whose sources list a touched file.
- [ ] T035 NEEDS-REVIEW `docs/wiki/test-suite.md`: the 4v4 bench test in `check:timing`.
- [ ] T036 Update `docs/wiki/INDEX.md` state line and `docs/wiki/CAPSULES.md`; run the freshness gate (prints `OK`) and the spec-bridge check (exit 0); commit `TASK-0299: Phase 5 wiki re-ground (T033-T036)`.
