---
description: "Task list for the pure 5e engine package (TASK-0042)"
---

# Tasks: First Scene — pure 5e engine package

**Input**: `specs/026-dnd5e-engine/` — spec.md, plan.md, research.md, data-model.md,
contracts/ (engine-api, commands, events, refusals, boundary-rule).

**Tests**: required. AC #11 demands scripted-dice tests for every command and every refusal
code. Write each phase's tests with its code; the phase is not done until they pass.

**Dispatch unit**: each phase is one implementer dispatch of about 1–3 hours. Phases run in
order: every phase after Phase 2 builds on the schemas and helpers of Phase 2.

**Gate for every phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/dnd5e-engine test && pnpm check:boundaries`.

**Commit rule**: one or more commits per phase, message led by `TASK-0042:`. Tick each task
here (`- [x]`) in the same commit that completes it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 dice, US2 HP and life, US3 conditions, US4 initiative, US5 rests and slots.

## Refusal coverage map (AC #11)

Every code has a named test owner. The Phase 6 meta-test enforces the map.

| Code | Owning test file (phase) |
|---|---|
| `INVALID_STATE`, `INVALID_COMMAND` | `test/execute.test.ts` (P2) |
| `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE` | `test/commands/roll.test.ts` (P2) |
| `UNKNOWN_COMBATANT`, `DUPLICATE_COMBATANT`, `COMBATANT_IN_ENCOUNTER` | `test/commands/combatants.test.ts` (P3; `COMBATANT_IN_ENCOUNTER` added in P4) |
| `TARGET_DEAD`, `TEMP_HP_NOT_HIGHER` | `test/commands/hit-points.test.ts` (P3) |
| `NOT_DYING` | `test/commands/life.test.ts` (P3) |
| `CONDITION_ALREADY_PRESENT`, `CONDITION_NOT_PRESENT`, `EXHAUSTION_OUT_OF_RANGE` | `test/commands/conditions.test.ts` (P4) |
| `ENCOUNTER_ACTIVE`, `NO_ACTIVE_ENCOUNTER`, `ALREADY_IN_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT`, `DUPLICATE_PARTICIPANT` | `test/commands/encounter.test.ts` (P4) |
| `INSUFFICIENT_HIT_DICE`, `LONG_REST_REQUIRES_HP` | `test/commands/rests.test.ts` (P5) |
| `SLOT_LEVEL_UNAVAILABLE`, `NO_SLOT_AVAILABLE`, `SLOT_NOT_EXPENDED` | `test/commands/spell-slots.test.ts` (P5) |

---

## Phase 1: Setup — package scaffold and boundary rule (AC #10)

**Purpose**: the package exists, builds, tests run, and the boundary gate fails on a violation.

- [ ] T001 Create `packages/dnd5e-engine/package.json`: name `@the-stacks/dnd5e-engine`,
      `private`, `type: module`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`,
      scripts `build`/`typecheck` = `tsc -b`, `test` = `vitest run`; `dependencies`
      `{ "zod": "^4.6.5" }`; `devDependencies` `{ "vitest": "^5.0.1" }`.
- [ ] T002 Create `packages/dnd5e-engine/tsconfig.json` extending `../../tsconfig.base.json`
      with `rootDir: src`, `outDir: dist`, `lib: ["ES2022"]`, `types: []`, `include: ["src"]`.
- [ ] T003 Create `packages/dnd5e-engine/test/tsconfig.json` (`noEmit: true`,
      `include: ["."]`, `references: [{ "path": ".." }]`) and
      `packages/dnd5e-engine/vitest.config.ts` (include `test/**/*.test.ts`).
- [ ] T004 Add `packages/dnd5e-engine` and `packages/dnd5e-engine/test` to the root
      `tsconfig.json` references. Run `pnpm install` and commit the lockfile change.
- [ ] T005 Create `packages/dnd5e-engine/src/index.ts` exporting `ENGINE_SCHEMA_VERSION = 1`
      only, so the package builds.
