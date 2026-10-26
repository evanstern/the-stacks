---
description: "Task list for the pure 5e engine package (TASK-0042)"
---

# Tasks: First Scene — pure 5e engine package

**Input**: `specs/026-dnd5e-engine/` — spec.md, plan.md, research.md, data-model.md,
contracts/ (engine-api, commands, events, refusals, boundary-rule).

**Amended 2026-10-25** (orchestrator ruling, research R8): Phase 4 (attacks, checks, saves)
was added, damage gained components and defenses, and the dice layer gained critical
doubling. Later phases moved down by one; task ids were renumbered.

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
- **[Story]**: US1 dice, US2 HP and life, US3 conditions, US4 initiative, US5 rests and slots,
  US6 attacks, checks and saves.

## Refusal coverage map (AC #11)

Every code has a named test owner. The Phase 6 meta-test enforces the map.

| Code | Owning test file (phase) |
|---|---|
| `INVALID_STATE`, `INVALID_COMMAND` | `test/execute.test.ts` (P2) |
| `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE` | `test/commands/roll.test.ts` (P2) |
| `D20_TERM_REQUIRED`, `TARGET_AC_UNKNOWN` | `test/commands/attacks.test.ts` (P4) |
| `UNKNOWN_COMBATANT`, `DUPLICATE_COMBATANT`, `COMBATANT_IN_ENCOUNTER` | `test/commands/combatants.test.ts` (P3; `COMBATANT_IN_ENCOUNTER` added in P5) |
| `TARGET_DEAD`, `TEMP_HP_NOT_HIGHER` | `test/commands/hit-points.test.ts` (P3) |
| `NOT_DYING` | `test/commands/life.test.ts` (P3) |
| `CONDITION_ALREADY_PRESENT`, `CONDITION_NOT_PRESENT`, `EXHAUSTION_OUT_OF_RANGE` | `test/commands/conditions.test.ts` (P5) |
| `ENCOUNTER_ACTIVE`, `NO_ACTIVE_ENCOUNTER`, `ALREADY_IN_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT`, `DUPLICATE_PARTICIPANT` | `test/commands/encounter.test.ts` (P5) |
| `INSUFFICIENT_HIT_DICE`, `LONG_REST_REQUIRES_HP` | `test/commands/rests.test.ts` (P6) |
| `SLOT_LEVEL_UNAVAILABLE`, `NO_SLOT_AVAILABLE`, `SLOT_NOT_EXPENDED` | `test/commands/spell-slots.test.ts` (P6) |

---

## Phase 1: Setup — package scaffold and boundary rule (AC #10)

**Purpose**: the package exists, builds, tests run, and the boundary gate fails on a violation.

