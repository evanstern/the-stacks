# Implementation Plan: Downed hero gate and able-actor gates

**Branch**: `task-0112-downed-hero-gate` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: `specs/046-downed-hero-gate/spec.md` (operator rulings of 2026-10-27 recorded there);
decision-0025 (D17) §3.1, §3.2; spec 040 (actor snapshot, merged); spec 045 (resolve order,
merged in PR #67); contracts `specs/029-proposal-gate/contracts/gate-api.md`,
`specs/026-dnd5e-engine/contracts/refusals.md`, `specs/028-session-model/contracts/session-events.md`,
`specs/031-dm-runtime/contracts/resolve.md` and `turn-jobs.md`,
`specs/032-playtest-harness/contracts/scenario.md`, `specs/040-actor-snapshot/contracts/actor-snapshot.md`.

## Summary

Five changes, each in its own layer. Each layer has its own test.

1. **Engine.** Add `ACTOR_UNABLE` to `RefusalCodeSchema`. `attack.roll` refuses an unable
   attacker. `check.roll` refuses an unable ability checker. A saving throw is still allowed.
   The check runs after the unknown and dead checks, before any die.
2. **Declare gate.** Add `CHARACTER_UNABLE` to `GateRefusalCodeSchema`. The planner's
   `action.declare` case refuses a non-conscious character (character scope) or a proposer
   whose controlled characters are all non-conscious (party scope).
3. **Plan gate.** Add a pure `checkPlan(S0, readings, rulings, director, seed)` in the DM
   runtime. Resolve calls it first, before any write. A failing action group resolves
   `refused` with `UNKNOWN_COMBATANT` and runs no step. A failing NPC group runs no step. The
   verdicts go into the turn checkpoint.
4. **Settling.** Add a code-only loop in resolve. It runs wherever resolve lands turn mode on
   a combatant. It rolls an engine death save for a dying combatant, passes a stable or unable
   one, and stops on the first combatant that can act.
5. **Driver.** `nextMove` returns `"done"` (free mode) or `"wait"` (turn mode) for a downed
   seat. The harness records `stallReason: "seat-downed"`.

The ruled frozen-contract amendments land in the phase that changes the code they describe.

Nothing else changes: no prompt, prompt version, purpose, event type, ws frame, proposal kind,
migration or runtime dependency.

## Technical Context

**Language/Version**: TypeScript (Node 22). Existing `tsc -b` builds.

**Primary Dependencies**: none new. `zod` already covers both enum additions.

**Storage**: none new. No migration. Death saves land as the engine's existing `dice.rolled`,
`death-saves.changed`, `hp.changed` and `life-state.changed` events through the gate.

**Testing**: vitest, fake gateway, scripted dice. No paid run.
- Engine: `packages/dnd5e-engine/test/commands/attacks.test.ts` (unit; `scriptedRng`, then
  check `calls()` is 0 on a refusal). `test/coverage.test.ts` must see the new code.
- Planner: `packages/session-model/test/gate-plan.test.ts` (unit, fixture projections).
- Plan gate: new `apps/server/test/dm/plan-gate.test.ts` (unit, S0 from
  `test/dm/snapshot-fixtures.ts`).
- Resolve: `apps/server/test/dm/resolve.integration.test.ts` (real Postgres, real gate,
  scripted dice, no model). Needs `REQUIRE_DATABASE=1` on the worktree's own stack.
- Driver: `apps/server/test/playtest/driver.test.ts` (unit).
- Harness: `apps/server/test/playtest/harness.integration.test.ts` (DB; fake gateway; a
  scenario whose scripted dice drop the seat).

**Target Platform**: the one Node server process, plus the two pure packages.

**Project Type**: web service and libraries. No client change: the play route shows any
refusal as `message (code)` (`apps/web/app/play/reduce-frame.ts`).

**Performance Goals**: unchanged. The plan gate is a pure pass over at most 20 readings of 6
steps. Settling adds at most one engine command per combatant per lap.

**Constraints**:
- The engine stays pure (biome override, `check:boundaries`, `purity.test.ts`).
- `resolve.ts` stays the only DM gate writer. The plan gate writes nothing.
- The narrate import closure (`test/dm/boundary.test.ts`) must not gain an engine value
  import. `checkPlan` lives outside narrate's closure.
- S1 is still built after the last gate write (spec 040). Settling writes come before it.
- Spec 045's order holds: opening moves, rulings, action groups, NPC group, closing moves,
  turn advance. Settling runs inside the opening moves' encounter start and inside the turn
  advance.

**Scale/Scope**: about 9 source files, 8 contract or doc files, 7 test files, 1 scenario
fixture, 6 wiki notes.

## Constitution Check

*Run against `.specify/memory/constitution.md` 2.0.0 before design and again after design.
Both runs pass.*

- [x] **I. Agent-operable** — every refusal reaches a human, an AI companion and the scripted
      seat through the same `gate.handle` / `gate.submit` path with the same code. The
      harness, an agent, drives the downed-seat case end to end.
- [x] **II. Content contract** — no codex entity, no seed schema change.
- [x] **III. Data planes** — session plane only. The plan gate reads S0, which is derived
      session state plus seed names (spec 040). No new table, no cross-plane import.
- [x] **IV. Event sourcing, server authority** — every refusal appends nothing. Death saves
      pass through the gate and the engine and append only the engine's events. No new event
      type. `action.resolved` stays at payload version 1: its `refusalCode` accepts one more
      engine code. Old rows still parse. A new code is additive under "projections tolerate
      unknown types". Decision recorded in 028 `session-events.md` (FR-025).
- [x] **V. Citations** — no library claim.
- [x] **VI. 5e engine boundary** — the unable-actor rule lives in the engine. Death saves run
      only through `death-save.roll`. No model picks a death save, its expression or its
      outcome: settling is code. The engine change ships scripted-dice tests, and the coverage
      meta-test names the new code.
- [x] **VII. Structured first** — the plan-gate verdict is typed data in the checkpoint before
      anything renders it.
- [x] **VIII. Operator-owned content** — no rulebook text. The incapacitating condition list
      is a set of SRD 5.2.1 condition keys the engine already ships.
- [x] **IX. Self-hostable** — no new container, dependency or service.

**Stack conformance** — within the Architecture Constraints table. No departure.

## Design

### D1. Engine: `ACTOR_UNABLE` (FR-013 to FR-017)

- `src/schema/refusals.ts`: append `"ACTOR_UNABLE"` to `RefusalCodeSchema`. Append at the end
  to keep the 026 refusals.md order (row 27).
- `src/commands/attacks.ts`: add `isUnable(c)`. It is true when `lifeState` is `unconscious`
  or `stable`, or a condition instance has a key in
  `INCAPACITATING = ["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]`.
  After `checkNamed`:
  - `attack.roll`: refuse when `attackerId !== null` and the attacker is unable.
  - `check.roll`: refuse when `kind === "ability-check"`, `combatantId !== null`, and the
    checker is unable.
  `details` = `{ combatantId, role: "attacker" | "checker", lifeState, conditions: [keys] }`.
  The target of an attack is never checked for ability.
- `README.md` names the rule beside the dead-actor refusals.

### D2. Declare gate: `CHARACTER_UNABLE` (FR-006 to FR-009)

- `packages/session-model/src/gate/refusals.ts`: append `"CHARACTER_UNABLE"`.
- `packages/session-model/src/gate/plan.ts`, `action.declare`, after the control check:
  - Character scope: find the party member for `characterId`. Refuse when
    `member.combatant !== null` and `member.combatant.lifeState !== "conscious"`.
  - Party scope: collect the members the proposer controls (the `controls` rule in
    `gate/roles.ts`). Refuse when that list is non-empty and every member has a non-null
    combatant that is not conscious.
  - `details` = `{ characterId, reason: "life-state", lifeState }`. Party scope uses the first
    member's id and state.
- The `reason` values live in one exported constant, `CHARACTER_UNABLE_REASONS = ["life-state"]`.
  TASK-0141 appends `"absent"`.

### D3. Plan gate (FR-018 to FR-022)

- New `apps/server/src/dm/gates/plan-gate.ts`. It exports `checkPlan(input)` and the types
  `PlanVerdict` and `PlanFailure`.
  - Input: `snapshot` (S0), `readings`, `rulings`, and `joining`, the combatant ids the turn's
    Director opening moves add (the seed encounter's monsters when the Director decides
    `turn` and no encounter is active).
  - The ids that pass are the S0 actors' `combatantId`s plus `joining`.
  - For each group key (an `actionId`, or `null` for the NPC group), the steps come from the
    ruling when one exists, else from the reading. This is the same choice
    `actionGroupSteps` makes. Walk every step and every nested effect in step order.
  - First failure per group: `{ stepIndex, field, id, reason }`. `reason` is
    `"not-a-combatant"` when `id` equals an S0 actor's `id` or appears in its `aliases` and
    that actor has `combatantId === null`. Otherwise `reason` is `"not-in-snapshot"`.
  - Output: `PlanVerdict[]`, one per group, each `{ actionId, ok: true }` or
    `{ actionId, ok: false, code: "UNKNOWN_COMBATANT", failure }`.
- `resolve.ts` calls `checkPlan` once at the top, before `directorOpening`. It is pure, so
  computing it first changes no write order.
  - `resolveAction`: a refused verdict skips `runSteps` and submits `action.resolve` with
    `outcome: "refused"`, `refusalCode: "UNKNOWN_COMBATANT"`.
  - NPC group: a refused verdict runs no step. It sets
    `npcTurn = { combatantId, batchIds: [], awaitingDm: false }`, so the turn still advances.
- `TurnCheckpoint` (`apps/server/src/dm/jobs.ts`) gains optional `planGate: PlanVerdict[]`.
  It is additive; rows stored earlier lack it. The `/dm` jobs route already serves
  `jobs.result`, so the debug view shows it with no route change.
- `joining` is derived in one helper shared with `directorOpening`. That keeps one definition
  of which monsters an encounter start adds.

### D4. Settling (FR-010 to FR-012)

- New `apps/server/src/dm/nodes/settle.ts`. It exports `settleTurn(run, ctx)` and returns the
  `TableMode` it set, or null.
  - Load projections. Let `active` be the encounter's active combatant. Repeat at most
    `order.length` times:
    1. If `active` can act (`conscious` and no `INCAPACITATING` condition), stop.
    2. If `active` is `unconscious` with `zeroHpRule: "death-saves"`, submit
       `run.mech("settle:<n>:save", { type: "death-save.roll", targetId, mode: "normal" }, "Death saving throw at the start of the turn", null)`.
       Reload. If it is now conscious (a natural 20), stop.
    3. Submit `run.mech("settle:<n>:advance", { type: "turn.advance" }, "The turn passes a downed combatant", null)`.
       Reload.
  - Then submit the `table-mode` change for `active` through `activeActorFor`.
  - Submission keys are stable, so reclaim idempotence holds (`findLanded`).
- Callers in `resolve.ts`:
  - The turn-advance group: after `turn.advance` applies, call `settleTurn`. It sets the table
    mode, replacing the direct `advance:table-mode` submit.
  - `directorOpening`'s encounter start: after initiative, call `settleTurn` for the first
    active actor.
  - `nextJob` keeps its rule over `local.newTableMode`.
- The engine's `death-save.roll` takes `mode` and `reason`. Confirm the command schema fields
  in `packages/dnd5e-engine/src/schema/commands.ts` and match them exactly.
- `assemble.deriveNpcTurn` keeps its `lifeState !== "conscious"` skip (§3.1). Settling makes
  that skip unreachable from a turn advance.

### D5. Narration facts for death saves (User Story 3, scenario 7)

- `apps/server/src/dm/facts.ts` handles `dice.rolled`, `hp.changed` and `life-state.changed`.
  It may not render `death-saves.changed`. Write a facts test over a settled death-save
  batch first.
  - If the fact or the dice line is missing, add a `death-saves` fact and its rendering, plus
    the matching rebuild in `playtest/auditor/render.ts`.
  - Otherwise add only the test.
- This file is a Track C hotspot (TASK-0111, TASK-0113, TASK-0127, TASK-0130). Keep the edit
  additive.

### D6. Driver and harness (FR-001 to FR-004)

- `driver.ts`: add `seatDowned(p, scenario)`. It finds the party member for the seat's
  `characterId` and is true when its combatant is non-null and has `hp.current === 0` or
  `lifeState !== "conscious"`.
  - In `nextMove`, after the in-flight check: if downed, return `"wait"` in turn mode and
    `"done"` in free mode.
  - Export `STALL_REASON_SEAT_DOWNED = "seat-downed"`.
- `harness.ts`: when `nextMove` returns `"done"` and `seatDowned` holds, record
  `stallReason: STALL_REASON_SEAT_DOWNED`.
  - The `RunManifest` `stallReason` type in `export.ts` or the auditor schema gains the value,
    if it is an enum.
- New scenario fixture `apps/server/test/playtest/fixtures/downed-seat.json`. Pair it with a
  fake gateway DM script whose monster attack and scripted dice drop the seat in round 1.

### Contract and doc edits (all ruled; FR-023 to FR-026)

| File | Edit | Phase |
|---|---|---|
| `specs/031-dm-runtime/contracts/turn-jobs.md` "Resolve order" | Replace "the operator has not yet ratified (spec 045, OQ-1)" with the 2026-10-27 approval | 1 |
| `specs/026-dnd5e-engine/contracts/refusals.md` | Row 27 `ACTOR_UNABLE`; the header count becomes 27 | 2 |
| `specs/029-proposal-gate/contracts/gate-api.md` §2 | "the engine's 26" becomes 27; the gate code list gains `CHARACTER_UNABLE` | 2, 3 |
| `specs/029-proposal-gate/contracts/gate-api.md` §1 | The `action.declare` row adds "character able (`CHARACTER_UNABLE`)" | 3 |
| `specs/028-session-model/contracts/session-events.md` | A note on `action.resolved.refusalCode`: the code set follows the engine's enum; `ACTOR_UNABLE` added 2026-10-27 (TASK-0112); payload stays v1 | 2 |
| `specs/031-dm-runtime/contracts/resolve.md` | The plan gate before the opening moves; settling in the turn advance and encounter start | 4, 5 |
| `specs/040-actor-snapshot/contracts/actor-snapshot.md` "Extension points" | TASK-0112 plan gate: built | 4 |
| `specs/032-playtest-harness/contracts/scenario.md` "Driver" | The downed rule and `seat-downed` | 6 |

Each frozen-contract edit quotes the operator ruling in a short "Amended 2026-10-27
(TASK-0112, operator ruling)" line.

## Files touched

**Source**
- `packages/dnd5e-engine/src/schema/refusals.ts`, `src/commands/attacks.ts`, `README.md`
- `packages/session-model/src/gate/refusals.ts`, `src/gate/plan.ts` (and `src/index.ts` if the
  reasons constant is exported)
- `apps/server/src/dm/gates/plan-gate.ts` (new)
- `apps/server/src/dm/nodes/settle.ts` (new)
- `apps/server/src/dm/nodes/resolve.ts`
- `apps/server/src/dm/jobs.ts` (`TurnCheckpoint.planGate`)
- `apps/server/src/dm/facts.ts` and `apps/server/src/playtest/auditor/render.ts` (only if D5's
  test shows a gap)
- `apps/server/src/playtest/driver.ts`, `harness.ts` (and the `stallReason` type's file)

**Tests and fixtures**
- `packages/dnd5e-engine/test/commands/attacks.test.ts`
- `packages/session-model/test/gate-plan.test.ts`
- `packages/session-model/test/catalog.test.ts` (an `action.resolved` row with `ACTOR_UNABLE`
  parses)
- `apps/server/test/dm/plan-gate.test.ts` (new)
- `apps/server/test/dm/resolve.integration.test.ts`
- `apps/server/test/dm/facts.test.ts`
- `apps/server/test/playtest/driver.test.ts`, `harness.integration.test.ts`
- `apps/server/test/playtest/fixtures/downed-seat.json` and its DM script (new)
- `apps/server/test/gate.integration.test.ts` (declare refusal through `gate.handle`)

**Contracts and docs**: the table above, plus the wiki notes in the last phase.

**Migrations**: none. **New runtime dependencies**: none.

## Risks

- **Settling changes existing resolve tests' row counts** when a fixture's next combatant is
  downed. Today no resolve fixture advances onto a downed party member. If one does, its
  expected rows gain the settle submissions. That is the intended behaviour; note it in the
  phase report.
- **Shipped scenario CI case.** `greyhollow-ford` ci mode ends `ended` today. If its scripted
  dice ever drop the seat, the run now records `seat-downed` instead of declaring. Phase 6
  re-runs the case and reports.
- **Hotspots** (runbook): `resolve.ts`, `facts.ts`, `packages/dnd5e-engine`,
  `apps/server/src/playtest/`. Phase 1 merges `origin/main`. Later merges follow the runbook's
  reconcile rule.

## Complexity Tracking

No Constitution Check gate fails. Nothing to justify.