- [ ] T006 Add the `biome.json` override for `packages/dnd5e-engine/src/**` and
      `fixtures/boundary-violations/packages/dnd5e-engine/**` exactly as
      contracts/boundary-rule.md section 1 lists (`noRestrictedImports` paths and patterns,
      `noRestrictedGlobals` `deniedGlobals`).
- [ ] T007 [P] Create the six fixtures in
      `fixtures/boundary-violations/packages/dnd5e-engine/src/` (`bad-database.ts`,
      `bad-orm.ts`, `bad-network.ts`, `bad-fetch.ts`, `bad-llm.ts`, `bad-clock.ts`) per
      contracts/boundary-rule.md section 2.
- [ ] T008 Update `scripts/check-boundaries.mjs` to pass
      `--only=style/noRestrictedImports --only=style/noRestrictedGlobals`, and update its
      header comment. Run `pnpm check:boundaries`; expect every fixture flagged.
- [ ] T009 Prove the gate fails: remove the engine override locally, run
      `pnpm check:boundaries`, confirm exit 1 naming the six engine fixtures, restore the
      override. Record the observed output in the phase commit message body.
- [ ] T010 [P] Write `packages/dnd5e-engine/test/purity.test.ts` per contracts/boundary-rule.md
      section 3: import-specifier allowlist (`zod` or relative), no `Math.random`, `Date`,
      `globalThis` or `new Function` in `src/**/*.ts`, and `dependencies` equals `{ zod }`.

**Checkpoint**: `pnpm ci:check` passes with an empty engine package.

---

## Phase 2: Foundational — schemas, RNG, dice and the entry point (US1, AC #1–#3, #9)

**Purpose**: the full contract as Zod, the RNG, the dice parser, `execute`/`evolve`/`replay`
and the `roll` command. Every later phase adds handlers only.

**Independent test**: `roll` works end to end with seeded and scripted RNGs.

- [ ] T011 [P] Write `src/schema/state.ts`: every state schema and refinement in
      contracts/engine-api.md, "State" and "State refinements".
- [ ] T012 [P] Write `src/schema/commands.ts`: all 19 commands of contracts/commands.md as one
      `z.discriminatedUnion("type", …)`, including the refinement that rejects `exhaustion`
      on `condition.apply`/`condition.remove`. Do not add uniqueness refinements for
      participant lists: duplicates are the `DUPLICATE_PARTICIPANT` refusal, not a parse
      failure.
- [ ] T013 [P] Write `src/schema/events.ts`: all 16 events of contracts/events.md.
- [ ] T014 [P] Write `src/schema/refusals.ts`: the 24 codes in contracts/refusals.md order,
      `RefusalSchema`, `EngineResultSchema`, and a `refuse(code, message, details?)` helper.
- [ ] T015 [P] Write `src/rng.ts`: `Rng`, `seededRng` (mulberry32 plus rejection sampling,
      research R2), `scriptedRng` with `remaining()`/`calls()`, `ScriptedDiceError`,
      `RngContractError`.
- [ ] T016 Write `src/dice.ts`: `parseDiceExpression` per the grammar and limits in
      contracts/engine-api.md, and an internal `rollParsed(terms, mode, rng)` that returns
      `DiceTermResult[]`, `total` and `natural`, validating every face.
- [ ] T017 Write `src/evolve.ts` (`emptyState`, `evolve` for all 16 events per data-model.md's
      event-to-slice map, `replay`) and `src/selectors.ts` (`conditionsOf`, `activeCombatant`).
- [ ] T018 Write `src/execute.ts`: parse state (`INVALID_STATE`), parse command
      (`INVALID_COMMAND`), dispatch to a handler map, return the result. Unknown handler for a
      parsed type is a thrown bug, not a refusal.
- [ ] T019 Write `src/commands/roll.ts` (purpose `check`) and register it.
- [ ] T020 Fill `src/index.ts` with the public surface in contracts/engine-api.md and nothing
      else.
