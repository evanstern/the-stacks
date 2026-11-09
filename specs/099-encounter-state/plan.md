# Implementation Plan: Encounter state machine

**Branch**: `task-0274-encounter-state` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/099-encounter-state/spec.md`

The spec and `contracts/engine-surface.md` hold the seams, so this plan has no separate
data-model.md, research.md or quickstart.md.

## Summary

Give engine combatants an optional side. Add `combatant.side`, `combatant.depart` and `stand`,
and four pure selectors (`areHostile`, `hostilesStanding`, `encounterOver`, `closeCombatFoes`).
Map flee and surrender presence changes to the new commands in the session-model gate. In the
server, derive each seed encounter's phase (`pending`, `active`, `ended`), let the Director resume
an ended encounter with fresh initiative, filter absent and yielded monsters out of every start,
end the encounter in code when no hostile stands, and join turn-mode arrivals. In the planner,
fold close-combat disadvantage into ranged attacks and map `stand`.

## Technical Context

**Language/Version**: TypeScript, Node 22, as the repo.

**Primary Dependencies**: existing only. **No new runtime dependency.** The engine already
depends on `@the-stacks/space`; the planner already depends on the engine (spec 097).

**Storage**: none. **No migration.** The new event rides the existing mechanics envelope.

**Testing**: Vitest. Scripted dice (`scriptedRng([])`) for every new engine command. Server
integration tests use the scripted provider and `REQUIRE_DATABASE=1` on the worktree stack.

**Performance Goals**: the selectors are O(combatants). They serve the fact-row budget
(constitution IX: fact rows < 1 s p95). `encounterOver` runs once per AI DM job.

**Constraints**: engine stays pure (no I/O, no clock, no model). Back-compatible logs: a missing
side behaves as today, except that a fled combatant also leaves its zone.

**Scale/Scope**: 1 new engine source file, 8 engine source files changed; 1 session-model source
file; 5 server source files; 2 planner modules; about 12 test files; 1 prompt version bump.

## Design

### Engine (`packages/dnd5e-engine`)

- `src/schema/state.ts`: `SideSchema`, `Side`; `CombatantSchema.side` optional.
- `src/schema/commands.ts`: `CombatantInit.side` optional; commands `combatant.side`,
  `combatant.depart`, `stand` (contract table).
- `src/schema/events.ts`: `combatant.sided`.
- `src/evolve.ts`: one case, `combatant.sided` sets `side`.
- `src/sides.ts` (new): the four selectors. `closeCombatFoes` reads placements directly (same
  zone is band `engaged`) and `isUnable` from `commands/attacks.ts`.
- `src/commands/combatants.ts`: copy `side` on add; `handleCombatantSide`.
- `src/commands/encounter.ts`: extract the body of `handleInitiativeLeave` into
  `leaveEvents(state, id, reason): RefusalResult | EngineEvent[]` and the body of
  `handleEncounterEnd` into `endEvents(state, reason): EngineEvent[]`. Both handlers keep their
  behaviour. `handleCombatantDepart` composes them (FR-007): leave events, or end events when
  leave refuses `NO_ELIGIBLE_COMBATANT`, then the `combatant.placed` null event. TASK-0215 lands
  after this on the same file; the extraction gives it one seam to read.
- `src/commands/move.ts`: `handleStand` (FR-008). Cost `Math.floor(effectiveSpeed / 2)`. Checks
  in order: unknown, not prone, then (encounter only) off turn, no speed, speed zero, over left.
  Reuses `withMovement`.
- `src/execute.ts`: register the three handlers. `src/index.ts`: export the selectors and `Side`.
- `README.md`: bullets for the three commands and the selectors.

### Session model (`packages/session-model`)

- `src/gate/plan.ts` `scene-presence` case: replace the `initiative.leave` branch with
  `combatant.depart` when `after === "absent"` and the combatant is in the order **or placed**.
  Add the `yielded` branch: `combatant.side` `neutral` when the combatant's side is `hostile`.
  The `arrived` branch is unchanged.

### Server (`apps/server/src/dm`)

- `seed/combatants.ts`: `combatantFromSrd(monster, id, name, side)`.
- `gates/plan-gate.ts`:
  - `encounterPhase(projections, enc)` (FR-014), next to `encounterRan`.
  - `eligibleMonsters(projections, enc)` (FR-016).
  - `startableEncounterIds(projections, seed)` (FR-015).
  - `joiningCombatants` and `arrivingNpcs` return `[]` for an `ended` encounter (FR-018). They
    gain a `projections` argument where they lack one.
  - `joinableMonsters(projections, seed)`: monsters of the `active` seed encounter that are not
    combatants and are not seed NPCs (FR-021).
- `nodes/director.ts`: `runnableEncounterIds` becomes `startableEncounterIds` (import). The
  `turn` override reason for a non-startable encounter becomes "no foe of the encounter can
  fight" when the encounter is `ended`, and keeps today's text otherwise. In turn mode, keep
  arrivals in `joinableMonsters`; the existing override text covers the rest.
- `prompts/director.ts`: `(resume)` suffix on ended encounters; in turn mode, list
  `joinableMonsters` under "Unseen encounter monsters"; `PROMPT_VERSION = "dm.director-v12"`.
- `nodes/resolve.ts`:
  - Seed character add: `side: "party"`.
  - `directorOpening`, monster add: `combatantFromSrd(rec, id, name, "hostile")`.
  - `pullIn` and `arriveOne`: side `hostile` when the id is an encounter monster, else
    `neutral`.
  - `directorOpening`: branch on `encounterPhase`. `pending`: as today, then filter
    participants by `eligibleMonsters` on fresh projections. `ended`: skip adds and the
    seed-presence group, roll over eligible participants. No eligible monster: no roll.
  - `arriveOne`: in turn mode with an active encounter, follow the add with `initiative.join`
    (`mode: "normal"`), the `pullIn` pattern.
  - `directorClosing`: after the table-mode decision and before the scene end, load fresh
    projections and apply FR-020 through `endEncounter` and `setMode`.

### Planner (`packages/planner`, after TASK-0267 merges)

- The `attack` mapping module: fold close-combat disadvantage (FR-022).
- The `stand` mapping: emit the engine `stand` command (FR-023).
- Module names come from spec 097's plan on `main` at the time of Phase 6.

## Files touched

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/schema/{state,commands,events}.ts` | side, three commands, one event |
| `packages/dnd5e-engine/src/{evolve,execute,index}.ts` | case, handlers, exports |
| `packages/dnd5e-engine/src/sides.ts` (new) | four selectors |
| `packages/dnd5e-engine/src/commands/combatants.ts` | side on add, `combatant.side` |
| `packages/dnd5e-engine/src/commands/encounter.ts` | `leaveEvents`, `endEvents`, `combatant.depart` |
| `packages/dnd5e-engine/src/commands/move.ts` | `stand` |
| `packages/dnd5e-engine/README.md` | bullets |
| `packages/dnd5e-engine/test/sides.test.ts` (new) | selectors |
| `packages/dnd5e-engine/test/commands/depart.test.ts` (new) | `combatant.depart` |
| `packages/dnd5e-engine/test/commands/{combatants,move}.test.ts` | `combatant.side`, side on add; `stand` |
| `packages/dnd5e-engine/test/replay.test.ts` | `combatant.sided` replays |
| `packages/session-model/src/gate/plan.ts` | presence mapping |
| `packages/session-model/test/gate-plan.test.ts` | depart, yield, unchanged arrive |
| `packages/session-model/test/helpers.ts`, `test/catalog.test.ts` | `engineExamples()` gains `combatant.sided`; counts +1 |
| `apps/server/src/dm/seed/combatants.ts` | `side` parameter |
| `apps/server/src/dm/gates/plan-gate.ts` | phase, eligibility, startable, joinable, resume-aware joiners |
| `apps/server/src/dm/nodes/director.ts` | startable legality, turn-mode arrivals |
| `apps/server/src/dm/prompts/director.ts` | `(resume)`, turn-mode arrivals, v12 |
| `apps/server/src/dm/nodes/resolve.ts` | sides on add, resume, filter, join on arrival, code-owned end |
| `apps/server/test/dm/{director,plan-gate,assemble,seed-stats}.test.ts` | legality, phase, version, side |
| `apps/server/test/dm/encounter-resume.integration.test.ts` (new) | US1 |
| `apps/server/test/dm/fled-combatant.integration.test.ts` (new) | US2 |
| `apps/server/test/dm/encounter-auto-end.integration.test.ts` (new) | US3 |
| `apps/server/test/dm/mid-fight-arrival.integration.test.ts` (new) | US4 |
| `packages/planner/src/<attack, stand mapping>` and their tests | US5, US6 mapping |
| `docs/wiki/{dnd5e-engine,dnd5e-engine-derived-rolls,session-model,proposal-gate,dm-runtime,dm-turn-jobs,seed-npc-presence,srd-data,INDEX,CAPSULES}.md` | wiki phase |

