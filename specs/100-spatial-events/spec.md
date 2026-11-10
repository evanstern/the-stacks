# Feature Specification: Zone fog, `zone.revealed` and the per-viewer spatial projection

**Feature Branch**: `task-0271-spatial-events`

**Created**: 2026-11-09

**Status**: Draft

**Input**: TASK-0271 (N-06), as amended by the operator's ruling on spec 094 OQ-10 (2026-11-08):
`space.defined`, `combatant.placed` and `combatant.moved` are engine events from TASK-0270,
replayed through `evolve`, not session `actor.*` events. This card adds `zone.revealed` and the
per-viewer projection only. Absorbs TASK-0201 (objects as targets).

**Grounding**: constitution 3.0.0 (III, V, VI); decisions P-02, P-09, P-10
(`docs/design/replan-2026-11/decisions-for-ratification.md`); `target-architecture.md` §3
(hidden information: the server filters placements and zones per viewer) and §7
(`project(events, viewer)`); spec 094 (merged: `Zone.hidden`, the three engine events,
`SpaceView`); `packages/session-model` (catalog, `canSee`, `project()`);
`apps/server/src/ws/subscribe.ts` and the subscriber registry (row-level `canSee`); spec 097
planner contract (branch `task-0267-planner`: `PlanActor.seen`, `TARGET_UNSEEN`); the TASK-0277
card (the UI consumer); runbook `docs/design/r1-fast-table-runbook.md` (lane LS, merge spine row
11, the "Projection PRs" gate).

**Clarify**: `speckit-clarify` skipped. The ruling and the sources settle the model. The judgment
calls left are open questions with recommendations at the end.

## The model in one paragraph

Fog is zone-granular and party-wide. The **players' map** is the set of zones and edges the party
may see. It is the fold of public `zone.revealed` rows, so every viewer holds the same map. A zone
is **fogged** when the engine space holds it and the players' map does not. The gate decides each
spatial engine row's visibility with one pure rule, the **fog rule**. A row that names a fogged
zone is written `dm`, unless the row shows its subject to the party. In that case the gate first
writes a public `zone.revealed` for those zones, then writes the row `public`. `space.defined` is
always `dm`. The gate pairs it with a public `zone.revealed` that resets the players' map. Clients
receive rows through the existing `canSee` filter, so no client ever receives a fogged zone's id,
name, edge or occupant. No WebSocket, registry or append-seam code changes.

## Scope

In scope:

- The session-native catalog event `zone.revealed` v1 (public, gate-written).
- The fog rule in the session-model gate core, applied to every row `planProposal` plans.
- `revealRows()`: the pure planner for an explicit zone reveal, for TASK-0268 to call.
- The per-viewer spatial projection `SessionProjections.spatial`, folded by `project()`.
- `spatialFor()`, `reachOf()` and `targetStatus()`: pure reads for the gate, the AI context and
  the table UI.
- Scene seeds declare a space: zones, edges, feature zones (objects), a start zone, the zone each
  NPC joins in, and the zone each encounter is fought in.
- The DM runtime defines the seed's space at scene start, places combatants as they join, and
  gathers the party into the encounter zone at encounter start.
- The AI context lists each placed combatant's zone and who is in its reach, per view.

Out of scope (owned elsewhere):