- [ ] T021 Write `test/helpers.ts`: `makeCombatant(overrides)`, `stateWith(...combatants)`,
      `expectOk(result)`, `expectRefusal(result, code)` (asserts `ok: false`, the code, and no
      `events` key), `countingRng(inner)`, `deepFreeze`, `applyResult(state, result)`.
- [ ] T022 [P] [US1] Write `test/rng.test.ts`: same seed gives the same 1000 faces; different
      seeds differ; every face of d4/d6/d20/d100 in range over 10 000 draws; scripted RNG
      returns faces in order and throws on exhaustion and on an out-of-range face.
- [ ] T023 [P] [US1] Write `test/dice.test.ts`: parse `d20`, `1d20+5`, `4d6kh3`, `2d20kl1`,
      `1d20+5+1d4`, `1d20+5-1d4`, `-1d4+2`, whitespace and case; reject `3d`, `d`, `1d0`,
      `0d6`, `4d6kh0`, `1d20++2`; limits at and one past each bound.
- [ ] T024 [US1] Write `test/commands/roll.test.ts` with scripted dice: `4d6kh3` keeps
      6,5,3 of 6,2,5,3 (total 14); advantage keeps the higher of 4,17 with `natural` 17;
      disadvantage keeps the lower; bonus dice terms sum; negative total allowed;
      refusals `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE`
      (on `2d20`, `1d20kh1`, `1d6`, `1d20+1d20`), each with `countingRng` at 0 draws.
- [ ] T025 Write `test/execute.test.ts`: `INVALID_STATE` (HP above max; lifeState
      inconsistent with HP; encounter naming a missing combatant), `INVALID_COMMAND`
      (unknown type, missing reason, negative amount); precedence (bad state and bad command →
      `INVALID_STATE`); deep-frozen inputs do not throw; determinism with `seededRng(42)`
      twice.

**Checkpoint**: the contract compiles, `roll` passes, and the package exports its final
surface.

---

## Phase 3: User Story 2 — combatants, HP, temporary HP, life states, death saves (AC #4, #7)

**Independent test**: a combatant drops to 0 HP, fails death saves and dies, with every event
carrying before/after values.

- [ ] T026 [US2] Write `src/commands/combatants.ts`: `combatant.add` (defaults, initial life
      state from `current`), `combatant.remove` (`UNKNOWN_COMBATANT`; the
      `COMBATANT_IN_ENCOUNTER` check is wired now and tested in Phase 4).
- [ ] T027 [US2] Write the shared helpers in `src/commands/hit-points.ts`: `dropToZero`
      (dies rule, massive damage, unconscious + `hp-zero` condition) and `leaveZero`
      (conscious, tally reset, `hp-zero` condition removal with cause `healed`).
- [ ] T028 [US2] Implement `damage.apply`, `healing.apply`, `temp-hp.grant` in
      `src/commands/hit-points.ts` per contracts/commands.md "Hit points", including
      `amount.kind: "roll"` (parse before draw), `rollIndex`, `critical` at 0 HP, the stable →
      unconscious transition, and the rolled-temp-HP "keep the higher" success.
- [ ] T029 [US2] Write `src/commands/life.ts`: `death-save.roll` (natural 1, natural 20,
      10+, below 10, third success → stable, third failure → dead) and `stabilize`.
- [ ] T030 [P] [US2] Write `test/commands/combatants.test.ts`: add with defaults; add at 0 HP
      for each rule; remove; `DUPLICATE_COMBATANT`; `UNKNOWN_COMBATANT`.