No file under `apps/web` changes: the ledger renders the new event with
its default row, and the human DM's mechanics request already accepts any engine command.

## Merge and overlap

- Runbook spine row 10. Shares `commands/encounter.ts` with TASK-0215 (row 17) and
  `schema/` with TASK-0222 (row 12). Both merge after this. The `leaveEvents` and `endEvents`
  extraction is the seam 0215 builds on.
- Shares `nodes/resolve.ts` with TASK-0269 and TASK-0223 (rows 15, 19). Both merge after this.
- Phase 6 edits `packages/planner`, which TASK-0267 (row 8) creates. Phase 6 starts only after
  0267 merges: merge `origin/main` first. If 0267 has not merged when Phases 1-5 are done, the
  orchestrator holds the PR as draft (runbook: draft-hold true dependents).

## Test strategy

- **Scripted dice for every new command** (constitution VI). None of the three commands draw
  dice; each test passes `scriptedRng([])` and asserts it was never drawn.
- **`combatant.depart` parity**: for each `initiative.leave` test state in
  `initiative-leave.test.ts`, the depart events of an unplaced combatant equal the leave events.
- **Coverage meta-test**: each new command appears as `type: "<name>"` in a command test file.
  No new refusal code.
- **Server integration** with the scripted provider: resume (B2 seq 193-205 shape), fled
  lookout (seq 40, 161-164), auto-end on the last kill and on the last surrender, turn-mode
  arrival with one initiative roll.