- `space.defined`, `combatant.placed`, `combatant.moved`, `move`, bands, reach: TASK-0270 (merged).
- The `reveal` Intent reaching the gate, and building `PlanState.seen`: TASK-0268 (OQ-4).
- Planner use of `seen` and of entity targets: TASK-0267.
- Zone chips, `@` targeting and life state in the UI: TASK-0277.
- Narration facts for moves and reveals: the fact sheet, TASK-0245 (OQ-12).
- Hidden creatures inside revealed zones (Hide as engine state): TASK-0217.
- Per-PC reveals and codex block visibility: N-23, P-10 (OQ-3).
- Line of sight, lights, grid fog, the board: N-26, N-27 (R5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A hidden zone stays hidden until the party sees it (Priority: P1)

The seed hides the reed camp and the loft. At scene start, players see the near bank, the
ferry-house and the ferry. They never receive a row that names the reed camp. When Tamsin climbs
to the loft, the loft appears on every player's map in the same write as her move.

**Why this priority**: proposed AC #1 and #2; constitution III ("A client MUST NOT receive
information its viewer may not see").

**Independent Test**: session-model tests plan gate proposals against a DM projection, append
the rows to an in-memory log, and fold the log as the DM and as a player. No server is needed.

**Acceptance Scenarios**:

1. **Given** a space with zones `bank`, `house`, `loft` (hidden) and `camp` (hidden), **When**
   the AI DM's `space.define` proposal is planned, **Then** the rows are `space.defined` (`dm`)
   then `zone.revealed` (`public`, `reset: true`, zones `bank` and `house`, and only the edges
   between them).
2. **Given** that log, **When** it is folded for a player, **Then** `spatial.space` holds exactly
   `bank` and `house`, and no row the player can see contains the string `loft` or `camp`.
3. **Given** party combatant `tamsin` in `house`, **When** `move tamsin → loft` is planned,
   **Then** the rows are `zone.revealed` (`public`, zone `loft`, edge `house`–`loft`), then
   `combatant.moved` (`public`), then `encounter.changed` when an encounter is active.
4. **Given** `goblin-2` in fogged `camp`, **When** it moves to the fogged zone `reeds`, **Then**
   `combatant.moved` is `dm` and no `zone.revealed` is written.
5. **Given** any log the gate planned from public proposals, **When** it is folded for a player,
   **Then** the player's `spatial` deep-equals `spatialFor(project(log, dm), player)`.

---

### User Story 2 - What the party sees arrive or cross into view, it sees (Priority: P2)

The Director's encounter start adds four goblins in the reed camp. Their arrival is a sighting:
the reed camp is revealed with them. A goblin that later flees from the camp into the fogged
marsh reveals the marsh, because the party watched it go.

**Why this priority**: proposed AC #3. Arrivals and crossings are the common ways fog lifts.

**Independent Test**: session-model gate tests, as US1.

**Acceptance Scenarios**:

1. **Given** fogged `camp`, **When** `combatant.add goblin-2` with placement `camp` is planned,
   **Then** a public `zone.revealed` (`camp`, with the occupants already placed there) precedes
   the public `combatant.added`.
2. **Given** `goblin-2` in revealed `camp` and fogged `marsh`, **When** it moves to `marsh`,
   **Then** a public `zone.revealed` (`marsh`) precedes the public `combatant.moved`.
3. **Given** `snag` placed in fogged `camp` by a `dm` row, **When** `camp` is revealed later,
   **Then** the `zone.revealed` row's `occupants` include `snag: camp`, and the player's
   `spatial.placements` show `snag` in `camp`.
4. **Given** a mechanics proposal with `visibility: "dm"`, **When** it moves anyone anywhere,
   **Then** every row stays `dm` and no zone is revealed (the DM's deliberate secret).

---

### User Story 3 - The AI DM knows where everyone stands (Priority: P3)

The AI DM's prompt state lists each combatant's zone and who is in its reach. The companion's
and the narrator's views list only revealed zones, so neither leaks the reed camp before the party
finds it.

**Why this priority**: proposed AC #4. The planner (TASK-0267) owns legality. The model still
needs positions to propose sensible Intents and prose.

**Independent Test**: server unit tests build a snapshot from fixture projections and render the
`dm`, `seat` and `fiction` views.

**Acceptance Scenarios**:

1. **Given** `tamsin` and `goblin-2` in `camp` and `odo` in `bank`, **When** the `dm` view
   renders, **Then** tamsin's line carries `zone camp; reach goblin-2`, odo's carries
   `zone bank; reach none`, and the zones line marks fogged zones `(hidden)`.
2. **Given** `goblin-3` in fogged `marsh`, **When** the `seat` and `fiction` views render,
   **Then** neither contains `marsh` or the marsh zone's name, and goblin-3's line carries no zone.
3. **Given** a combatant with no placement, or a scene with no space, **When** any view renders,
   **Then** its line carries no zone and the zones line is absent (today's output).

---

### User Story 4 - Scenes declare zones, and a door or post is a target (Priority: P4)

The Greyhollow Ford seed declares its zones. The ferry-house door and the post Pell is tied to are
feature zones. Once revealed, `&camp-post` resolves as an entity target. Before that it is
unseen. A feature zone never rolls initiative.

**Why this priority**: proposed AC #5; the card description ("Scenes declare zones and objects as
zone features"); TASK-0201.

**Independent Test**: seed tests parse every shipped seed; session-model tests call
`targetStatus()`; a server test runs scene start with the scripted DM.

**Acceptance Scenarios**:

1. **Given** each shipped seed, **When** it parses, **Then** its `space` passes `SpaceSchema`,
   its start zone exists and is not hidden, and every NPC and encounter zone exists.
2. **Given** scene start for `greyhollow-ford`, **When** the Director's opening group runs,
   **Then** `space.defined` lands before the first party `combatant.added`, and each party
   combatant is placed in the start zone.
3. **Given** fogged feature zone `camp-post`, **When** `targetStatus` runs for a player with
   `{ kind: "entity", id: "camp-post" }`, **Then** it returns `unseen`. After the reveal it
   returns `ok`.
4. **Given** `{ kind: "entity", id: "camp" }` (an `area`, not a `feature`), **Then**
   `targetStatus` returns `unknown`.
5. **Given** any feature zone, **Then** no engine combatant and no initiative entry has its id.

### Edge Cases

- A space with every zone hidden: the reset row carries `zones: []`. The player map is empty.
- A second `space.define`: the reset row keeps zones already on the players' map, even when the
  new space marks them hidden (no re-hiding, OQ-9). It drops zones the new space removed.
- A zone where a party combatant stands is always in the reset row.
- A path through a fogged zone between two revealed zones reveals the fogged zone.
- `combatant.placed` to `null` from a revealed zone is public. From a fogged zone it is `dm`.
- `combatant.removed` of a combatant in a fogged zone is `dm`. The player keeps the record without
  a placement. TASK-0274's departure uses `combatant.placed`, not removal.
- A `dm`-visibility proposal is never loosened and never reveals (US2 #4). The player's view of
  that combatant stays as last seen. Parity tests cover gate-planned public proposals only.
- `encounter.changed` after a fogged move stays public. It carries feet used, not zones.
- An occupant added by a `dm` row shows on reveal as a placement whose combatant the player's
  engine state lacks. The UI shows the id. Spec 088's arrival rule keeps this rare.
- A batch with a fogged row reads incomplete in that player's `diagnostics.incompleteBatches`.
  This is expected (OQ-8).
- A scene with no space: no `zone.revealed` row, `spatial` stays empty, and play is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Event**

- **FR-001**: The catalog MUST gain session-native `zone.revealed` v1: kind `state-change`,
  catalog visibility `any`, payload `ZoneRevealedV1` (contracts/zone-revealed.md).
- **FR-002**: Only the gate MUST write `zone.revealed`, always `public`. A client `send` of it MUST
  keep refusing `CATALOG_TYPE_REQUIRES_GATE`.
- **FR-003**: `ZoneRevealedV1` MUST refuse a zone with `hidden: true`, duplicate zone ids, an edge
  with neither end in `zones`, an occupant in a zone outside `zones`, and an empty non-reset row.

**Fog rule (gate core)**

- **FR-004**: `planProposal` MUST pass every planned row through `fogRows(p, rows)` before
  validation. `fogRows` MUST be pure. It MUST track engine state and the players' map across the
  rows it plans.
- **FR-005**: A row MUST keep its planned visibility when that visibility is not `public`, or when
  the row names no fogged zone.
- **FR-006**: `space.defined` MUST be written `dm` and followed by one public `zone.revealed` with
  `reset: true`. Its zones MUST be the new space's zones that are not hidden, are already on the
  players' map, or hold a party combatant. Its edges MUST be the new space's edges between them.
- **FR-007**: A public row that names a fogged zone MUST be written `public` and preceded by one
  public `zone.revealed` for those zones when any of these holds: the row is `combatant.added`;
  its subject is a party combatant; it also names a zone on the players' map.
- **FR-008**: Any other public row that names a fogged zone MUST be written `dm`.
- **FR-009**: The zones a row names MUST be: `space.defined` all zones; `combatant.added`
  `after.placement`; `combatant.removed` `before.placement`; `combatant.placed` `before` and
  `after`; `combatant.moved` `before`, `after` and `path`. Other rows name no zone.
- **FR-010**: A `zone.revealed` row MUST carry the revealed zones with `hidden: false`, the
  engine-space edges joining them to each other and to the players' map, and the placement of
  every combatant standing in them (`occupants`).
- **FR-011**: `revealRows(p, actor, zoneIds, reason)` MUST return one `zone.revealed` row for the
  fogged zones among `zoneIds`, or no row when none is fogged. It MUST refuse an unknown zone
  `INVALID_PROPOSAL`.

**Projection**

- **FR-012**: `SessionProjections` MUST gain `spatial: SpatialView`
  (contracts/spatial-projection.md).
- **FR-013**: `spatial.map` MUST be the fold of `zone.revealed` rows. A reset row replaces it. A
  non-reset row merges zones and edges by id. Every viewer folds the same rows.
- **FR-014**: `spatial.space` MUST be the engine space for the DM viewer and `spatial.map` for a
  player viewer.
- **FR-015**: `spatial.placements` MUST be folded from the spatial engine rows the viewer
  receives and from `zone.revealed` occupants. For the DM it MUST equal
  `spaceViewOf(engine).placements`.
- **FR-016**: `spatialFor(p, viewer)` MUST derive a viewer's `SpatialView` from the DM
  projection. For a player it MUST equal that player's folded `spatial` for every log the gate
  planned from public proposals.
- **FR-017**: `reachOf(view, combatantId)` MUST return the other combatants in the same zone,
  sorted, or `[]` when unplaced. Zone-mode reach covers `engaged` only (spec 094 FR-008).
- **FR-018**: `targetStatus(p, viewer, ref)` MUST return `ok`, `unseen` or `unknown` for an
  `actor`, `zone` or `entity` ref, per contracts/spatial-projection.md.
- **FR-019**: The ledger MUST gain one `change` row per `zone.revealed`, so the text stream shows
  each reveal (constitution V).

**Seeds and runtime**

- **FR-020**: `SceneSeedSchema` MUST gain optional `space` (`zones`, `edges`, `start`), optional
  `npcs[].zone` and optional `encounters[].zone`. A seed without `space` MUST play as today.
- **FR-021**: `crossCheckSeed` MUST refuse a `start` that is unknown, hidden or of kind
  `feature`; an NPC or encounter zone outside the space; and `zone` fields in a seed with no
  `space`.
- **FR-022**: Scene start MUST submit `space.define` with the seed's zones and edges before the
  first party `combatant.add`. Each party `combatant.add` MUST carry `placement` at `start`.
- **FR-023**: A monster `combatant.add` the runtime submits (spec 088 arrival, encounter start)
  MUST carry its encounter's `zone` as `placement`. An NPC `combatant.add` (pull-in) MUST carry
  the active encounter's zone when an encounter from the seed is active, else the NPC's `zone`.
  A missing seed zone means no `placement`.
- **FR-023a**: At encounter start, before the initiative roll, the runtime MUST submit
  `combatant.place` to the encounter's `zone` for each party combatant placed elsewhere. Until
  TASK-0269 moves resolve onto the engine `move`, this keeps every fighter engaged, so spec 094's
  band checks refuse no attack today's play makes (OQ-13).
- **FR-024**: The four shipped seeds MUST declare a space per plan "Seed layouts", including the
  feature zones `ferry-house-door` and `camp-post`.

**AI context**

- **FR-025**: `SnapshotActor` MUST gain `zone` and `reach`. `SnapshotStage` MUST gain `zones`
  (id, name, kind, revealed), or `null` when the scene has no space.
- **FR-026**: The `dm` view MUST render every zone, mark fogged zones `(hidden)`, and render each
  placed combatant's zone and reach.
- **FR-027**: The `seat` and `fiction` views MUST render only revealed zones. They MUST omit the
  zone and reach of a combatant in a fogged zone. The `fiction` view MUST use zone names, never
  ids.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM defines spaces and moves combatants through the same
  `mechanics` proposals a human DM sends. The fog rule runs inside the gate for both seats. An
  explicit reveal reaches the gate as the `reveal` Intent (TASK-0268, OQ-4).
- **CR-002** (II. One Intent vocabulary): This card adds no client write path. Only the gate
  writes `zone.revealed` (FR-002).
- **CR-003** (III. Event sourcing): Hidden zones and placements MUST live only in `dm` rows. The
  server MUST filter them with the existing `canSee`. A client MUST NOT receive a fogged zone's id,
  name, edge or occupant (SC-001).
- **CR-004** (V. Many views, one state): `spatial` MUST be a projection of the log. Every reveal
  and every move MUST appear in the stream as a ledger row. Geometry stays in `@the-stacks/space`.
- **CR-005** (VI. Engine owns the numbers): Positions MUST stay in engine state. Fog is
  visibility, not a second position store: `zone.revealed` occupants copy engine placements.
- **CR-007** (IX. UX quality bar): `fogRows` MUST be synchronous and in-memory, well inside the
  fact-row budget (< 1 s p95).
- **CR-009** (XI. Operator-owned content): Seed zones are original content. No book text.

### Key Entities

- **Players' map**: the zones and edges revealed to the party; the fold of `zone.revealed`.
- **Fogged zone**: a zone in the engine space and not on the players' map.
- **Fog rule**: the gate's pure decision of a spatial row's visibility and the reveals it needs.
- **Feature zone**: a zone of kind `feature` that models an object, such as a door or a post. It
  is an `entity` target and never a combatant.
- **SpatialView**: one viewer's space, the players' map, and the placements that viewer may see.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The hidden-information test passes. For each scripted scenario, no row a player can
  see and no field of the player's projection contains a fogged zone's id or name.
- **SC-002**: The per-viewer parity test passes for every scripted scenario (FR-016).
- **SC-003**: Each proposed card AC maps to at least one named test (table below).
- **SC-004**: `pnpm ci:check` is green. Existing suites pass. Seeds without `space` behave exactly
  as before.
- **SC-005**: `fogRows` on a 64-zone space and a 12-row plan takes under 1 ms (one timing test).

## Acceptance criteria map (proposed rewritten card AC)

The orchestrator applies these to TASK-0271 in place of the current three.

| # | Proposed AC | Covered by |
|---|---|---|
| 1 | No row a player receives and no player projection holds an unrevealed zone or a placement in one. | US1, FR-005–FR-010, CR-003; `packages/session-model/test/fog-secrecy.test.ts` |
| 2 | A player's folded spatial projection equals the one derived from the DM projection for the same log. | US1 #5, FR-012–FR-016; `packages/session-model/test/spatial-parity.test.ts` |
| 3 | Party moves, arrivals and fog crossings reveal the zones they name with a public `zone.revealed` in the same write. | US2, FR-006, FR-007, FR-010; `packages/session-model/test/gate-fog.test.ts` |
| 4 | The AI context lists each placed combatant's zone and who is in its reach; the seat and fiction views omit unrevealed zones. | US3, FR-025–FR-027; `apps/server/test/dm/snapshot-space.test.ts` |
| 5 | Seeds declare zones, and a revealed door or post resolves as an `entity` target that never enters initiative. | US4, FR-018, FR-020–FR-024; `apps/server/test/dm/seed.test.ts`, `packages/session-model/test/spatial-targets.test.ts`, `apps/server/test/dm/scene-start-space.test.ts` |

Original AC #1 becomes #1. Original #2 becomes #4, narrowed to placed combatants (OQ-6). Original
#3 becomes #5. #2 and #3 are new: the runbook's "Projection PRs" gate requires the parity test,
and #3 is the reveal behaviour the ruling leaves to this card.

**Proposed card description**: "Add the session event `zone.revealed` and the fog rule that sets
each spatial engine row's visibility in the gate. Fold a per-viewer spatial projection. Add zone
and reach facts to the AI turn context. Scenes declare zones, and objects as feature zones.
`space.defined`, `combatant.placed` and `combatant.moved` are engine events (TASK-0270; spec 094
OQ-10 ruling). Absorbs TASK-0201."

## Seam contracts for consumers

- `zone.revealed` v1: [contracts/zone-revealed.md](contracts/zone-revealed.md).
- `SpatialView`, `spatialFor`, `reachOf`, `targetStatus`, `fogRows`, `revealRows`:
  [contracts/spatial-projection.md](contracts/spatial-projection.md).
- TASK-0268 builds `PlanState.actors[].seen` as `targetStatus(p, viewer, ref) !== "unseen"` and
  passes `spatialFor(p, viewer)` as the planner's `space` (OQ-4).
- TASK-0277 reads `projections.spatial` and `reachOf`. Bands come from `@the-stacks/space`.

## Assumptions

- TASK-0270 merged: `Zone.hidden`, the three engine events and `spaceViewOf` exist on main.
- The gate plans every spatial row through `planProposal` with the DM projection (`gate.ts` loads
  `{ role: "dm" }`). `appendMechanicsBatch` has no production caller and gets no fog rule.
- Spec 088's arrival rule stands: an unseen monster joins the engine when it arrives.
- Party combatants are `p.party[].combatantId`, companions included.

## Open questions (recommendations for the orchestrator)

- **OQ-1 — Frozen gate contract.** The fog rule changes what `mechanics`, `floor` and
  `scene-presence` plans write: a row may become `dm`, and a public `zone.revealed` may precede
  it. That amends `specs/029-proposal-gate/contracts/gate-api.md`, a frozen contract
  (dispatch-rules line 41). **Recommend:** the operator rules an additive amendment ("rows that
  name a fogged zone follow spec 100's fog rule"). Quote the ruling in the Phase 2 brief. Phase 2
  does not start without it.
- **OQ-2 — Crossings reveal.** A non-party combatant that crosses between a revealed and a fogged
  zone reveals the fogged zone. **Recommend:** adopt. Ceiling: a DM keeps a crossing secret only
  with a `dm`-visibility proposal. Upgrade: Hide as engine state (TASK-0217) and per-observer
  sight (R5 line of sight).
- **OQ-3 — Fog is party-wide.** `zone.revealed` is always public. There is no per-PC reveal.
  **Recommend:** adopt for R1. A `reveal` Intent with a zone target and a `to` other than `party`
  refuses until N-23 (codex block visibility) cards it.
- **OQ-4 — Explicit DM reveal.** This card adds no proposal kind: 029 is frozen and Intents are
  the vocabulary. Until TASK-0268 merges, zones reveal only by party entry, arrival and crossing.
  **Recommend:** add two AC to TASK-0268: "the `reveal` Intent with a zone target plans
  `revealRows`" and "`PlanState.seen` and the planner's `space` come from `targetStatus` and
  `spatialFor`".
- **OQ-5 — Objects are feature zones.** A door or post is a `feature` zone joined to its room by
  a short edge. Standing in it means engaged with it. **Recommend:** adopt. Attacking an object
  needs object AC and HP, so the planner returns a ruling. Card "object stats" onto the R2 codex
  epic with the trigger "first object attack in a playtest".
- **OQ-6 — Non-combatant NPCs have no position.** An NPC gets a zone when it joins the engine
  (seed `zone`, FR-023). Before that the AI context shows no zone for it. This narrows original
  AC #2 from "each actor" to "each placed combatant". **Recommend:** adopt. No second position
  store (spec 094 OQ-6).
- **OQ-7 — Exits into fog are invisible.** An edge to a fogged zone is not on the players' map.
  **Recommend:** adopt. Upgrade: an "unexplored exit" marker with the R5 board.
- **OQ-8 — Player batch diagnostics.** A batch with a fogged row reads incomplete in a player's
  `diagnostics.incompleteBatches`. **Recommend:** document it as expected and change nothing.
- **OQ-9 — No re-hiding.** A revealed zone stays revealed across `space.define`. **Recommend:**
  adopt. Card "re-fog a zone" with the trigger "a seed needs a zone to close again".
- **OQ-10 — `resolve.ts` overlap.** FR-022 and FR-023 edit `apps/server/src/dm/nodes/resolve.ts`,
  which the runbook's 0271 file list omits. TASK-0274 (spine #10) and TASK-0269 (#15) edit it
  too. **Recommend:** add 0271 to the runbook's `resolve.ts` overlap row. Merge 0271 after 0274,
  as the spine already orders.
- **OQ-11 — New workspace dependencies.** `@the-stacks/session-model` and `@the-stacks/server`
  gain `@the-stacks/space` for `ZoneSchema`, `EdgeSchema` and `SpaceSchema`. **Recommend:**
  adopt. It is a declared package seam, not a third-party package.
- **OQ-12 — Narration facts for moves and reveals.** The runbook lists `dm/facts.ts` for 0271.
  This spec leaves it alone: the `fiction` snapshot view already carries zones, and TASK-0245's
  fact sheet replaces the facts module. **Recommend:** add an AC to TASK-0245: "public
  `combatant.moved` and non-reset `zone.revealed` rows are fact rows".
- **OQ-13 — Party gathering at encounter start.** Resolve's `move` step (spec 079) moves no one
  in the engine, so placed fighters never close distance until TASK-0269. FR-023a places the
  party in the encounter zone at encounter start. Ceiling: a fight across zones (archers on the
  bank) is not modelled before TASK-0269. **Recommend:** adopt; TASK-0269 removes the gathering
  step when interpret emits `move` Intents (add that as a TASK-0269 AC).

## Operator rulings (2026-11-09)

- OQ-1: the fog rule runs in the proposal gate. The operator approves amending the frozen `specs/029-proposal-gate/contracts/gate-api.md`; the amendment ships in this card's PR with a changelog line citing this ruling. Phase 2 may proceed.
- OQ-2, OQ-3, OQ-6, OQ-7, OQ-8: adopted as recommended.
- OQ-4: zone reveal Intent and `seen` → AC on TASK-0268. OQ-12: move and reveal fact rows → note on TASK-0245. OQ-13: encounter-start gathering removal → AC on TASK-0269. OQ-5: object stats → R2 codex epic TASK-0259. OQ-9: re-fogging → revisit card TASK-0305.
- OQ-10, OQ-11: runbook footprint corrected (resolve.ts and dm/snapshot/ in; assemble.ts and facts.ts out; new dependency on @the-stacks/space).
- The five proposed AC replace the card's AC.
