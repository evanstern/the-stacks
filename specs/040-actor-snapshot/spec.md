# Feature Specification: Actor snapshot — one code-built state view for every DM node

**Feature Branch**: `task-0140-actor-snapshot`

**Created**: 2026-10-27

**Status**: Draft

**Input**: Board card TASK-0140, M3 sweep Track C (runbook amendment 1, order C3). It is card
U1 of decision-0025 (D17, the actor-state rule gate), designed in
`docs/design/actor-state-gate.md` §4.1 item 1 and §5.3 U1. It is the first implementation
card of TASK-0135 (that card's AC #4).

**Binding decision**: decision-0025 (D17), accepted 2026-10-26 at checkpoint C3. Both it and
the design inventory live on branch `task-0135-actor-state-gate` (not yet on `main` when this
spec was written). **This card implements decision-0025 §1 in full:**

| Rule | Text (decision-0025) | Where this spec meets it |
|---|---|---|
| §1.1 | Code builds one `ActorSnapshot` from the projections and the seed. No model writes it. | FR-001, FR-002 |
| §1.2 | Each actor carries id, display name, aliases, kind, controller, HP, life state, conditions, initiative, resources and scene presence. | FR-001, contract §2 |
| §1.3 | The stage carries table mode, active actor, encounter round, scene and trackers. | FR-001, contract §2 |
| §1.4 | `assemble` builds S0. `resolve` produces S1 and the S0-to-S1 diff. | FR-004, FR-005 |
| §1.5 | Every model node receives the snapshot; it replaces `projectionEntries` and `npcNames`. | FR-006 – FR-010 |
| §1.6 | A token cap never drops an actor silently. Dead and absent actors compress to one line. If it still does not fit, the node fails loudly. | FR-011 – FR-013 |

It also lays the type the §2 and §3 gates read (contract §9). It implements none of those
gates. Scene presence exists on every actor and is `present` everywhere until TASK-0141 (U2).
"Scene presence" here is decision-0025's term. It is not decision-0024's player connection
presence (branch `task-0051-presence`), and that presence never enters the snapshot.

**The contract**: [`contracts/actor-snapshot.md`](contracts/actor-snapshot.md) defines
`ActorSnapshot`, the build rules, aliases, the S0-to-S1 diff, the three render views, the cap
and the overflow failure. TASK-0141, 0142, 0143, 0144, 0145, 0146 and 0147 cite it.

**Evidence the card answers**: G6 in the inventory. `projectionEntries`
(`apps/server/src/dm/prompts/common.ts:168-223`) cuts state lines from the end under an
800-token cap, and the encounter line comes last; it omits monster conditions and AC. The
narrator and auditor see no actor state at all, only `npcNames`, a flat name list with no life
state (`facts.ts:497-503`). G1 and G2 (M2 seq 225, F52) need that state to be checkable; this
card supplies it, and TASK-0143 and TASK-0146 check against it.

**Rulings in force (not reopened)**: the engine owns every number (decision-0017, R8). The
narrate import closure holds no engine value and nothing from `gate/`. Player-facing prompts
carry no DM-only seed text (`specs/034-narration-quality/contracts/player-facing-context.md`).
Every changed prompt bumps its `PROMPT_VERSION`. No migration. No new runtime dependency. No
paid model run: tests use the fake gateway and scripted dice.

**Clarify**: skipped. Decision-0025 §1, the inventory and the card's six criteria settle the
scope. The judgment calls the decision left open have recorded defaults under Assumptions
(the three render views, the chronicle's state-at-throughSeq read, the U1 NPC-combatant join,
and the diff staying out of prompts). None changes the card's scope.

## User Scenarios & Testing *(mandatory)*

The "users" here are the DM runtime's model nodes and the later gate cards. A table player
sees the effect as narration that knows who is dead, down and present.

### User Story 1 - One state view, built by code (Priority: P1)

Every DM node reads actor and stage state from one snapshot that code builds from the session
projections and the scene seed. No node assembles its own state lines.

**Why this priority**: decision-0025 §1.1. Every other D17 card reads this type (contract §9).

**Independent Test**: build a snapshot from the turn-mode combat fixture plus the Greyhollow
Ford seed and assert every party member, engine combatant and seed NPC appears once, with the
fields of contract §2 (card AC #1).

**Acceptance Scenarios**:

1. **Given** projections with three party members, four goblins in an encounter and the seed's
   three NPCs, **When** the snapshot is built, **Then** it holds nine actors: Snag is one actor
   (the seed NPC joined with combatant `snag`), and each actor carries id, name, aliases, kind,
   controller, HP, life state, conditions, initiative, resources and presence `present`.
2. **Given** turn mode with `ai:dm` active and goblin-3 the active combatant, **When** the
   snapshot is built, **Then** the stage's active actor is goblin-3's actor and the encounter
   order lists actor ids in initiative order.
3. **Given** the same inputs twice, **When** the snapshot is built twice, **Then** the two are
   deep-equal.
4. **Given** any snapshot, **When** it is serialized, **Then** it holds no DM-only seed string
   (`dmOnlySeedText`).

---

### User Story 2 - Before and after the dice (Priority: P1)

`assemble` builds S0 before any model runs. `resolve` builds S1 after its last write and the
typed S0-to-S1 diff.

**Why this priority**: decision-0025 §1.4 and §4. The claim gate (TASK-0143), audit
(TASK-0146) and batch gate (TASK-0147) compare against S1 and the diff.

**Independent Test**: run a scripted-dice turn in which a goblin drops to 0 HP; assert S1 shows
it dead and the diff holds exactly its `hp` and `life-state` changes (card AC #2).

**Acceptance Scenarios**:

1. **Given** a turn whose attack kills goblin-3, **When** resolve completes, **Then**
   `ResolveOutput.snapshot` shows goblin-3 dead at 0 HP and `ResolveOutput.diff` holds one `hp`
   and one `life-state` entry for goblin-3 and nothing else for actors.
2. **Given** a Director move that starts an encounter, **When** resolve completes, **Then** the
   diff's stage list holds `table-mode` free to turn and `encounter-started`, and each added
   combatant is a `joined` entry.
3. **Given** a turn that changes nothing, **When** resolve completes, **Then** the diff is empty.
4. **Given** a reclaimed turn, **When** resolve re-runs, **Then** S1 is rebuilt from the log and
   equals the S1 of an uninterrupted run.

---

### User Story 3 - Every prompt renders state from the snapshot (Priority: P1)

Director, interpret, adjudicate, narrate, audit, companion and chronicle prompts render state
from the snapshot. `projectionEntries` and `npcNames` no longer exist.

**Why this priority**: decision-0025 §1.5. Today the narrator, auditor and chronicler see no
actor state, which is why a goblin dead since an earlier turn can be narrated shrieking.

**Independent Test**: build each of the seven prompts from fixtures and assert each holds the
snapshot section and no retired section; grep the source for the two retired names (card
AC #3).

**Acceptance Scenarios**:

1. **Given** an encounter where goblin-3 died last turn, **When** the narrate prompt is built,
   **Then** its world section lists the Goblin lookout as dead.
2. **Given** a monster with the frightened condition, **When** the interpret prompt is built,
   **Then** the state section shows the condition and the monster's AC (G6).
3. **Given** a companion job, **When** its prompt is built, **Then** the state shows its own sheet
   and the other actors' HP, life state and conditions, and no monster AC.
4. **Given** a chronicle job through seq N, **When** its prompt is built, **Then** the state is
   the snapshot as of seq N, in the digit-free `fiction` view.
5. **Given** the server source tree, **When** it is searched, **Then** `projectionEntries` and
   `npcNames` appear nowhere.

---

### User Story 4 - No actor is dropped under the cap (Priority: P2)

Under a prompt's state cap, dead and absent actors compress to one short line. A snapshot that
still does not fit fails the node loudly. No actor ever disappears from a prompt silently.

**Why this priority**: decision-0025 §1.6 (G6). No run has hit the cap yet; the gap is
structural, so it ranks after the stories that change behaviour now.

**Independent Test**: render a snapshot of six party members and a large encounter with many
dead goblins under the cap; assert every actor id appears exactly once and dead ones are
compressed. Render one too large to fit; assert the node fails with `state-overflow` (card
AC #4, AC #5).

**Acceptance Scenarios**:

1. **Given** the schema-maximum seed shape all alive, **When** each view renders, **Then** it fits
   uncompressed.
2. **Given** a snapshot over the cap with dead actors, **When** it renders, **Then** each dead
   actor has one compressed line, each living actor keeps its full line, and every actor appears.
3. **Given** a snapshot over the cap after compression, **When** the interpret node runs,
   **Then** it fails with error kind `state-overflow`, the turn's failure record names the node
   and the token count, and no model call is made.
4. **Given** the same overflow in a companion or chronicle job, **When** the job runs, **Then** it
   logs the overflow, makes no model call and writes nothing.

---

### User Story 5 - The table plays exactly as before (Priority: P1)

Existing DM tests and the scripted CI playtest stay green (card AC #6). The model call count
and order per turn do not change.

**Independent Test**: `pnpm ci:check` plus the DB suites with `REQUIRE_DATABASE=1`, including
`test/playtest/playtest.integration.test.ts` on the shipped Greyhollow Ford scenario.

**Acceptance Scenarios**:

1. **Given** the scripted CI playtest, **When** it runs on this branch, **Then** it passes with
   the same number of model calls per purpose as on `main`.

### Edge Cases

- **Party member with no combatant**: the actor has null HP, life state and resources; the
  line says "no tracked stats".
- **Seed NPC with no combatant**: an actor of kind `npc` with null stats, presence `present`.
- **Seed NPC linked to a combatant** (Snag): one actor, the NPC id, the engine name as alias.
- **Combatant removed** (`combatant.remove`): absent from S1; the diff records `left`.
- **Encounter ended**: S1's stage encounter is null; the diff records `encounter-ended`. Actors
  keep their HP and life state.
- **Seed fails to load in the chronicle**: the snapshot is built without a seed (no NPC actors,
  no sheets); the chronicle still runs.
- **Two actors with one id**: the build throws `ACTOR_ID_COLLISION`; the turn fails through the
  `internal` path. It never merges or drops an actor.
- **Reclaim after a partial resolve**: S0 is rebuilt from the current log, so the diff omits
  rows the first attempt landed. NarrationFacts still reports those rows by action id.
- **A name with a digit**: the `fiction` view prints the name as given; the narrate digits check
  applies to prose, not to the prompt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define an `ActorSnapshot` type holding a version, the source
  `throughSeq`, the seed id, an actor list and a stage, exactly as contract §2 states.
- **FR-002**: `buildSnapshot(projections, seed)` MUST be pure and deterministic and MUST follow
  contract §3 rules 1–9. No model output is an input.
- **FR-003**: Each actor's `aliases` MUST follow contract §4. `partyNameTerms` MUST return
  byte-identical output to today.
- **FR-004**: `assemble` MUST build S0 from the projections it already loads and expose it as
  `AssembleOutput.snapshot`.
- **FR-005**: `resolve` MUST build S1 from projections read after its last gate write and MUST
  expose `ResolveOutput.snapshot` and `ResolveOutput.diff` (`diffSnapshots(S0, S1)`, contract §5).
- **FR-006**: The director, interpret and adjudicate prompts MUST render S0 in the `dm` view
  in their `## State` section; the Director's also carries tracker lines with advance-when text.
- **FR-007**: The narrate and audit prompts MUST render S1 in the `fiction` view in their
  party and world sections, including audit's regenerate path.
- **FR-008**: The companion prompt MUST render a snapshot of current state in the `seat` view.
- **FR-009**: The chronicle prompt MUST render a snapshot folded through the job's `throughSeq`
  in the `fiction` view.
- **FR-010**: `projectionEntries` and `NarrationFacts.npcNames` MUST be deleted, with every
  caller and fixture updated.
- **FR-011**: Rendering MUST follow contract §6.2: full lines first; over the cap, dead and
  absent actors compress; still over, `SnapshotOverflowError`. Every actor MUST have exactly one
  line in any successful render.
- **FR-012**: A turn node whose snapshot overflows MUST fail with `NodeError` kind
  `state-overflow` carrying the view, token count, cap and actor counts, through the existing
  failure record and DM notice.
- **FR-013**: A companion or chronicle job whose snapshot overflows MUST log the overflow, make
  no model call for it and submit nothing for it.
- **FR-014**: Every prompt whose text changes MUST bump its `PROMPT_VERSION`: `dm.director-v3`,
  `dm.interpret-v3`, `dm.adjudicate-v3`, `dm.narrate-v4`, `dm.audit-v3`, `dm.companion-v3`,
  `dm.chronicle-v3`.
- **FR-015**: The number and order of model calls per turn, companion job and chronicle job
  MUST NOT change.
- **FR-016**: The `fiction` view MUST print no digit and no actor id of its own. The `seat`
  view MUST print no AC, resources or sheet for a non-party actor.
- **FR-017**: No rendered view MUST hold a DM-only seed string.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The snapshot is the state interface every DM agent node
  reads. It is built from the same projections a human client folds; no human-only path is
  added.
- **CR-004** (VI. 5e engine boundary): The snapshot copies engine numbers and computes none.
  No model rolls or computes a number. The snapshot module imports engine types only.
- **CR-006** (IV. Event sourcing): The snapshot is a projection of the log plus the seed. It is
  never logged and never written. Hidden state (trackers) never reaches a `fiction` or `seat`
  render.

### Key Entities

- **ActorSnapshot**: the code-built view of every tracked actor and the stage at one log seq.
- **SnapshotActor**: one party member, engine combatant or seed NPC with its state.
- **SnapshotStage**: table mode, active actor, encounter round and order, scene, trackers.
- **SnapshotDiff**: the typed actor and stage changes between S0 and S1.

## Card acceptance criteria map

| Card AC | Requirement | Proven by |
|---|---|---|
| #1 `ActorSnapshot` carries per actor id, display name, aliases, kind, controller, HP, life state, conditions, initiative, resources, scene presence; and the stage | FR-001 – FR-003 | `test/dm/snapshot.test.ts` build cases (tasks T003–T006) |
| #2 `assemble` builds S0 and `resolve` builds S1 plus the diff, with tests | FR-004, FR-005 | `test/dm/snapshot-diff.test.ts`, `assemble.test.ts`, `resolve.integration.test.ts` (T007, T012, T013) |
| #3 Seven prompts render state from the snapshot; `projectionEntries` and `npcNames` retired | FR-006 – FR-010, FR-014 | prompt tests per node and the retired-name source scan (T015–T017, T020–T026) |
| #4 Dead and absent actors compress; no actor dropped; test over a large party and encounter | FR-011 | `test/dm/snapshot-render.test.ts` (T008, T009) |
| #5 A snapshot that cannot fit fails the node loudly, with a test | FR-012, FR-013 | `snapshot-render.test.ts`, `runner.test.ts`, companion and chronicle overflow tests (T010, T014, T027) |
| #6 Existing dm tests and the scripted CI playtest stay green | FR-015 | `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1` (T019, T029) |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 7 of 7 DM model purposes receive actor state from the snapshot; 0 build their own
  state lines.
- **SC-002**: In a render of 6 party members, 24 combatants and 20 NPCs, 50 of 50 actors appear
  exactly once.
- **SC-003**: 0 actors are dropped by any render; an over-cap snapshot fails 100% of the time
  with `state-overflow`.
- **SC-004**: The scripted CI playtest passes with the same model call count per purpose as
  `main`.
- **SC-005**: 0 DM-only seed strings and 0 digits in any `fiction` render of the shipped seed.

## Assumptions

- **Three views.** Decision-0025 says every node receives the snapshot; it does not say every
  node sees every field. Narrate, audit and chronicle write player-facing text under a no-digit
  rule, so they get a digit-free `fiction` view. The companion is a player-equivalent seat, so
  it keeps today's state (its own sheet, others' HP) and gains conditions, with no monster AC.
  The planning nodes get everything.
- **Every seed NPC is an actor.** `npcNames` listed every seed NPC; the snapshot does too, with
  presence `present`. Per-beat presence is TASK-0142 (U8).
- **The NPC-combatant join.** A seed NPC whose `identity.combatant` names an engine combatant is
  one actor in U1, so Snag is not listed twice. TASK-0142 (U8) owns the identity rule beyond that.
- **Chronicle state at `throughSeq`.** decision-0025 §4 says "snapshot at throughSeq". The
  chronicle folds the log through its `throughSeq` for the snapshot, beside the current read it
  already makes for its bookkeeping.
- **No diff in prompts.** Narrate already gets this turn's changes as NarrationFacts. Rendering
  the diff too would say the same thing twice. U1 builds and tests the diff; TASK-0146 (U7)
  renders it for audit, and TASK-0143 and TASK-0147 read it in code.
- **Caps.** The state cap rises from 800 to per-view caps (contract §6.2), sized so the
  schema-maximum seed fits uncompressed. Compression only matters past that.
- **Merge order.** TASK-0135 (decision-0025 and the design doc) merges before this card's PR.
  TASK-0110 (resolve order) follows this card in Track C and touches `nodes/resolve.ts`.