- **Back-compat**: every existing engine, session-model and server suite passes. The existing
  presence tests that assert `initiative.leave` rows change to assert `combatant.depart` rows.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: AI DM, companions and humans reach flee, surrender, stand and attack
      through the same presence proposals and Intents (`stand`, `attack`). No human-only path.
- [x] **II. One Intent vocabulary**: no new Intent kind and no new write path. The planner maps
      `stand` and `attack`; no surface calls the engine directly.
- [x] **III. Event sourcing**: sides, departures and stand costs change only by versioned engine
      events through the gate. `combatant.sided` is `v: 1`, visibility `any`.
- [x] **IV. Data planes**: all new state is session-plane engine state. Seed reads stay behind
      the existing seed seam.
- [x] **V. Many views, one state**: the encounter phase is derived from the engine order and the
      ledger; it is never stored. Placements still have one store.
- [x] **VI. Engine owns the numbers**: the stand cost, the end condition and the close-combat
      foes are engine code. The planner folds an engine verdict; no model writes a number.
      Scripted-dice tests ship for all three commands.
- [x] **VII. Narration around facts**: the end and the departure land as fact rows before any
      prose. TASK-0254's contradictory facts cannot occur once the fled combatant has no turn.
- [x] **IX. UX quality bar**: O(combatants) selectors; one extra projection load per AI DM job,
      inside the fact-row budget. No UI change.
- [x] **XI. Operator-owned content**: SRD 5.2.1 ids cited (prone; ranged attacks in close
      combat); no book text.
- [x] **XIII. Just-in-time**: R1 card; every deferral is an open question for the orchestrator
      to card (OQ-2, OQ-3, OQ-5).
- VIII, X, XII: not applicable.

**Quality gate "Engine tests"**: met by the scripted-dice tests above.

**Stack conformance**: Zod is the single schema source. **Complexity Tracking**: none.
