# Feature Specification: Space package and zones in the engine

**Feature Branch**: `task-0270-space-zones`

**Created**: 2026-11-08

**Status**: Draft

**Input**: TASK-0270 (N-05): "Create `packages/space` with zones, edges, range bands, and reach
checks. Add `placement` to engine combatants and a `move` command. Absorbs TASK-0139."

**Grounding**: constitution 3.0.0 (V, VI); `docs/design/replan-2026-11/target-architecture.md`
§3 and §8; decisions P-06 and P-09 (`decisions-for-ratification.md`); `research/vtt-research.md`
§3 (zones and grid as one model); the frozen Intent contract
(`origin/task-0266-intent-contract:specs/092-intent-contract/contracts/intent-schema.md` §5, §6.6);
runbook `docs/design/r1-fast-table-runbook.md` (lane LF, merge spine row 5).

**Clarify**: `speckit-clarify` skipped. The sources settle the model. The remaining judgment calls
are recorded as open questions with recommendations at the end of this spec.

## Scope

In scope:

- A new renderer-free, model-free package `@the-stacks/space`: the zone graph schema, edges,
  range bands, cheapest paths, reach and range rules, and the `SpaceView` read model.
- Engine state gains the scene's space and each combatant's placement and speed.
- Engine commands `space.define`, `combatant.place`, `move` and `movement.action`.
- Engine attack checks for reach and range by band, when both combatants are placed.
- Engine `provokers()`: who may take an opportunity attack when a combatant leaves its zone.
- The server seed mapping sets speed, reach and range from SRD data.

Out of scope (owned elsewhere):

- `zone.revealed`, per-viewer filtering, seed zones, AI-context space facts: TASK-0271 (N-06).
- Planner use of space for `move`, `dash`, `disengage` and targets: TASK-0267 (N-02).
- Encounter flee, truce and resume: TASK-0274 (N-09).
- Squares, grid movement, line of sight, AoE templates: N-26, N-27 (R5). Zone AoE caps: TASK-0227.
- Resolve's existing `move` step (spec 079) keeps working unchanged. TASK-0269 moves it onto the
  planner and the engine `move` command.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A combatant moves between zones, and the engine refuses illegal moves (Priority: P1)

A player says "I run to the ford". The engine moves the character along the cheapest open path.
It refuses a move through a blocked edge and a move longer than the turn's movement.

**Why this priority**: card AC #1. Every later spatial card needs engine-owned positions.

**Independent Test**: engine tests define a three-zone space, place a combatant and run `move`
with scripted dice. No server is needed.

**Acceptance Scenarios**:

1. **Given** zones A–B (open, 20 ft) and B–C (open, 20 ft), a combatant in A with speed 30 on its
   turn, **When** it moves to B, **Then** the engine emits `combatant.moved` (path `[A, B]`, 20 ft)
   and the turn's movement used is 20.
2. **Given** the state after that move, **When** it moves on to C, **Then** the engine refuses
   `MOVE_OVER_SPEED` (40 ft of 30 ft) and emits no event.
3. **Given** A–B is `blocked` and no other path exists, **When** the combatant moves to B, **Then**
   the engine refuses `MOVE_BLOCKED`.
4. **Given** the combatant took `movement.action dash`, **When** it moves A to C (40 ft), **Then**
   the move succeeds (budget 60 ft).
5. **Given** no active encounter, **When** a combatant moves A to C, **Then** the move succeeds with
   no speed budget, and a blocked edge still refuses.
6. **Given** an active encounter where the mover is not the active combatant, **When** it moves,
   **Then** the engine refuses `MOVE_OFF_TURN`.

---

### User Story 2 - Reach and range use bands, with no grid (Priority: P2)

A goblin with a scimitar attacks a fighter in the next zone. The engine refuses `OUT_OF_REACH`.
An archer shoots two zones away with a shortbow. The engine rolls with disadvantage (long range).

**Why this priority**: card AC #2. Attacks are the most common combat Intent.

**Independent Test**: engine tests place attacker and target at each band and run `attack.roll`
with scripted dice.

**Acceptance Scenarios**:

1. **Given** attacker and target in one zone (`engaged`), **When** a melee entry attacks, **Then**
   the attack resolves.
2. **Given** they are in adjacent zones (`near`), **When** a melee entry attacks, **Then** the
   engine refuses `OUT_OF_REACH` before drawing a die.
3. **Given** a ranged entry with range 80/320 and the target `far` (120 ft), **When** it attacks,
   **Then** the attack rolls with disadvantage.