- [x] T001 Create `packages/dnd5e-engine/package.json`: name `@the-stacks/dnd5e-engine`,
      `private`, `type: module`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`,
      scripts `build`/`typecheck` = `tsc -b`, `test` = `vitest run`; `dependencies`
      `{ "zod": "^4.6.5" }`; `devDependencies` `{ "vitest": "^5.0.1" }`.
- [x] T002 Create `packages/dnd5e-engine/tsconfig.json` extending `../../tsconfig.base.json`
      with `rootDir: src`, `outDir: dist`, `lib: ["ES2022"]`, `types: []`, `include: ["src"]`.
- [x] T003 Create `packages/dnd5e-engine/test/tsconfig.json` (`noEmit: true`,
      `include: ["."]`, `references: [{ "path": ".." }]`) and
      `packages/dnd5e-engine/vitest.config.ts` (include `test/**/*.test.ts`).
- [x] T004 Add `packages/dnd5e-engine` and `packages/dnd5e-engine/test` to the root
      `tsconfig.json` references. Run `pnpm install` and commit the lockfile change.
- [x] T005 Create `packages/dnd5e-engine/src/index.ts` exporting `ENGINE_SCHEMA_VERSION = 1`
      only, so the package builds.
- [x] T006 Add the `biome.json` override for `packages/dnd5e-engine/src/**` and
      `fixtures/boundary-violations/packages/dnd5e-engine/**` exactly as
      contracts/boundary-rule.md section 1 lists (`noRestrictedImports` paths and patterns,
      `noRestrictedGlobals` `deniedGlobals`).
- [x] T007 [P] Create the six fixtures in
      `fixtures/boundary-violations/packages/dnd5e-engine/src/` (`bad-database.ts`,
      `bad-orm.ts`, `bad-network.ts`, `bad-fetch.ts`, `bad-llm.ts`, `bad-clock.ts`) per
      contracts/boundary-rule.md section 2.
- [x] T008 Update `scripts/check-boundaries.mjs` to pass
      `--only=style/noRestrictedImports --only=style/noRestrictedGlobals`, and update its
      header comment. Run `pnpm check:boundaries`; expect every fixture flagged.
- [x] T009 Prove the gate fails: remove the engine override locally, run
      `pnpm check:boundaries`, confirm exit 1 naming the six engine fixtures, restore the
      override. Record the observed output in the phase commit message body.
- [x] T010 [P] Write `packages/dnd5e-engine/test/purity.test.ts` per contracts/boundary-rule.md
      section 3: import-specifier allowlist (`zod` or relative), no `Math.random`, `Date`,
      `globalThis` or `new Function` in `src/**/*.ts`, and `dependencies` equals `{ zod }`.

**Checkpoint**: `pnpm ci:check` passes with an empty engine package.

---

## Phase 2: Foundational — schemas, RNG, dice and the entry point (US1, AC #1–#3, #9)

**Purpose**: the full contract as Zod, the RNG, the dice parser, `execute`/`evolve`/`replay`
and the `roll` command. Every later phase adds handlers only.

**Independent test**: `roll` works end to end with seeded and scripted RNGs.

- [x] T011 [P] Write `src/schema/state.ts`: every state schema and refinement in
      contracts/engine-api.md, "State" and "State refinements".
- [x] T012 [P] Write `src/schema/commands.ts`: all 21 commands of contracts/commands.md as one
      `z.discriminatedUnion("type", …)`, including the refinement that rejects `exhaustion`
      on `condition.apply`/`condition.remove`. Do not add uniqueness refinements for
      participant lists: duplicates are the `DUPLICATE_PARTICIPANT` refusal, not a parse
      failure.
- [x] T013 [P] Write `src/schema/events.ts`: all 18 events of contracts/events.md.
- [x] T014 [P] Write `src/schema/refusals.ts`: the 26 codes in contracts/refusals.md order,
      `RefusalSchema`, `EngineResultSchema`, and a `refuse(code, message, details?)` helper.
- [x] T015 [P] Write `src/rng.ts`: `Rng`, `seededRng` (mulberry32 plus rejection sampling,
      research R2), `scriptedRng` with `remaining()`/`calls()`, `ScriptedDiceError`,
      `RngContractError`.
- [x] T016 Write `src/dice.ts`: `parseDiceExpression` per the grammar and limits in
      contracts/engine-api.md, and an internal `rollParsed(terms, { mode, critical }, rng)`
      that returns `DiceTermResult[]`, `total` and `natural`, validating every face. With
      `critical: true` it doubles every dice term's count and keep `n`, checks the limits on
      the doubled terms before any draw, and leaves modifiers alone. Export a
      `hasPlainD20(terms)` helper for `roll`, `attack.roll` and `check.roll`.
- [x] T017 Write `src/evolve.ts` (`emptyState`, `evolve` for all 18 events per data-model.md's
      event-to-slice map, `replay`) and `src/selectors.ts` (`conditionsOf`, `activeCombatant`).
- [x] T018 Write `src/execute.ts`: parse state (`INVALID_STATE`), parse command
      (`INVALID_COMMAND`), dispatch to a handler map, return the result. Unknown handler for a
      parsed type is a thrown bug, not a refusal.
- [x] T019 Write `src/commands/roll.ts` (purpose `roll`) and register it.
- [x] T020 Fill `src/index.ts` with the public surface in contracts/engine-api.md and nothing
      else.
- [x] T021 Write `test/helpers.ts`: `makeCombatant(overrides)`, `stateWith(...combatants)`,
      `expectOk(result)`, `expectRefusal(result, code)` (asserts `ok: false`, the code, and no
      `events` key), `countingRng(inner)`, `deepFreeze`, `applyResult(state, result)`.
- [x] T022 [P] [US1] Write `test/rng.test.ts`: same seed gives the same 1000 faces; different
      seeds differ; every face of d4/d6/d20/d100 in range over 10 000 draws; scripted RNG
      returns faces in order and throws on exhaustion and on an out-of-range face.
- [x] T023 [P] [US1] Write `test/dice.test.ts`: parse `d20`, `1d20+5`, `4d6kh3`, `2d20kl1`,
      `1d20+5+1d4`, `1d20+5-1d4`, `-1d4+2`, whitespace and case; reject `3d`, `d`, `1d0`,
      `0d6`, `4d6kh0`, `1d20++2`; limits at and one past each bound; critical doubling of
      `2d6+3` draws four d6 and adds 3 once; a critical `60d6` exceeds the limit with 0 draws.
- [x] T024 [US1] Write `test/commands/roll.test.ts` with scripted dice: `4d6kh3` keeps
      6,5,3 of 6,2,5,3 (total 14); advantage keeps the higher of 4,17 with `natural` 17;
      disadvantage keeps the lower; bonus dice terms sum; negative total allowed;
      refusals `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE`
      (on `2d20`, `1d20kh1`, `1d6`, `1d20+1d20`), each with `countingRng` at 0 draws.
- [x] T025 Write `test/execute.test.ts`: `INVALID_STATE` (HP above max; lifeState
      inconsistent with HP; encounter naming a missing combatant), `INVALID_COMMAND`
      (unknown type, missing reason, negative amount); precedence (bad state and bad command →
      `INVALID_STATE`); deep-frozen inputs do not throw; determinism with `seededRng(42)`
      twice.

**Checkpoint**: the contract compiles, `roll` passes, and the package exports its final
surface.

---

## Phase 3: User Story 2 — combatants, HP and damage defenses, temporary HP, life states, death saves (AC #4, #7)

**Independent test**: a combatant drops to 0 HP, fails death saves and dies, with every event
carrying before/after values.

- [x] T026 [US2] Write `src/commands/combatants.ts`: `combatant.add` (defaults, initial life
      state from `current`), `combatant.remove` (`UNKNOWN_COMBATANT`; the
      `COMBATANT_IN_ENCOUNTER` check is wired now and tested in Phase 4).
- [x] T027 [US2] Write the shared helpers in `src/commands/hit-points.ts`: `dropToZero`
      (dies rule, massive damage, unconscious + `hp-zero` condition) and `leaveZero`
      (conscious, tally reset, `hp-zero` condition removal with cause `healed`).
- [x] T028 [US2] Implement `damage.apply`, `healing.apply`, `temp-hp.grant` in
      `src/commands/hit-points.ts` per contracts/commands.md "Hit points", including damage
      components (1..10) with damage types, critical dice doubling through `rollParsed`, the
      defense set (command's replaces record's; immune → 0, resisted → floor half, then
      vulnerable → double), `hp.changed.components`/`rawAmount`/`defensesSource`,
      `amount.kind: "roll"` (parse every component before any draw), `critical` at 0 HP, the
      stable → unconscious transition, and the rolled-temp-HP "keep the higher" success.
- [x] T029 [US2] Write `src/commands/life.ts`: `death-save.roll` (natural 1, natural 20,
      10+, below 10, third success → stable, third failure → dead) and `stabilize`.
- [x] T030 [P] [US2] Write `test/commands/combatants.test.ts`: add with defaults; add at 0 HP
      for each rule; `ac` and `defenses` defaults; remove; `DUPLICATE_COMBATANT`;
      `UNKNOWN_COMBATANT`.
- [x] T031 [P] [US2] Write `test/commands/hit-points.test.ts` (scripted dice): temp HP absorb
      first (10/5 takes 8 → 7/0); two components (slashing + fire) each logged with raw and
      applied; resistance 9 → 4; vulnerability 5 → 10; immunity → 0 with no death-save
      failure at 0 HP; resisted-and-vulnerable 7 → 6; command defense set replaces the
      record's (record resists fire, command set empty → full damage) with `defensesSource`;
      critical `2d6+3` draws four d6; massive damage uses the applied amount; damage to 0 → unconscious + condition; dies rule → dead;
      massive damage → dead; damage at 0 adds 1 failure, 2 on critical, third → dead; damage
      on stable → unconscious + failure; zero damage still logs; rolled amount below 0 → 0;
      healing caps at max; healing at 0 → conscious, tally reset, `hp-zero` removed, a
      spell-sourced `unconscious` kept; temp HP grant higher replaces; rolled lower keeps
      existing with before = after; refusals `TARGET_DEAD` (damage, healing, temp HP),
      `TEMP_HP_NOT_HIGHER`, `UNKNOWN_COMBATANT`, rolled-amount `INVALID_DICE_EXPRESSION` at 0
      draws. Every success asserts `replay(events, state)` equals the expected state.
- [x] T032 [P] [US2] Write `test/commands/life.test.ts`: each death-save branch with a scripted
      face (1, 9, 10, 20) and with advantage; three successes → stable with tally 0/0; three
      failures → dead; `stabilize`; `NOT_DYING` for conscious, stable, dead and dies-rule
      targets.

**Checkpoint**: US1 and US2 both pass independently.

---

## Phase 4: User Story 6 — attacks, checks and saves (AC #2, #9, #11; research R8)

**Independent test**: an attack with scripted d20 faces 20, 1 and 15 against AC 15 gives
`critical-hit`, `miss` and `hit`; a DC 13 save with `1d20+2` and a face of 11 succeeds.

- [ ] T033 [US6] Write `src/commands/attacks.ts`: `attack.roll` (purpose `attack`; plain d20
      required; AC from `targetAc`, else record, else `TARGET_AC_UNKNOWN`; natural 20 →
      `critical-hit`, natural 1 → `miss`, else `total >= ac`; `attack.resolved` with
      `acSource` and `rollIndex`) and `check.roll` (purpose `check` or `save`; `total >= dc`;
      naturals recorded but not used; `check.resolved`; `autoFail` → no draw, outcome
      `failure`, per contracts/commands.md "Automatic failure"). Register both.
- [ ] T034 [P] [US6] Write `test/commands/attacks.test.ts` (scripted dice): natural 20 against
      AC 30 → `critical-hit`; natural 1 with `+10` against AC 5 → `miss`; total equal to AC →
      `hit`; one below → `miss`; advantage keeps the higher d20 and `natural` is the kept
      face; bonus die `1d20+5+1d4` counts toward the total; `targetAc` overrides the record
      and `acSource` says so; `attackerId` null allowed; save success at exactly the DC;
      failure one below; natural 20 on a save below the DC still fails; ability check with a
      skill; `autoFail` on a save: a `countingRng` sees 0 draws, the only event is
      `check.resolved` with outcome `failure`, the DC, `autoFail.reason` and null
      `total`/`natural`/`rollIndex`; refusals `D20_TERM_REQUIRED` (`2d20`, `1d20kh1`, `1d6+3`, `1d20+1d20`),
      `TARGET_AC_UNKNOWN`, `UNKNOWN_COMBATANT` (target, attacker, checking combatant),
      `TARGET_DEAD` (target, attacker), `INVALID_DICE_EXPRESSION`, each at 0 draws.
- [ ] T035 [US6] Add an attack-to-damage flow test to `test/commands/attacks.test.ts`: a
      `critical-hit` outcome followed by `damage.apply` with `critical: true` against a
      resistant target; assert the doubled dice, the halving, and that `replay` of both
      results gives the expected HP.

**Checkpoint**: US1, US2 and US6 pass independently.

---

## Phase 5: User Stories 3 and 4 — conditions, initiative and turns (AC #5, #6)

**Independent test**: an encounter starts, a condition expiring at the end of a combatant's
turn falls off when the turn advances, and round 2 begins after the last combatant.

- [ ] T036 [US3] Write `src/commands/conditions.ts`: `condition.apply` (instance id
      `"<id>#<n>"`, `conditionSeq` before/after), `condition.remove` (all matching
      instances; dead targets allowed), `exhaustion.adjust` (apply/change/remove, level 6 →
      `dead`).
- [ ] T037 [US4] Write `src/commands/encounter.ts`: `initiative.roll` (one `dice.rolled` per
      participant, purpose `initiative`; ordering total → bonus → id), `initiative.join`
      (insert, keep the active combatant), `turn.advance` (skip dead, wrap rounds, cross
      expiry points including skipped turns, `skipped` list), `encounter.end` (remove
      round-expiry conditions with cause `encounter-ended`).
- [ ] T038 [P] [US3] Write `test/commands/conditions.test.ts`: apply with source and expiry;
      `conditionsOf` lists it; remove; second apply → `CONDITION_ALREADY_PRESENT`; remove
      absent → `CONDITION_NOT_PRESENT`; `exhaustion` via `condition.apply` →
      `INVALID_COMMAND`; exhaustion 0→1 applies, 1→3 changes, 3→0 removes, 5→6 kills,
      `EXHAUSTION_OUT_OF_RANGE` below 0 and above 6; `TARGET_DEAD` on apply; remove on a dead
      target succeeds.
- [ ] T039 [P] [US4] Write `test/commands/encounter.test.ts` (scripted d20s): ordering with
      ties (12/18/12 → bonus then id); advantage on one participant; `activeCombatant`;
      advance through a round wrap; dead combatant skipped and listed in `skipped`; `turn-end`
      and `turn-start` expiries fire at the right boundary, including on a skipped turn;
      join before and after the active index keeps the active combatant; end removes
      round-expiry conditions; refusals `ENCOUNTER_ACTIVE`, `NO_ACTIVE_ENCOUNTER` (join,
      advance, end), `ALREADY_IN_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT`, `DUPLICATE_PARTICIPANT`,
      `TARGET_DEAD` (dead participant), `UNKNOWN_COMBATANT`.
- [ ] T040 [US4] Extend `test/commands/combatants.test.ts` with `COMBATANT_IN_ENCOUNTER`.

**Checkpoint**: US1–US4 and US6 pass independently.

---

## Phase 6: User Story 5 — rests and spell slots (AC #8)

**Independent test**: expend slots, take a long rest, and see HP, hit dice and slots restored
with before/after values.

- [ ] T041 [US5] Write `src/commands/rests.ts`: `rest.short` (per-die `dice.rolled` purpose
      `hit-die`, `max(0, face + con)`, one `hp.changed` cause `rest`, `leaveZero` when HP
      leaves 0, pact slot restore, `rest.completed`) and `rest.long` (HP to max and temp to 0,
      tally reset, all hit dice, all slots, exhaustion −1 with cause `rest`,
      `rest.completed`), emitting only events whose values change.
- [ ] T042 [US5] Write `src/commands/spell-slots.ts`: `spell-slot.expend` and
      `spell-slot.restore` for `standard` and `pact` pools.
- [ ] T043 [P] [US5] Write `test/commands/rests.test.ts` (scripted dice): fighter Con +2
      spends 2d10 (faces 4, 7) → +15 capped at max; Con −3 with a face of 1 heals 0; multiple
      pools; empty `spend` restores pact slots only; stable creature at 0 HP heals out of 0;
      long rest restores everything and lowers exhaustion 2→1 and 1→0; refusals
      `ENCOUNTER_ACTIVE` (both rests), `INSUFFICIENT_HIT_DICE` (too many; absent size),
      `LONG_REST_REQUIRES_HP`, `TARGET_DEAD`, `DUPLICATE_PARTICIPANT`.
- [ ] T044 [P] [US5] Write `test/commands/spell-slots.test.ts`: expend standard and pact;
      restore one and several; refusals `SLOT_LEVEL_UNAVAILABLE` (no such level; pact level
      mismatch; no pact pool), `NO_SLOT_AVAILABLE`, `SLOT_NOT_EXPENDED`, `TARGET_DEAD`.

**Checkpoint**: all six stories pass independently.

---

## Phase 7: Polish — coverage meta-test, replay scene, docs, full gate (AC #9, #11)

- [ ] T045 Write `test/coverage.test.ts`: for every option of the command `type`
      discriminator, assert some `test/commands/*.test.ts` contains `type: "<type>"`; for every
      `RefusalCodeSchema` option, assert some test file contains an `expectRefusal(` call
      naming that code. The test prints the missing names on failure.
- [ ] T046 Write `test/replay.test.ts`: a scripted mini-scene (add three combatants, roll
      initiative, an attack roll and a save, two damage rolls (one critical, one resisted), a condition with a turn-end expiry, advances through a
      round, a death save, end the encounter, short rest, expend and restore a slot). Assert
      that replaying the concatenated events from `emptyState()` equals the state threaded
      through each step, and that `scriptedRng.remaining()` is 0.
- [ ] T047 [P] Add a refuse-before-draw sweep to `test/execute.test.ts`: for one refusal case
      per code that a dice-drawing command can return, assert `countingRng` saw 0 draws.
- [ ] T048 [P] Write `packages/dnd5e-engine/README.md` (one screen): the entry point, the
      invariants, the "no I/O" rule, links to `specs/026-dnd5e-engine/contracts/`.
- [ ] T049 Run the quickstart (specs/026-dnd5e-engine/quickstart.md) and fix any drift
      between it and the code.
- [ ] T050 Run `pnpm ci:check` from the worktree root; it must pass. Save its tail to
      `specs/026-dnd5e-engine/ci-evidence.txt`.

### Constitution compliance (folded into the phases above)

- Cross-plane boundary check updated for the new package (Principle III/VI): T006–T009.
- Event types versioned (Principle IV): T013 (`v: 1` on every event).
- Scripted-dice tests cover every engine command (Principle VI): T024, T030–T032, T034–T035,
  T038–T040, T043–T044, enforced by T045.
- Agent-facing interface exercised by a test (Principle I): every command test drives
  `execute` with a plain object command, the same path the gate uses.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7, one dispatch each.
- Phase 4 depends on Phase 3 (its flow test uses `damage.apply`).
- Phase 3, 5 and 6 touch disjoint `src/commands/*` and `test/commands/*` files, so an
  orchestrator MAY run them as parallel dispatches after Phase 2 merges into the branch; the
  only shared edits are the handler registration line in `src/execute.ts` and T040, which
  then moves to Phase 7. Sequential is the default.
- Inside a phase, `[P]` tasks touch different files.

## Notes

- No "for now" deferrals. Everything out of scope (research R8) belongs to adjudication
  (TASK-0046) by design, not to a later engine card.
- A contract change discovered during implementation is made in `contracts/` in the same
  commit as the code, and called out in the phase report.

## Deviations

- T001/T003: added `@types/node` (`^22.20.4`, already in the lockfile via `apps/server`) to the engine `devDependencies` and `types: ["node"]` to `test/tsconfig.json`. `purity.test.ts` reads files with `node:fs`, and the test tsconfig needs Node types to typecheck. `src` stays Node-free (`types: []`).
- T011: `spellSlots.standard` uses `z.partialRecord`, because Zod 4's `z.record` with an enum key requires every key and the contract says a missing key means no slots of that level.
- T012: the `exhaustion` rejection on `condition.apply`/`condition.remove` is `ConditionKeySchema.exclude(["exhaustion"])` instead of a `superRefine`; the parse failure (`INVALID_COMMAND`) is identical.
- T020: `src/index.ts` also exports the types `DiceTerm`, `ScriptedRng` and `DiceParseResult`/`Rng`, because the listed public signatures reference them. The error classes stay internal (`src/rng.ts`).
- T014: `EngineResultSchema` lives in `src/schema/refusals.ts` and imports `events.ts`; no cycle.
