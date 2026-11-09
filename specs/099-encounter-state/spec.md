# Feature Specification: Encounter state machine

**Feature Branch**: `task-0274-encounter-state`

**Created**: 2026-11-09

**Status**: Draft

**Input**: TASK-0274 (N-09): "Make the encounter a live engine state: start, join, leave, flee, end
and resume. Absorbs TASK-0253, 0254." Card AC #4 and #5 carry spec 094 OQ-3 and OQ-4 by operator
ruling (2026-11-08).

**Grounding**: constitution 3.0.0 (II, III, VI); `docs/design/replan-2026-11/plan-of-action.md`
R1 exit criterion 6 ("Encounter can end, resume, and drop a fled combatant");
`docs/design/replan-2026-11/board-rework-map.md` (N-09; 0253 and 0254 merged here; 0201 went to
N-06, 0202 to TASK-0056); archived cards TASK-0253 and TASK-0254 (runbook B2 playtest, session
bb4952dc); `docs/playtests/2026-11-09-r1-baseline-playtest.md` (R1B-encounter-end not reached:
combat never ended); `specs/094-space-and-zones/spec.md` (OQ-3, OQ-4); `specs/048-scene-presence`;
`specs/088-pre-encounter-monster` (OQ-2); `specs/078-revealed-npc-present` (OQ-2);
runbook `docs/design/r1-fast-table-runbook.md` (lane LS, merge spine row 10).

**Clarify**: `speckit-clarify` skipped. The cards, the playtest logs and the merged specs settle
the behaviour. The remaining judgment calls are open questions with recommendations at the end.

## Problem

Three playtest failures share one cause: the encounter is a bare engine record with no lifecycle
the server can reason about.

1. **No resume (TASK-0253).** Runbook B2 seq 193-231: a toll ended the reed-camp fight. Tamsin
   attacked Snag again. The Director chose turn mode, but legality refused it: "the encounter is
   not a seed encounter that has yet to run" (`nodes/director.ts` `runnableEncounterIds`). The
   table stayed in free mode for the rest of the session.
2. **Fled combatant keeps its turn (TASK-0254).** The goblin lookout fled at seq 40, in free mode,
   before the encounter started. `directorOpening` rolled initiative for every seed monster,
   absent or not. On its turn (seq 161-164) the facts said both "planned dagger throw" and "no
   rules effect". All three narrations failed audit.
3. **No end (R1 exit 6).** Only the Director's `free` decision ends a fight. The R1 baseline
   stalled in round 5 and never reached an end.

The engine also knows no sides. Spec 094 OQ-3 (ranged attacks in close combat) and the end
condition both need to know who opposes whom.

## Scope

In scope:

- **Sides in the engine.** An optional `side` on each combatant: `party`, `hostile` or `neutral`.
  A `combatant.side` command changes it.
- **Engine selectors.** `areHostile`, `hostilesStanding`, `encounterOver` and `closeCombatFoes`.
- **Engine `combatant.depart`.** A combatant leaves the scene: the order and its zone, in one
  command.
- **Engine `stand`.** Standing from prone costs half the actor's Speed (card AC #5).
- **Session-model presence mapping.** A `fled`, `left` or `removed` presence change sends
  `combatant.depart`. A `surrendered` or `conceded` change of a hostile sends `combatant.side`
  `neutral`.
- **Server encounter lifecycle.** Each seed encounter is `pending`, `active` or `ended`.
  The Director may resume an ended encounter. A resume rolls fresh initiative and skips the
  seed's opening setup.
- **Server start filter.** An encounter start or resume never rolls initiative for an absent,
  yielded or dead monster.