4. **Given** a ranged entry with range 20/60 and the target `far`, **When** it attacks, **Then**
   the engine refuses `OUT_OF_RANGE`.
5. **Given** either combatant is unplaced, or no space is defined, **When** any attack runs,
   **Then** no band check applies (today's behaviour).

---

### User Story 3 - Leaving an engaged band provokes opportunity attacks (Priority: P3)

A fighter leaves the zone where a goblin stands. The goblin may strike first. If the fighter took
the Disengage action, the goblin may not.

**Why this priority**: card AC #3. Spec 079 runs opportunity attacks from a model-written
`leavesReachOf` list. This story lets the engine decide who may react.

**Independent Test**: golden-dice engine tests: `provokers`, then `attack.roll` with
`reaction: true`, `damage.apply` and `move`, with scripted faces.

**Acceptance Scenarios**:

1. **Given** fighter and goblin in zone A in an encounter, **When** `provokers(state, fighter, B)`
   runs, **Then** it returns `[goblin]`.
2. **Given** that result, **When** the goblin's reaction attack runs with faces `[15]`, then
   `damage.apply`, then the fighter's `move` to B, **Then** the events match the golden list and
   the goblin's Reaction is spent.
3. **Given** the fighter took `movement.action disengage`, **When** `provokers` runs, **Then** it
   returns `[]`.
4. **Given** the goblin spent its Reaction, is incapacitated, has no melee entry, or stands in
   another zone, **Then** `provokers` omits it.
5. **Given** the reaction attack drops the fighter to 0 HP, **When** the fighter's `move` runs,
   **Then** the engine refuses `ACTOR_UNABLE`, and the fighter stays in zone A.

---

### User Story 4 - The space package stands alone (Priority: P1)

The board (R5), the planner and the server read one geometry module. It has no renderer, no React
and no model.

**Why this priority**: card AC #4; constitution V ("Geometry MUST live in the renderer-free
`space` package").

**Independent Test**: the boundary check flags each fixture; a package test asserts `zod` is the
only runtime dependency.

**Acceptance Scenarios**:

1. **Given** a file under `packages/space/src/` that imports `react`, `pixi.js`, a `node:*` module
   or `@the-stacks/dnd5e-engine`, **When** `pnpm ci:check` runs, **Then** Biome flags it.
2. **Given** `packages/space/package.json`, **Then** its runtime dependencies are exactly `zod`.

### Edge Cases

- A move to the mover's own zone refuses `INVALID_COMMAND`.
- A prone mover crawls: every foot costs 2 ft (SRD 5.2.1 prone).
- A mover with Speed 0 (grappled, paralyzed, petrified, restrained, unconscious) refuses
  `MOVE_OVER_SPEED` in an encounter.
- Exhaustion reduces Speed by 5 ft per level (SRD 5.2.1 exhaustion).
- A dead or incapacitated mover refuses `ACTOR_UNABLE`.
- A mover in an encounter with no `speed` refuses `STAT_UNDEFINED` (OQ-9).
- `space.define` that drops a zone a combatant stands in refuses `ZONE_IN_USE`.
- `combatant.place` or `move` with no space refuses `SPACE_UNDEFINED`. An unknown zone refuses
  `ZONE_UNKNOWN`. An unplaced mover refuses `NOT_PLACED`.
- Equal-cost paths tie-break by the lexicographic order of the zone id list.
- A path through a zone that holds a hostile is allowed. Only the origin zone provokes (OQ-2).

## Requirements *(mandatory)*

### Functional Requirements

**Space package**

- **FR-001**: `@the-stacks/space` MUST export `SpaceSchema`, `ZoneSchema`, `EdgeSchema`,
  `ZoneIdSchema`, `PlacementSchema`, `BandSchema` and their types.
- **FR-002**: A zone MUST carry `id`, `name`, `kind` (`room` | `area` | `feature`), `tags`
  (default `[]`) and `hidden` (default `false`).
- **FR-003**: An edge MUST be undirected and carry `from`, `to`, `kind`
  (`open` | `door` | `squeeze` | `climb` | `blocked`) and `feet` (a multiple of 5, 5–1000).
- **FR-004**: `SpaceSchema` MUST refuse duplicate zone ids, edges to unknown zones, self-edges and
  duplicate zone pairs. It MUST cap a space at 64 zones and 256 edges.
- **FR-005**: `path(space, from, to)` MUST return the cheapest path over non-blocked edges, or
  `null`. A `squeeze` or `climb` edge costs 2 ft per foot.
- **FR-006**: `band(space, a, b)` MUST return `engaged` (same zone), `near` (one passable edge),
  `far` (two) or `out` (more, or no passable path), counting edges on the fewest-edge path.
- **FR-007**: `BAND_FEET` MUST fix the nominal distance of each band: engaged 5, near 30, far 120.
- **FR-008**: `reachCovers(band, reachFt)` MUST hold only for `engaged` in zone mode.
- **FR-009**: `rangeOf(band, {normal, long})` MUST return `normal`, `long` or `out` by comparing
  `BAND_FEET[band]` with the two ranges. Band `out` MUST always return `out`.
- **FR-010**: `SpaceView` and its queries (`zoneOf`, `occupants`, `bandBetween`) MUST be pure
  functions over plain data.
- **FR-011**: The package MUST depend on `zod` only. It MUST NOT import a renderer, React, a Node
  built-in, the engine, session-model or app code.

**Engine state and commands**

- **FR-012**: `EngineState` MUST gain optional `space`. `Combatant` MUST gain optional
  `placement` and optional `speed` (walk feet, 0–200). Every existing state MUST stay valid.
- **FR-013**: `space.define` MUST set or replace the space and emit `space.defined`. It MUST refuse
  `ZONE_IN_USE` when a placed combatant's zone is missing from the new space.
- **FR-014**: `combatant.place` MUST set or clear a combatant's placement with no edge or speed
  check, and emit `combatant.placed`. It serves DM placement, arrival and flight.
- **FR-015**: `combatant.add` MUST accept optional `placement` and `speed`, and refuse
  `ZONE_UNKNOWN` for a zone outside the space.
- **FR-016**: `move` MUST walk a combatant to a zone along `path()`, emit `combatant.moved` with
  the path and the feet spent, and refuse `MOVE_BLOCKED` when no passable path exists.
- **FR-017**: In an encounter, `move` MUST refuse `MOVE_OFF_TURN` for a non-active mover and
  `MOVE_OVER_SPEED` when the cost exceeds the turn's remaining movement.
- **FR-018**: The turn's movement budget MUST be `effectiveSpeed × (1 + dashes)`. Prone MUST double
  the cost. Speed-0 conditions and exhaustion MUST apply (SRD 5.2.1).
- **FR-019**: `movement.action` MUST record `dash` or `disengage` on the active combatant's turn
  and emit `encounter.changed`. It MUST refuse `MOVE_OFF_TURN` for a non-active combatant and
  `NO_ACTIVE_ENCOUNTER` outside an encounter.
- **FR-020**: `attack.roll` MUST refuse `OUT_OF_REACH` for a melee use beyond `engaged`, and
  `OUT_OF_RANGE` for a ranged use whose `rangeOf` is `out`, before drawing a die.
- **FR-021**: `attack.roll` MUST add a disadvantage mode source for a ranged use at `long`.
- **FR-021a**: A `melee-or-ranged` entry MUST be a melee use against an `engaged` target and a
  ranged use otherwise. An attack by explicit `expression` (no entry) MUST skip band checks.
- **FR-022**: `AttackEntrySchema` MUST gain optional `reachFt` and `rangeFt: {normal, long}`.
  A placed ranged attack whose entry lacks `rangeFt` MUST refuse `STAT_UNDEFINED`.
- **FR-023**: `provokers(state, moverId, toZoneId)` MUST return, in initiative order, the
  combatants in the mover's origin zone that are in the encounter, conscious, not incapacitated,
  and hold an unspent Reaction and a melee entry. It MUST return `[]` when the mover stays in its
  zone or has disengaged this turn.
- **FR-024**: The engine MUST export `spaceViewOf(state)`, `provokers`, `effectiveSpeed` and
  `movementLeft`, and re-export the `space` types it uses in its schemas.
- **FR-025**: The server seed mapping MUST set `speed`, `reachFt` and `rangeFt` from SRD data.
  Each shipped seed PC MUST carry `speed`.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM and companions MUST reach `move`, `dash` and
  `disengage` through the same Intents a human sends. This task adds the engine commands the
  planner (TASK-0267) emits. It adds no surface.
- **CR-002** (II. One Intent vocabulary): This task adds no write path. TASK-0267 maps the
  `move`, `move_token`, `dash`, `disengage` and `add_combatant` Intents to the new commands.
- **CR-003** (III/V. One state): Positions and the zone graph MUST live only in engine state.
  They MUST reach clients only as projections of logged engine events. `space` holds geometry.
- **CR-004** (VI. Engine owns the numbers): Speed, movement cost, reach, range and opportunity
  attack eligibility MUST come from engine code. No model writes a position or a distance.
- **CR-009** (XI. Operator-owned content): Rule conventions cite SRD 5.2.1 ids only. No book text.

### Key Entities

- **Space**: a scene's zone graph: zones and undirected edges. No grid in this task.
- **Zone**: a named place in a scene: a room, an area or a feature. The unit of position.
- **Edge**: a connection between two zones with a kind and a walking distance in feet.
- **Placement**: the zone a combatant stands in.
- **Band**: the zone-mode distance between two placements: engaged, near, far or out.
- **SpaceView**: a read model of a space plus placements, for planner, server and board.
- **Turn movement**: the active combatant's feet used, dashes and disengage flag this turn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every new engine command has scripted-dice tests. The engine coverage meta-test
  passes with every new refusal code asserted.
- **SC-002**: Each card acceptance criterion maps to at least one named test (table below).
- **SC-003**: `pnpm ci:check` is green, including the boundary check with the new space fixtures.
- **SC-004**: Existing engine, session-model and server suites pass. Scenes without a space behave
  exactly as before.
- **SC-005**: `band()` and `path()` on a 64-zone space take under 1 ms each (one timing test).

## Acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 `move` refuses blocked edges and over-speed moves | US1; FR-016–FR-018; `packages/dnd5e-engine/test/commands/move.test.ts` |
| #2 Reach and range checks use bands without a grid | US2; FR-006–FR-009, FR-020–FR-022 (with FR-021a); `packages/space/test/graph.test.ts`, `packages/dnd5e-engine/test/commands/attacks.test.ts` |
| #3 Golden-dice tests cover OA triggers from leaving an engaged band | US3; FR-023; `packages/dnd5e-engine/test/commands/opportunity.test.ts` |
| #4 The package has no renderer or React dependency | US4; FR-011; `biome.json` override, boundary fixtures, `packages/space/test/purity.test.ts` |

## Seam contracts for consumers

These shapes bind once this spec merges. Consumers import only published exports
(target-architecture §8, "Rule at every seam").

### `SpaceView` (TASK-0267 planner, TASK-0271 AI context, R5 board)

```ts
// @the-stacks/space
type ZoneId = string;                          // /^[a-z0-9][a-z0-9_.:-]{0,63}$/, as engine and intent ids
type Band = "engaged" | "near" | "far" | "out";
type Placement = { zoneId: ZoneId };           // R5 adds an optional square, additively
type SpaceView = {
  space: Space | null;                         // null: the scene has no zones
  placements: Readonly<Record<string, ZoneId>>; // actor id -> zone id
};
zoneOf(view, actorId): ZoneId | null
occupants(view, zoneId): string[]              // sorted ids
bandBetween(view, a, b): Band | null           // null when either is unplaced or space is null
band(space, from, to): Band
path(space, from, to): { zones: ZoneId[]; feet: number } | null
reachCovers(band, reachFt): boolean
rangeOf(band, { normal, long }): "normal" | "long" | "out"
BAND_FEET: { engaged: 5, near: 30, far: 120 }

// @the-stacks/dnd5e-engine
spaceViewOf(state: EngineState): SpaceView     // combatant placements only
provokers(state, moverId, toZoneId): CombatantId[]
effectiveSpeed(c: Combatant): number | null    // null: no speed stat
movementLeft(state, combatantId): number | null // null: no encounter (unbounded)
```

The planner signature stays `plan(state, space: SpaceView, intent)` (target-architecture §2).
The server builds the view with `spaceViewOf(projections.engine)`. TASK-0271 may merge
non-combatant actors into `placements` from its own projection (OQ-6).

### Engine events (TASK-0271 spatial events and projections)

Three engine events join `EngineEventSchema`. They reach the log as mechanics rows. Session-model's
`MECHANICS_EVENT_TYPES` derives them with no catalog edit (OQ-10).

```ts
{ type: "space.defined",    v: 1, reason, before: Space | null, after: Space }
{ type: "combatant.placed", v: 1, reason, combatantId, before: Placement | null, after: Placement | null }
{ type: "combatant.moved",  v: 1, reason, combatantId, before: Placement, after: Placement,
  path: ZoneId[], feet: number }
```

`encounter.changed` carries the turn-movement record after `move` and `movement.action`.
`Zone.hidden` marks a zone the DM has not revealed. TASK-0271 owns `zone.revealed`, the row
visibility of these events, and the per-viewer filter.

### Engine commands (TASK-0267 planner, TASK-0274 encounter)

```ts
{ type: "space.define", space: Space, reason }
{ type: "combatant.place", combatantId, zoneId: ZoneId | null, reason }
{ type: "move", combatantId, toZoneId: ZoneId, reason }
{ type: "movement.action", combatantId, action: "dash" | "disengage", reason }
// combatant.add's combatant gains: placement?: Placement, speed?: number
// AttackEntry gains: reachFt?: number, rangeFt?: { normal: number; long: number }
```

- Planner mapping: `move` with 1 zone → `provokers` → the reaction attacks policy allows →
  `move`. `move_token` → `combatant.place`. `dash` and `disengage` → `movement.action`.
  `add_combatant` with a zone → `combatant.add` with `placement`. The planner refuses a `square`
  or `point` target until R5.
- TASK-0274: a fled combatant leaves its zone with `combatant.place {zoneId: null}`.

### New engine refusal codes

`SPACE_UNDEFINED`, `ZONE_UNKNOWN`, `ZONE_IN_USE`, `NOT_PLACED`, `MOVE_BLOCKED`, `MOVE_OVER_SPEED`,
`MOVE_OFF_TURN`, `OUT_OF_REACH`, `OUT_OF_RANGE`. They pass through the Intent layer tagged
`source: "engine"` (Intent contract §9). `OUT_OF_REACH` and `OUT_OF_RANGE` share names with the
contract's reserved planner codes on purpose: the planner may raise them early, the engine raises
them always.

## Assumptions

- Zone mode only. A scene without a space plays exactly as today.
- Engine schema additions are optional fields and new union members. `ENGINE_SCHEMA_VERSION`
  stays 1.
- The engine knows no sides. Callers filter `provokers` by hostility, as `reactors()` does today.
- The turn-movement record carries its round and combatant id, so `turn.advance` needs no edit:
  a stale record reads as zero movement used.

## Open questions (recommendations for the orchestrator)

- **OQ-1 — Same zone means engaged.** No explicit engagement pairs. **Recommend:** adopt for R1.
  Ceiling: a large zone over-engages; authors split it. Grid mode (R5) resolves per square.
- **OQ-2 — Only the origin zone provokes.** Passing through a zone with a hostile does not
  provoke. **Recommend:** adopt, with a `ponytail:` comment in `provokers`. Upgrade path: grid.
- **OQ-3 — Ranged attacks in close combat.** SRD gives disadvantage when a hostile is within
  5 ft. The engine knows no sides. **Recommend:** the planner adds the mode source in TASK-0267;
  card "engine knows sides" with TASK-0274 as its home.
- **OQ-4 — Standing from prone costs half Speed.** The Intent contract lists it as a gap to N-05.
  **Recommend:** card it onto TASK-0274 (encounter turn state); keep it out of this PR.
- **OQ-5 — Shove `push` in zone mode.** 5 ft rarely crosses a zone. **Recommend:** the planner
  returns `needs_ruling`; the DM applies the ruling with `combatant.place`. Real push in R5.
- **OQ-6 — Non-combatant positions.** NPCs without a combatant and scene objects have no engine
  placement. **Recommend:** TASK-0271 models objects as `feature` zones or zone tags, and keeps
  non-combatant presence per zone in its projection, merged into `SpaceView.placements`. It must
  not add a second position store for combatants.
- **OQ-7 — Band distances.** near 30 ft, far 120 ft. Edge `feet` drive movement only.
  **Recommend:** adopt; the space README documents it as the one zone-mode convention, as P-06
  does for the grid.
- **OQ-8 — Edge costs and doors.** `squeeze` and `climb` cost double. A `door` is passable.
  **Recommend:** adopt; a locked door is a `blocked` edge set by `space.define` until TASK-0271
  needs a finer event.
- **OQ-9 — Missing speed.** **Recommend:** refuse `STAT_UNDEFINED` in an encounter rather than
  default to 30 ft. The engine invents no numbers. Seeds and the SRD mapping supply speed.
- **OQ-10 — Where spatial events live.** The TASK-0271 card says "add `space.defined`,
  `actor.placed`, `actor.moved` … to the catalog". This spec makes them engine events
  (`space.defined`, `combatant.placed`, `combatant.moved`) so positions have one store
  (constitution V, VI) and replay through `evolve`. **Recommend:** amend the TASK-0271 card: it
  adds `zone.revealed` and the per-viewer projection; the other three arrive as mechanics rows
  under `combatant.*` names. Operator ruling wanted before TASK-0271's spec is authored.