- [ ] T031 [P] [US2] Write `test/commands/hit-points.test.ts` (scripted dice): temp HP absorb
      first (10/5 takes 8 → 7/0); damage to 0 → unconscious + condition; dies rule → dead;
      massive damage → dead; damage at 0 adds 1 failure, 2 on critical, third → dead; damage
      on stable → unconscious + failure; zero damage still logs; rolled amount below 0 → 0;
      healing caps at max; healing at 0 → conscious, tally reset, `hp-zero` removed, a
      spell-sourced `unconscious` kept; temp HP grant higher replaces; rolled lower keeps
      existing with before = after; refusals `TARGET_DEAD` (damage, healing, temp HP),
      `TEMP_HP_NOT_HIGHER`, `UNKNOWN_COMBATANT`, rolled-amount `INVALID_DICE_EXPRESSION` at 0
      draws. Every success asserts `replay(events, state)` equals the expected state.
- [ ] T032 [P] [US2] Write `test/commands/life.test.ts`: each death-save branch with a scripted
      face (1, 9, 10, 20) and with advantage; three successes → stable with tally 0/0; three
      failures → dead; `stabilize`; `NOT_DYING` for conscious, stable, dead and dies-rule
      targets.

**Checkpoint**: US1 and US2 both pass independently.

---

## Phase 4: User Stories 3 and 4 — conditions, initiative and turns (AC #5, #6)

**Independent test**: an encounter starts, a condition expiring at the end of a combatant's
turn falls off when the turn advances, and round 2 begins after the last combatant.

- [ ] T033 [US3] Write `src/commands/conditions.ts`: `condition.apply` (instance id
      `"<id>#<n>"`, `conditionSeq` before/after), `condition.remove` (all matching
      instances; dead targets allowed), `exhaustion.adjust` (apply/change/remove, level 6 →
      `dead`).
- [ ] T034 [US4] Write `src/commands/encounter.ts`: `initiative.roll` (one `dice.rolled` per
      participant, purpose `initiative`; ordering total → bonus → id), `initiative.join`
      (insert, keep the active combatant), `turn.advance` (skip dead, wrap rounds, cross
      expiry points including skipped turns, `skipped` list), `encounter.end` (remove
      round-expiry conditions with cause `encounter-ended`).
- [ ] T035 [P] [US3] Write `test/commands/conditions.test.ts`: apply with source and expiry;
      `conditionsOf` lists it; remove; second apply → `CONDITION_ALREADY_PRESENT`; remove
      absent → `CONDITION_NOT_PRESENT`; `exhaustion` via `condition.apply` →
      `INVALID_COMMAND`; exhaustion 0→1 applies, 1→3 changes, 3→0 removes, 5→6 kills,
      `EXHAUSTION_OUT_OF_RANGE` below 0 and above 6; `TARGET_DEAD` on apply; remove on a dead
      target succeeds.
- [ ] T036 [P] [US4] Write `test/commands/encounter.test.ts` (scripted d20s): ordering with
      ties (12/18/12 → bonus then id); advantage on one participant; `activeCombatant`;
      advance through a round wrap; dead combatant skipped and listed in `skipped`; `turn-end`
      and `turn-start` expiries fire at the right boundary, including on a skipped turn;
      join before and after the active index keeps the active combatant; end removes
      round-expiry conditions; refusals `ENCOUNTER_ACTIVE`, `NO_ACTIVE_ENCOUNTER` (join,
      advance, end), `ALREADY_IN_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT`, `DUPLICATE_PARTICIPANT`,
      `TARGET_DEAD` (dead participant), `UNKNOWN_COMBATANT`.
- [ ] T037 [US4] Extend `test/commands/combatants.test.ts` with `COMBATANT_IN_ENCOUNTER`.

**Checkpoint**: US1–US4 pass independently.

---

## Phase 5: User Story 5 — rests and spell slots (AC #8)

**Independent test**: expend slots, take a long rest, and see HP, hit dice and slots restored
with before/after values.

- [ ] T038 [US5] Write `src/commands/rests.ts`: `rest.short` (per-die `dice.rolled` purpose
      `hit-die`, `max(0, face + con)`, one `hp.changed` cause `rest`, `leaveZero` when HP
      leaves 0, pact slot restore, `rest.completed`) and `rest.long` (HP to max and temp to 0,
      tally reset, all hit dice, all slots, exhaustion −1 with cause `rest`,
      `rest.completed`), emitting only events whose values change.