- **Code-owned end.** The AI DM's resolve ends the encounter when no hostile stands.
- **Mid-fight arrivals.** In turn mode, a monster of the running seed encounter that arrives joins
  the order through `initiative.join`. Only the newcomer rolls (card AC #3).
- **Planner close-combat rule.** The planner gives a ranged attack disadvantage when a hostile
  stands in the attacker's zone (card AC #4). The planner maps the `stand` Intent to the engine
  `stand` command.

Out of scope (owned elsewhere):

- The planner package itself, its Intent mapping table and golden tests: TASK-0267 (spec 097).
  This task adds two rules to it after it merges.
- Resolve's step pipeline moving onto the planner: TASK-0269. Until it merges, live AI attacks do
  not pass through the planner (see OQ-1).
- Surprise at encounter start: TASK-0215 (shares `commands/encounter.ts`; merges after this).
- Objects as zone features and targets (absorbed TASK-0201): TASK-0271.
- Seed starting conditions (TASK-0202): TASK-0056.
- Combat turn UX (who is up, the end banner): TASK-0275.
- Human DM controls: unchanged. A seated human DM still ends an encounter from the Table mode
  slide-out (spec 060). Code-owned end runs only in the AI DM's resolve.

## Terms

- **Side**: a combatant's allegiance in a fight. `party` and `hostile` oppose each other.
  `neutral` opposes no one. A combatant with no side opposes no one.
- **Standing**: a combatant in the order whose `lifeState` is `conscious`.
- **Encounter phase**: per seed encounter, derived by the server. `pending` has not started.
  `active` holds the engine encounter. `ended` ran and no engine encounter holds it now.
- **Resume**: a new encounter run of an `ended` seed encounter, with fresh initiative.
- **Depart**: a combatant leaves the scene. It leaves the order and its zone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A broken truce resumes the fight with fresh initiative (Priority: P1)

The party agreed a toll and the Director ended the reed-camp fight. Tamsin attacks Snag. The
Director chooses turn mode for `reed-camp`. The fight resumes: every present, living goblin and
every living party member rolls fresh initiative. The seed's opening setup does not run again.

**Why this priority**: card AC #1 and R1 exit 6 ("resume"). The B2 table was stuck in free mode.

**Independent Test**: a scripted-provider integration test replays the B2 shape (seq 193-205):
start, end by `free`, then a `turn` decision on the same encounter.

**Acceptance Scenarios**:

1. **Given** the reed-camp encounter `ended` with Snag present and conscious, **When** the
   Director decides `turn` with `encounterId: "reed-camp"`, **Then** legality keeps the decision,
   one `initiative.roll` lands for the eligible participants, and the table enters turn mode.
2. **Given** that resume, **When** the rows are read, **Then** no `combatant.add` and no
   encounter-start `scene-presence` rows land (TASK-0253 AC #2: the opening setup is spent).
3. **Given** an `ended` encounter whose monsters are all dead, absent or yielded, **When** the
   Director decides `turn` on it, **Then** legality overrides the decision with reason "no foe of
   the encounter can fight".
4. **Given** an `active` encounter, **When** the Director decides `turn` on it, **Then** legality
   overrides with "already in turn mode", as today.

---

### User Story 2 - A fled combatant leaves the order and its zone (Priority: P1)

The goblin lookout flees. Its presence becomes `absent`. The engine removes it from the order and
clears its placement. If it fled before the fight, the fight starts without it.

**Why this priority**: card AC #2 and R1 exit 6 ("drop a fled combatant"). B2 shipped three
failed narrations from a turn the lookout should never have had.

**Independent Test**: engine tests for `combatant.depart`; a session-model gate test for the
presence mapping; a server integration test that replays seq 40 and seq 161-164.

**Acceptance Scenarios**:

1. **Given** a placed combatant in the order, not active, **When** `combatant.depart` runs,
   **Then** the engine emits `encounter.changed` (the order without it) and `combatant.placed`
   (`after: null`), and draws no dice.
2. **Given** the active combatant departs, **When** the command runs, **Then** the turn hands on
   exactly as `initiative.leave` does today (expiry events, skipped dead, round wrap).
3. **Given** the departing combatant is the last living one in the order, **When** the command
   runs, **Then** the engine emits the `encounter.end` events instead of a refusal.
4. **Given** an encounter is active and the lookout is in the order, **When** a `scene-presence`
   proposal with reason `fled` lands, **Then** the batch holds the presence row and the
   `combatant.depart` rows.
5. **Given** the lookout fled in free mode (seq 40), **When** the encounter starts, **Then** the
   lookout is not a participant of `initiative.roll`, and no NPC turn for it occurs (seq
   161-164 cannot happen).

---

### User Story 3 - The fight ends when no foe stands (Priority: P1)

The last goblin drops, flees or surrenders. At the end of that turn, resolve ends the encounter
and returns the table to free mode. The Director does not need to decide it.

**Why this priority**: R1 exit 6 ("encounter can end"). The R1 baseline never ended a fight.

**Independent Test**: a scripted-provider integration test kills the last hostile and asserts
`encounter.ended` and a `table-mode` free row in the same job.

**Acceptance Scenarios**:

1. **Given** turn mode with one hostile standing, **When** a party attack drops it to 0 HP,
   **Then** the same job writes `encounter.end` and a `table-mode` row with mode `free`, after the
   action's rows, and writes no `turn.advance`.
2. **Given** the last hostile surrenders (`surrendered`), **When** the job's closing group runs,
   **Then** `combatant.side` set it `neutral` and the encounter ends.
3. **Given** every party member is down and a hostile stands, **When** the closing group runs,
   **Then** the encounter does not end (death saves still need turns).
4. **Given** an encounter whose order holds no combatant with a side (a pre-099 log), **When**
   the closing group runs, **Then** code never ends it. The Director's `free` still does.

---

### User Story 4 - A newcomer joins mid-fight and rolls alone (Priority: P2)

In turn mode, a goblin that had not yet appeared comes out of the reeds. The Director reports it
as an arrival. It joins the order with its own initiative roll. Nobody else rerolls.

**Why this priority**: card AC #3. Spec 088 OQ-2 dropped monster arrivals in turn mode.

**Independent Test**: engine `initiative.join` tests (exist); a scripted-provider integration
test of a turn-mode arrival.

**Acceptance Scenarios**:

1. **Given** turn mode for reed-camp and `goblin-4` not yet a combatant, **When** the Director
   reports `goblin-4` as an arrival, **Then** `combatant.add` (side `hostile`) and one
   `initiative.join` land, with exactly one initiative `dice.rolled` row.
2. **Given** that join, **When** the order is read, **Then** the active combatant is unchanged.

---

### User Story 5 - Ranged attacks in close combat have disadvantage (Priority: P2)

Kestrel shoots while a goblin stands in her zone. The planner plans the attack with
disadvantage.

**Why this priority**: card AC #4 (spec 094 OQ-3). SRD 5.2.1
`playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat`.

**Independent Test**: engine selector tests for `closeCombatFoes`; planner golden tests.

**Acceptance Scenarios**:

1. **Given** Kestrel (`party`) and a conscious goblin (`hostile`) in the same zone, **When** the
   planner maps `/attack goblin-2 with shortbow`, **Then** the `attack.roll` command carries
   `mode: "disadvantage"`.
2. **Given** the goblin is incapacitated, blinded, `neutral`, or in another zone, or Kestrel is
   invisible, **When** the same Intent is planned, **Then** the mode is `normal`.
3. **Given** the Intent carries `+adv` and the close-combat rule applies, **When** it is planned,
   **Then** the mode is `normal` (advantage and disadvantage cancel).
4. **Given** a `melee-or-ranged` entry against an engaged target, **When** planned, **Then** the
   rule does not apply (it is a melee attack).

---

### User Story 6 - Standing from prone costs half Speed (Priority: P2)

A prone fighter stands on her turn. The engine removes `prone` and spends half her Speed.

**Why this priority**: card AC #5 (spec 094 OQ-4). SRD 5.2.1 condition `prone`
(Restricted Movement).

**Independent Test**: engine tests for `stand` with `scriptedRng([])`.

**Acceptance Scenarios**:

1. **Given** a prone combatant with Speed 30 on its turn, no movement used, **When** `stand`
   runs, **Then** the engine emits `condition.removed` (`prone`) and `encounter.changed` with
   `movement.usedFt` 15.
2. **Given** 20 ft already used of Speed 30, **When** `stand` runs, **Then** the engine refuses
   `MOVE_OVER_SPEED` (15 ft of 10 ft left).
3. **Given** effective Speed 0 (grappled), **When** `stand` runs, **Then** the engine refuses
   `MOVE_OVER_SPEED` with `details.reason: "speed-zero"`.
4. **Given** Speed 25, **When** `stand` runs, **Then** it costs 12 ft (round down).
5. **Given** no active encounter, **When** `stand` runs, **Then** only `condition.removed`
   lands.
6. **Given** an encounter and it is not the actor's turn, **When** `stand` runs, **Then** the
   engine refuses `MOVE_OFF_TURN`.

### Edge Cases

- A combatant departs while not in the order but placed: only `combatant.placed` (`null`).
- A combatant departs while neither in the order nor placed: refused `INVALID_COMMAND`. The
  session-model mapping never sends it then.
- `combatant.side` to the side it already holds: refused `INVALID_COMMAND`.
- A yielded hostile becomes present again (`arrived`): its side stays `neutral` (OQ-3).
- A combatant with no side never counts as a standing hostile and never opposes anyone. The end
  check needs at least one sided combatant in the order.
- Resume after a party member died: the dead member is not a participant (as today).
- The departing active combatant ends the encounter (no living one left): the reclaim helper
  `activeLeaverFromLog` finds no `encounter.changed` row and returns `null`. This is correct: no
  turn advance is owed.
- Talk-turn escalation (`legalEscalation`) still starts only a `pending` encounter (OQ-5).

## Requirements *(mandatory)*

### Functional Requirements

Engine (`packages/dnd5e-engine`):

- **FR-001**: `CombatantSchema` and `CombatantInit` MUST gain `side?: "party" | "hostile" |
  "neutral"`. `combatant.add` MUST copy it. A missing side MUST stay missing.
- **FR-002**: A `combatant.side` command (`combatantId`, `side`, `reason`) MUST emit one
  `combatant.sided` event (`before`: side or `null`, `after`: side). It MUST refuse
  `UNKNOWN_COMBATANT` and `INVALID_COMMAND` (no change). `evolve` MUST apply it.
- **FR-003**: `areHostile(a, b)` MUST be true only for a `party` and `hostile` pair, either way
  round.
- **FR-004**: `hostilesStanding(state)` MUST return the ids, in order, of `hostile` combatants in
  the encounter order whose `lifeState` is `conscious`. It MUST return `[]` with no encounter.
- **FR-005**: `encounterOver(state)` MUST be true when an encounter is active, at least one
  combatant in its order has a side, and `hostilesStanding` is empty. Otherwise false.
- **FR-006**: `closeCombatFoes(state, attackerId)` MUST return the ids of combatants placed in the
  attacker's zone that are hostile to the attacker (`areHostile`), `conscious`, not unable
  (`isUnable`), and not `blinded`. It MUST return `[]` when the attacker is `invisible`, or when a
  side or a placement is missing. It MUST NOT require an active encounter.
- **FR-007**: A `combatant.depart` command (`combatantId`, `reason`) MUST:
  1. refuse `UNKNOWN_COMBATANT` for an unknown id;
  2. refuse `INVALID_COMMAND` when the combatant is neither in the order nor placed;
  3. when it is in the order, emit the same events `initiative.leave` emits for that state;
  4. when `initiative.leave` would refuse `NO_ELIGIBLE_COMBATANT`, emit the events
     `encounter.end` emits instead (condition and assist cleanup, then `encounter.ended`);
  5. when it is placed, emit `combatant.placed` with `after: null` last.
  It MUST draw no dice. `initiative.leave` MUST keep its behaviour.
- **FR-008**: A `stand` command (`combatantId`, `reason`) MUST refuse `UNKNOWN_COMBATANT` and
  `CONDITION_NOT_PRESENT` (not prone). Inside an encounter it MUST refuse `MOVE_OFF_TURN` off
  turn, `STAT_UNDEFINED` with no speed, and `MOVE_OVER_SPEED` when effective Speed is 0
  (`details.reason: "speed-zero"`) or when `floor(effectiveSpeed / 2)` exceeds `movementLeft`.
  It MUST emit `condition.removed` (cause `command`) for each prone instance, then, inside an
  encounter, `encounter.changed` adding the cost to `movement.usedFt`. Outside an encounter it
  MUST emit only the removal. It MUST draw no dice.
- **FR-009**: The engine MUST export `areHostile`, `hostilesStanding`, `encounterOver`,
  `closeCombatFoes` and the `Side` type.

Session model (`packages/session-model`):

- **FR-010**: The `scene-presence` planner MUST send `combatant.depart` when the new presence is
  `absent` and the combatant is in the order or placed. It replaces today's `initiative.leave`.
- **FR-011**: It MUST send `combatant.side` `neutral` when the new presence is `yielded`
  (`surrendered`, `conceded`) and the combatant's side is `hostile`. It MUST send nothing else for
  a yield.
- **FR-012**: The `arrived` rejoin through `initiative.join` MUST stay unchanged.

Server (`apps/server/src/dm`):

- **FR-013**: Every `combatant.add` resolve writes MUST set a side: seed characters `party`;
  seed-encounter monsters and NPCs that are encounter monsters `hostile`; other pulled NPCs
  `neutral`. `combatantFromSrd` MUST take the side as a parameter.
- **FR-014**: `encounterPhase(projections, encounterSeed)` MUST return `active` when the engine
  order holds one of the encounter's monsters, `ended` when `encounterRan` and not active, and
  `pending` otherwise.
- **FR-015**: `startableEncounterIds(projections, seed)` MUST return each `pending` encounter,
  and each `ended` encounter with at least one eligible monster (FR-016). It replaces
  `runnableEncounterIds` in Director legality and the Director prompt.
- **FR-016**: An eligible monster of an encounter is an encounter monster that is a combatant,
  not `dead`, with logged presence `present` (or none), and side `hostile` or no side. An
  eligible party member is a party combatant that is not `dead` (as today).
- **FR-017**: `directorOpening` MUST roll initiative over eligible party members and eligible
  monsters only. A `pending` start keeps today's order: add the monsters, run the encounter-start
  presence group, then filter. It MUST skip the roll (no `initiative.roll` row) when no monster is
  eligible after the filter.
- **FR-018**: For an `ended` encounter (a resume), `directorOpening` MUST NOT add combatants and
  MUST NOT run the encounter-start seed-presence group. `joiningCombatants` and `arrivingNpcs`
  MUST return `[]` for it, so the plan gate admits no id the resume will not add.
- **FR-019**: The Director prompt MUST mark a resumable encounter `(resume)` in "Encounters you
  may start". The prompt version MUST bump to `dm.director-v12`.
- **FR-020**: After the action and NPC groups, the AI DM's closing group MUST load fresh
  projections. If its local state holds an active encounter and the engine has none (a
  `combatant.depart` ended it), it MUST clear the flag and set free mode. If `encounterOver`
  holds, it MUST run `encounter.end` and set free mode with reason "No foe still stands.". In
  both cases the turn advance group MUST NOT run.
- **FR-021**: Director legality MUST keep, in turn mode, an arrival of a monster of the `active`
  seed encounter that is not yet a combatant. Resolve MUST add it (side `hostile`) and send
  `initiative.join` with mode `normal`. Free-mode arrivals stay as spec 088 defines them.

Planner (`packages/planner`, after TASK-0267 merges):

- **FR-022**: For an `attack` Intent, the planner MUST fold `disadvantage` into the command mode
  when `closeCombatFoes(state, attacker)` is non-empty and the attack is ranged: the entry's
  `range` is `ranged`, or it is `melee-or-ranged` and the target's band is not `engaged`. It MUST
  use the engine's `foldMode`.
- **FR-023**: The planner MUST map the `stand` Intent to the engine `stand` command.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): AI and human seats reach flee, surrender, stand and attack
  through the same presence proposals and Intents. The Director's resume and end use the same
  gate proposals as a human DM's.
- **CR-002** (II. One Intent vocabulary): no new Intent kind. `stand` already exists; this task
  serves its half-speed gap. Flee and surrender stay presence effects.
- **CR-003** (III. Event sourcing): every change lands as a versioned engine event through the
  gate. `combatant.sided` is `v: 1` and public (a side is visible at the table).
- **CR-004** (VI. Engine owns the numbers): the stand cost, the end condition and the
  close-combat hostiles are engine code. The planner only folds an engine verdict into a mode.
  Scripted-dice tests cover `combatant.side`, `combatant.depart` and `stand`.
- **CR-005** (XI. Operator-owned content): rules cite SRD 5.2.1 ids only.

### Key Entities

- **Side**: `party`, `hostile` or `neutral`, held on the engine combatant.
- **Encounter phase**: `pending`, `active`, `ended`, derived per seed encounter by the server
  from the engine order and the ledger. The engine itself holds active or none.
- **Eligible participant**: a combatant that may enter an encounter start or resume (FR-016).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every new engine command has scripted-dice tests. The coverage meta-test passes.
- **SC-002**: Each card acceptance criterion maps to at least one named test (table below).
- **SC-003**: `pnpm ci:check` is green. DB integration suites pass on the worktree stack.
- **SC-004**: Existing engine, session-model and server suites pass. A log with no sides plays as
  before, except that a fled combatant now also leaves its zone.
- **SC-005**: The R1 playtest records "encounter ends: yes, fled dropped: yes" (TASK-0278 row
  R1B-encounter-end). Evidence for the R1 gate, not a merge condition.

## Acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 A fight ended by truce resumes with a fresh turn order when broken | US1; FR-014–FR-019; `apps/server/test/dm/encounter-resume.integration.test.ts`, `apps/server/test/dm/director.test.ts` |
| #2 A fled combatant leaves the order and its zone | US2; FR-007, FR-010, FR-017, FR-020; `packages/dnd5e-engine/test/commands/depart.test.ts`, `packages/session-model/test/gate-plan.test.ts`, `apps/server/test/dm/fled-combatant.integration.test.ts` |
| #3 Joining mid-fight rolls initiative for the newcomer only | US4; FR-021; `packages/dnd5e-engine/test/commands/encounter.test.ts` (existing join tests), `apps/server/test/dm/mid-fight-arrival.integration.test.ts` |
| #4 The planner applies disadvantage to a ranged attack while a hostile is in the attacker's zone | US5; FR-003, FR-006, FR-022; `packages/dnd5e-engine/test/sides.test.ts`, the planner's attack golden test |
| #5 Standing from prone costs half the actor's speed, with an engine test | US6; FR-008; `packages/dnd5e-engine/test/commands/move.test.ts` |
| R1 exit 6 "encounter can end" | US3; FR-004, FR-005, FR-020; `apps/server/test/dm/encounter-auto-end.integration.test.ts` |
| TASK-0253 AC #2 (resume is a new run; setup not re-run) | US1 scenario 2; FR-018 |
| TASK-0254 AC #2 (no NPC turn states both a planned action and no rules effect) | US2 scenario 5; `fled-combatant.integration.test.ts` |

## Assumptions

- TASK-0270 (spec 094) is merged: placements, `movementLeft`, `effectiveSpeed`, bands.
- TASK-0267 (spec 097) merges before this task's planner phase. Its plan names the module that
  maps `attack` and `stand`. Phase 6 edits that module.
- Seed monsters are always foes of the party. The reed-camp, duo and trio seeds hold no allied
  monster. A seed side field is not needed for R1 (OQ-4).

## Open questions

- **OQ-1 — Where the close-combat rule lives.** Card AC #4 says the planner applies it, because
  "the engine knows no sides". This spec gives the engine sides. The planner path has three
  costs: it touches the LI lane's package after 0267 merges; it does not cover `spell.cast`
  (the command carries no mode, so spell attacks keep `normal`); and live AI attacks skip the
  planner until TASK-0269 merges. The engine path is one rule in `attackModeSources` (read
  `closeCombatFoes`) and covers weapons and spells on every path. **Recommend:** the operator
  re-rules AC #4 to "the engine applies". Phase 6 then shrinks to the `stand` mapping, and the
  rule moves into Phase 1 (`derive.ts`, `attacks.ts`, `spells.ts`). Until ruled, this spec
  follows the card. Either way `foldMode` makes a double application harmless.
- **OQ-2 — Does fleeing by presence provoke opportunity attacks?** A `fled` presence effect is a
  narrative exit with no path. **Recommend:** no in this task. A flee the planner maps as a `move`
  to an exit zone provokes through spec 094's `provokers`. Card a revisit task, trigger: an R1
  playtest flee that should have drawn an attack.
- **OQ-3 — A surrendered foe takes up arms again.** Its side stays `neutral` after `arrived`.
  Restoring `hostile` would need a stored prior side. **Recommend:** keep one-way for R1. A human
  DM sends `combatant.side` from the mechanics request. Card a revisit task for the AI path,
  trigger: a playtest where a yielded foe attacks.
- **OQ-4 — Seed-declared sides.** Code assigns sides by seed role (FR-013). An allied monster or
  a hostile non-encounter NPC cannot be expressed. **Recommend:** defer to the codex NPC payload
  (TASK-0056, R2), which already absorbs TASK-0202's starting conditions. No new card.
- **OQ-5 — Talk escalation into a resume.** `legalEscalation` starts only `pending` encounters.
  **Recommend:** keep. A broken truce in talk reaches the Director on the next beat turn. Card
  a revisit task, trigger: a talk-only table that cannot restart a fight.
- **OQ-6 — Party wipe.** The end check ignores a downed party, so death saves keep their turns.
  A total party kill stays a Director or human DM decision. **Recommend:** keep; no card.