- [ ] T039 [US5] Write `src/commands/spell-slots.ts`: `spell-slot.expend` and
      `spell-slot.restore` for `standard` and `pact` pools.
- [ ] T040 [P] [US5] Write `test/commands/rests.test.ts` (scripted dice): fighter Con +2
      spends 2d10 (faces 4, 7) → +15 capped at max; Con −3 with a face of 1 heals 0; multiple
      pools; empty `spend` restores pact slots only; stable creature at 0 HP heals out of 0;
      long rest restores everything and lowers exhaustion 2→1 and 1→0; refusals
      `ENCOUNTER_ACTIVE` (both rests), `INSUFFICIENT_HIT_DICE` (too many; absent size),
      `LONG_REST_REQUIRES_HP`, `TARGET_DEAD`, `DUPLICATE_PARTICIPANT`.
- [ ] T041 [P] [US5] Write `test/commands/spell-slots.test.ts`: expend standard and pact;
      restore one and several; refusals `SLOT_LEVEL_UNAVAILABLE` (no such level; pact level
      mismatch; no pact pool), `NO_SLOT_AVAILABLE`, `SLOT_NOT_EXPENDED`, `TARGET_DEAD`.

**Checkpoint**: all five stories pass independently.

---

## Phase 6: Polish — coverage meta-test, replay scene, docs, full gate (AC #9, #11)

- [ ] T042 Write `test/coverage.test.ts`: for every option of the command `type`
      discriminator, assert some `test/commands/*.test.ts` contains `type: "<type>"`; for every
      `RefusalCodeSchema` option, assert some test file contains an `expectRefusal(` call
      naming that code. The test prints the missing names on failure.
- [ ] T043 Write `test/replay.test.ts`: a scripted mini-scene (add three combatants, roll
      initiative, two damage rolls, a condition with a turn-end expiry, advances through a
      round, a death save, end the encounter, short rest, expend and restore a slot). Assert
      that replaying the concatenated events from `emptyState()` equals the state threaded
      through each step, and that `scriptedRng.remaining()` is 0.
- [ ] T044 [P] Add a refuse-before-draw sweep to `test/execute.test.ts`: for one refusal case
      per code that a dice-drawing command can return, assert `countingRng` saw 0 draws.
- [ ] T045 [P] Write `packages/dnd5e-engine/README.md` (one screen): the entry point, the
      invariants, the "no I/O" rule, links to `specs/026-dnd5e-engine/contracts/`.
- [ ] T046 Run the quickstart (specs/026-dnd5e-engine/quickstart.md) and fix any drift
      between it and the code.
- [ ] T047 Run `pnpm ci:check` from the worktree root; it must pass. Save its tail to
      `specs/026-dnd5e-engine/ci-evidence.txt`.

### Constitution compliance (folded into the phases above)

- Cross-plane boundary check updated for the new package (Principle III/VI): T006–T009.
- Event types versioned (Principle IV): T013 (`v: 1` on every event).
- Scripted-dice tests cover every engine command (Principle VI): T024, T030–T032, T035–T037,
  T040–T041, enforced by T042.
- Agent-facing interface exercised by a test (Principle I): every command test drives
  `execute` with a plain object command, the same path the gate uses.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6, one dispatch each.
- Phase 3, 4 and 5 touch disjoint `src/commands/*` and `test/commands/*` files, so an
  orchestrator MAY run them as parallel dispatches after Phase 2 merges into the branch; the
  only shared edits are the handler registration line in `src/execute.ts` and T037, which
  then moves to Phase 6. Sequential is the default.
- Inside a phase, `[P]` tasks touch different files.

## Notes

- No "for now" deferrals. Everything out of scope (research R8) belongs to adjudication
  (TASK-0046) by design, not to a later engine card.
- A contract change discovered during implementation is made in `contracts/` in the same
  commit as the code, and called out in the phase report.
