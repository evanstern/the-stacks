# Feature Specification: Deterministic planner

**Feature Branch**: `task-0267-planner`

**Created**: 2026-11-09

**Status**: Draft

**Input**: TASK-0267 (N-02): "Create `packages/planner` with `plan(state, space, intent)` returning
commands, a refusal, or a ruling request. Port the deterministic half of `dm/nodes/resolve.ts` and
`dm/gates/plan-gate.ts`. Cover checks, saves, contests, attacks, the six engine spells, dash, dodge,
disengage, help, hide, move and resource kinds."

**Grounding**: constitution 3.0.0 (I, II, III, VI, VII, IX; Architecture Constraints "Package
seams"); `docs/design/replan-2026-11/target-architecture.md` §2 "Planner contract" and §6;
decision-0030 (Intent contract v1, v1.1 amendment; Q3 "the AI DM uses difficulty tiers", Q4
`KIND_UNSERVED`); the frozen contract `specs/092-intent-contract/contracts/intent-schema.md`;
`packages/intent`, `packages/space` and `packages/dnd5e-engine` at `origin/main` 5dfbe655;
`apps/server/src/dm/gates/plan-gate.ts` and `apps/server/src/dm/nodes/resolve.ts` (the code this
card ports); `docs/design/actor-state-gate.md` §3.2 formulation 3 and §5 cards U5 (TASK-0145) and
U9 (TASK-0147); runbook `docs/design/r1-fast-table-runbook.md` (lane LI, merge spine row 8, CP-5
ruling F1).

**Clarify**: `speckit-clarify` skipped. The sources settle the contract. The remaining judgment
calls are recorded as open questions with recommendations at the end of this spec.

**CP-5 ruling F1**: card AC #4 ("`resolve.ts` loses the ported code paths") moved to TASK-0269.
This card ships the pure package with golden tests only. No file under `apps/` changes.

## Scope

In scope:

- A new pure package `@the-stacks/planner`. Its runtime dependencies are `@the-stacks/intent`,
  `@the-stacks/space`, `@the-stacks/dnd5e-engine` and `zod`.
- `plan(state, space, intent)` for all 57 Intent kinds: commands, a refusal, or a ruling request.
- The `PlanState`, `PlanFact`, `RulingRequest`, `PlannedCommand` and `PlanRefusal` types and their
  Zod schemas (`contracts/planner.md`).
- The ruling loop: a `ruling` or `set_dc` Intent answers an open request, and the planner plans
  the original Intent again.
- Golden tests per served kind, per planner refusal code and per ruling ask.
- The TASK-0145 and TASK-0147 legality rules that have an Intent kind, as planner tests.
- A boundary lint override and violation fixtures for the new package.
- One engine export line: `isUnable` (the able-actor predicate the engine already uses).

Out of scope (owned elsewhere):

- Calling the planner, executing commands, appending events, storing ruling requests: TASK-0268.
- Building `PlanState` from projections and the seed: TASK-0268.
- Interpret emitting Intents; `resolve.ts` and `plan-gate.ts` losing ported paths: TASK-0269.
- Seat, turn, policy and held-companion checks (`NOT_YOUR_ACTOR`, `NOT_YOUR_TURN`,
  `TURN_HELD`): the gate, TASK-0268.
- Per-viewer placements and the `seen` flag's real source: TASK-0271.
- Ranged attack disadvantage with a hostile in the attacker's zone: TASK-0274 AC #4.
- Stand-up movement cost: TASK-0274 AC #5. Engine-derived amounts: TASK-0223.
- Reactions offered to players and roll requests (`react`, `roll`, `request_roll`): TASK-0276.
- The fact sheet and prose slots: TASK-0245, TASK-0272.
- A CI latency gate on plan time: TASK-0300.

## Served kinds

| Class | Kinds | `plan()` returns |
|---|---|---|
| Served (28) | `check`, `save`, `contest`, `search`, `hide`, `attack`, `cast`, `help`, `grapple`, `shove`, `move`, `dash`, `disengage`, `stand`, `drop_prone`, `end_turn`, `rest_short`, `rest_long`, `roll_free`, `apply_damage`, `apply_heal`, `apply_condition`, `start_combat`, `end_combat`, `add_combatant`, `move_token`, `ruling`, `set_dc` | commands or a refusal; `check`, `save`, `contest` and `search` with no DC source return a ruling request |
| Ruling only (2) | `attempt`, `use_object` | a ruling request with ask `outcome` |
| Unserved (12) | `dodge`, `ready`, `react`, `delay`, `use_item`, `give`, `equip`, `drop`, `concentration_drop`, `roll`, `level_choice`, `request_roll` | refusal `KIND_UNSERVED`; details name the owning card |
| Not planned (15) | `say`, `say_to`, `emote`, `ask_dm`, `ooc`, `party`, `whisper`, `narrate`, `npc_say`, `reveal`, `pause`, `bookmark`, `recap`, `retry_narration`, `predeclare` | refusal `KIND_UNSERVED`, details `{ owner: "gate" }`; the gate never calls `plan()` for these |

Partial service inside served kinds: `shove` with `effect: "push"`, `move` and `move_token` with
square targets refuse `KIND_UNSERVED`. `cast` with a zone, a point or more than one target refuses
`SPELL_UNRESOLVED`. `hide` rolls the SRD check but tracks no hidden state (fact `unserved`,
TASK-0271).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A confirmed combat Intent becomes engine commands with no model (Priority: P1)

A player confirms `/attack @goblin-2 weapon="Longsword"`. The gate passes the Intent to `plan()`.
The planner returns an `attack.roll` and the guarded damage commands. No model is called.

**Why this priority**: TASK-0268 AC #1 needs it. Constitution II requires a deterministic planner.

**Independent Test**: a vitest test builds a `PlanState` fixture and calls `plan()`. No server.

**Acceptance Scenarios**:

1. **Given** Thorin engaged with goblin-2 and a `Longsword` attack entry, **When** Thorin attacks
   goblin-2, **Then** the result is `commands`: `attack.roll`, then `damage.apply` guarded on `hit`
   (critical false), then `damage.apply` guarded on `critical-hit` (critical true).
2. **Given** goblin-2 is in a `near` zone, **When** Thorin attacks with a melee entry, **Then** the
   result is refusal `OUT_OF_REACH` (source `planner`) and no command.
3. **Given** a `move` that leaves a conscious hostile's zone, **When** Thorin moves, **Then** the
   commands are the hostile's reaction `attack.roll`, its guarded damage, then `move`.
4. **Given** the same Intent and state twice, **When** both are planned, **Then** the results are
   deep-equal.

---

### User Story 2 - A check with no DC asks for a ruling, and the ruling replans it (Priority: P1)

A player sends `/check athletics` to climb a wall. No DC exists. The planner returns a ruling
request. The AI DM answers with a `ruling` Intent carrying a difficulty tier. The planner plans the
check again with that tier.

**Why this priority**: TASK-0268 AC #2 routes `needs_ruling`. decision-0030 Q3 binds the AI DM to
tiers.

**Independent Test**: plan the check, put the request into `state.openRequests`, plan the ruling.

**Acceptance Scenarios**:

1. **Given** a `check` with no `dc` or `difficulty`, **When** planned, **Then** the result is
   `needs_ruling` with ask `difficulty`, the roll it will make, and `requestId` equal to the
   check's Intent id.
2. **Given** that request is open, **When** a `ruling` accepts it with difficulty `hard`, **Then**
   the result is `commands` with one `check.roll` carrying difficulty `hard`, and a `ruling` fact.
3. **Given** an `attempt` ("I grab the clapper"), **When** planned, **Then** the result is
   `needs_ruling` with ask `outcome`. **When** a ruling accepts it, **Then** the result is
   `commands` with no command and a `no-roll` fact (TASK-0147 AC #3).
4. **Given** no open request with that id, **When** a `ruling` is planned, **Then** the result is
   refusal `REQUEST_NOT_OPEN`.

---

### User Story 3 - Legality: no change to another actor without dice or an SRD rule (Priority: P1)

The AI DM may not harm a party character or end a fight by fiat. Every command a player Intent
plans that changes another actor follows a roll against that actor or an SRD rule.

**Why this priority**: card AC #3; decision-0025 formulation 3.

**Independent Test**: the legality suite replays the evidence sequences as Intents.

**Acceptance Scenarios**:

1. **Given** goblin Snag standing and present (run 183818Z seq 260-265), **When** `ai:dm` sends
   `end_combat`, **Then** the result is refusal `DM_SEAT_REQUIRED`. **Given** Snag `yielded`,
   **Then** the result is `encounter.end`.
2. **Given** M2 seq 296-301, **When** `ai:dm` sends `apply_condition frightened` on a party
   character, **Then** the result is refusal `DM_SEAT_REQUIRED`. **When** Kestrel sends
   `/contest intimidation @goblin-2`, **Then** the result is a `check.roll` with an `influence`
   opposition against goblin-2.
3. **Given** every served player-seat fixture, **When** planned, **Then** each command whose target
   is not the actor's combatant is a roll naming that target, is guarded on such a roll, or is an
   SRD beneficial rule (`help.grant` to an ally, a healing spell, `condition.remove`).
4. **Given** an Intent planned twice with different `text`, **Then** the results are deep-equal.

### Edge Cases

- An actor id not in `state.actors`, or an absent actor: `UNKNOWN_COMBATANT` (engine source).
- A target not in `state.actors`, or absent: `TARGET_NOT_PRESENT`. A target with `seen: false`:
  `TARGET_UNSEEN`.
- A target NPC with no combatant but an init in `state.inits`: `combatant.add` (and
  `initiative.join` in an encounter) precede the action (spec 068/075 pull-in). With no init:
  `TARGET_NOT_PRESENT`.
- An actor who is unconscious, stable, dead or incapacitated: `ACTOR_UNABLE` (engine source).
- No space, or either side unplaced: reach and range checks are skipped (spec 094 behaviour).
- A `ruling` whose `amend` body is an `attempt`: a new ruling request; `requestId` is the ruling's
  Intent id.
- `end_turn` outside an encounter: the engine refusal `NO_ACTIVE_ENCOUNTER` passes through when
  the gate executes. The planner does not pre-check it.

## Requirements *(mandatory)*

### Functional Requirements

**Package and purity**

- **FR-001**: `@the-stacks/planner` MUST export `plan(state, space, intent): PlanResult` per
  `contracts/planner.md`.
- **FR-002**: The package MUST import only `@the-stacks/intent`, `@the-stacks/space`,
  `@the-stacks/dnd5e-engine`, `zod` and relative paths. A Biome override MUST forbid apps,
  `session-model`, `srd`, `shared`, model SDKs, database and network packages, `node:*`, and the
  globals `Date`, `performance`, timers, `fetch`, `process`, `crypto`, `require` (card AC #1).
- **FR-003**: `plan()` MUST be deterministic. It MUST NOT read `Math.random` or a clock. It MUST
  NOT read `intent.text` for any decision.
- **FR-004**: Every command's `reason` MUST be the Intent's text form without its body
  (`toText({ ...intent, text: undefined })`), cut to 500 characters.

**Results**

- **FR-005**: A `commands` result MUST list `PlannedCommand`s in execution order. A guarded command
  names an earlier step and the outcomes that run it.
- **FR-006**: `stepOutcome(events)` MUST return the outcome of one executed command: the
  `attack.resolved` outcome, else the `check.resolved` band, else its outcome, else `null`.
- **FR-007**: A refusal MUST carry `source: "planner"` with an `IntentRefusalCode`, or
  `source: "engine"` with an engine `RefusalCode` (contract §9 pass-through).
- **FR-008**: A `needs_ruling` result MUST carry one `RulingRequest` whose `requestId` is the id of
  the Intent being planned.

**References and able actors (ported from plan-gate `checkPlan`)**

- **FR-009**: The planner MUST resolve the actor and every actor target through `state.actors`.
- **FR-010**: It MUST refuse an unknown or absent actor `UNKNOWN_COMBATANT` (engine source), and
  an unable actor (`isUnable`, or dead) `ACTOR_UNABLE` (engine source), before any command.
- **FR-011**: It MUST refuse an unknown or absent target `TARGET_NOT_PRESENT`, and an unseen target
  `TARGET_UNSEEN`.
- **FR-012**: It MUST pull in a target NPC with no combatant from `state.inits` (see Edge Cases).

**Checks (`check`, `save`, `contest`, `search`, `hide`)**

- **FR-013**: A `check` or `save` from an `npc` actor (a DM seat) with `difficulty` or `dc` MUST
  plan one `check.roll` with that DC source.
- **FR-014**: A `check` or `save` from a `pc` or `companion` actor MUST ignore its `dc` and
  `difficulty` (fact `ignored`) and return a ruling request with ask `difficulty` (OQ-4). So MUST
  an `npc` check with neither field.
- **FR-015**: A `contest` MUST plan a `check.roll` with `opposition { opponentId, rule }` when an
  engine rule covers the actor's check (`oppositionCovers`; `influence` is tried before
  `unarmed-strike`). Otherwise it MUST return ask `difficulty` with `opposition.rules: []`.
- **FR-016**: `search` MUST return ask `difficulty` with the Wisdom (Perception) or Intelligence
  (Investigation) roll (`rules-glossary.search-action`).
- **FR-017**: `hide` MUST plan a Dexterity (Stealth) `check.roll` at difficulty `medium` (DC 15,
  SRD 5.2.1 Hide action), a `rule` fact, and an `unserved` fact for hidden state (TASK-0271).
- **FR-018**: Every `check.roll` MUST carry `houseRules` from `state.tableRules` and the Intent's
  `mode`. A missing modifier (`checkModifier`) MUST refuse `STAT_UNDEFINED` (engine source) before
  any command.

**Combat (`attack`, `cast`, `help`, `grapple`, `shove`)**

- **FR-019**: `attack` MUST find the entry by name (`findAttack`; `"unarmed"` looks up
  `Unarmed Strike`), else refuse `STAT_UNDEFINED`. With both sides placed, a melee use out of reach
  MUST refuse `OUT_OF_REACH`, and a ranged use out of range `OUT_OF_RANGE` (both planner source).
  It plans `attack.roll`, then two guarded `damage.apply` from the entry's damage: one on `hit`,
  one on `critical-hit` with `critical: true`.
- **FR-020**: `cast` MUST port `spellGap`. Not in `state.srdSpellIds`: `SPELL_UNKNOWN`. Not in the
  caster's list: `SPELL_NOT_PREPARED`. No engine mechanics, a bad slot, or a target other than one
  actor or none (none means self): `SPELL_UNRESOLVED`. No spellcasting modifier, or no target save
  modifier: `STAT_UNDEFINED`. It plans one `spell.cast` with the caster's level.
- **FR-021**: `help` MUST plan `help.grant`. An `attack` assist MUST target a creature in the
  helper's engaged band or refuse `OUT_OF_REACH`. A `check` assist MUST refuse `STAT_UNDEFINED`
  when the helper has no stats.
- **FR-022**: `grapple` MUST plan the target's Strength or Dexterity saving throw (the higher
  modifier; Strength on a tie) with `opposition { opponentId: <actor combatant>, rule:
  "unarmed-strike" }`, then `condition.apply grappled` guarded on `failure` and `severe-failure`.
- **FR-023**: `shove` with `effect: "prone"` MUST plan the same save, then `condition.apply prone`
  guarded the same way.
- **FR-024**: `shove` with `effect: "push"` MUST refuse `KIND_UNSERVED` (details
  `{ param: "effect", owner: "TASK-0274" }`).

**Movement and turn**

- **FR-025**: `move` to one zone MUST refuse `NO_MOVEMENT_LEFT` when `movementLeft` is 0. It MUST
  probe the `move` command with `execute` and a scripted RNG that holds no dice; an engine refusal
  passes through before reactions are planned.
- **FR-026**: `move` MUST plan, before the `move`, one reaction `attack.roll` (`reaction: true`,
  `firstMeleeAttack`) and its guarded damage for each id `provokers()` returns whose actor side is
  `hostile`, when the mover's side is `party` (OQ-11).
- **FR-027**: `dash` and `disengage` MUST plan `movement.action`. `stand` MUST plan
  `condition.remove prone`. `drop_prone` MUST plan `condition.apply prone`. `end_turn` MUST plan
  `turn.advance`.
- **FR-028**: `rest_short` MUST plan `rest.short` for the actor with its `spend`. `rest_long` MUST
  plan `rest.long` for the actor. `roll_free` MUST plan `roll`.

**DM control**

- **FR-029**: `apply_damage`, `apply_heal` (`temp: true` plans `temp-hp.grant`) and
  `apply_condition` (`add`, `remove`; `exhaustion` plans `exhaustion.adjust` ±1) MUST plan one
  command per target.
- **FR-030**: `start_combat` MUST plan `initiative.roll` for its targets. With no targets, it MUST
  plan it for every present combatant whose side is `party` or `hostile`. `end_combat` MUST plan
  `encounter.end`.
- **FR-031**: `add_combatant` MUST plan `combatant.add` `count` times from `state.inits[from]`
  (unknown `from`: `TARGET_NOT_PRESENT`), each with id `<from-slug>-<n>` (first free n), then
  `combatant.place` for a zone target, then `initiative.join` in an encounter. `move_token` to a
  zone MUST plan `combatant.place`. Square targets refuse `KIND_UNSERVED`.
- **FR-032**: An `ai:dm` actor MUST be refused `DM_SEAT_REQUIRED` for `apply_damage`,
  `apply_condition` `add` or `move_token` on a `party` actor, and for `end_combat` while
  `hostilesStanding(state)` is true (TASK-0145 #1, TASK-0147 #1). A `dm` actor is never refused so.

**Rulings**

- **FR-033**: `attempt` and `use_object` MUST return ask `outcome`.
- **FR-034**: `ruling` MUST look up `state.openRequests[requestId]`; a missing id refuses
  `REQUEST_NOT_OPEN`. `reject` returns `commands` with none and a `ruling` fact. `accept` plans the
  stored Intent with the ruling's `difficulty` or `dc`; an ask `outcome` request returns no command
  and a `no-roll` fact. `amend` plans the stored Intent with its kind, targets, params and text
  replaced by the body.
- **FR-035**: `set_dc` MUST act as `accept` with its `dc` or `difficulty` on
  `state.openRequests[for]`.
- **FR-036**: A replan that still needs a ruling MUST return a new request whose `requestId` is the
  `ruling` or `set_dc` Intent's id.

**Exports for downstream cards**

- **FR-037**: The package MUST export `plan`, `stepOutcome`, `hostilesStanding`, `PLAN_KINDS`
  (kind to class and owning card), and the types and Zod schemas in `contracts/planner.md`. It
  MUST export nothing else.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM and companions drive every served kind with the same
  Intents a human sends. Either DM seat answers a ruling request with a `ruling` Intent.
- **CR-002** (II. One Intent vocabulary): The planner MUST NOT call a model. Only `needs_ruling`
  reaches a DM. No surface imports the planner; the gate (TASK-0268) is its only caller.
- **CR-004** (VI. Engine owns the numbers): The planner writes no die result, DC number, damage
  amount or AC. DCs come from tiers, opposition rules or a human DM's `dc`. Damage comes from
  attack entries and the engine spell table.
- **CR-005** (VII. Narration around facts): Every `PlanFact` is code-chosen data with no model
  text, so a "why" row renders from code (IX: every ruling shows a "why").
- **CR-007** (IX. UX quality bar): `plan()` is in-memory and synchronous. It adds well under 5 ms
  to the < 1 s p95 fact-row budget. TASK-0300 owns the CI latency gate.

### Key Entities

- **PlanState**: the read model the gate builds per call: engine state, actors with side, presence
  and `seen`, casters, SRD spell ids, combatant inits, open ruling requests, table rules.
- **PlannedCommand**: an engine command plus an optional guard on an earlier step's outcome.
- **PlanFact**: a code-chosen justification row: rule cited, DC source, pull-in, reaction, ruling,
  no-roll, ignored field, unserved part.
- **RulingRequest**: what a DM must decide: the ask (`difficulty` or `outcome`), the roll, the
  opposition, the stakes and the rule cited, plus the Intent to plan again.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every served kind has at least one golden `commands` test. Every kind in the
  "Unserved" and "Not planned" rows has a `KIND_UNSERVED` test (card AC #2).
- **SC-002**: Every code in `contracts/planner.md` "Refusals raised" appears in a golden test. A
  coverage test fails when one is missing (card AC #2).
- **SC-003**: Both ruling asks and the `ruling` (accept, reject, amend) and `set_dc` paths have
  golden tests (card AC #2).
- **SC-004**: The legality suite passes: TASK-0145 #1 and TASK-0147 #1–#4 as planner tests over the
  cited evidence sequences, plus the formulation-3 invariant over every player-seat fixture
  (card AC #3).
- **SC-005**: `pnpm check:boundaries` flags each planner violation fixture, and `pnpm ci:check` is
  green (card AC #1).
- **SC-006**: Planning every valid fixture in `@the-stacks/intent/fixtures` twice gives deep-equal
  results, and changing `text` changes nothing.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 No model call, no I/O (boundary lint) | FR-002, FR-003, SC-005; phase 1 |
| #2 Golden tests per kind, refusal code, ruling request | SC-001–SC-003; phases 2–4 |
| #3 TASK-0145 / TASK-0147 legality as planner tests | FR-032, FR-034, SC-004; phase 5 |
| #4 (moved to TASK-0269 by CP-5 F1) | not in this card |

## Assumptions

- `PlanState` replaces `SessionProjections` in the signature (OQ-1). The gate builds it.
- `space` is `spaceViewOf(state.engine)` until TASK-0271 supplies a per-viewer view.
- The caller knows each actor's side (`party`, `hostile`, `neutral`) from the seed and the roster.
- The engine stays the final authority. `execute` can still refuse a planned command.

## Open questions

Each has a recommendation. The orchestrator rules or cards each one.

- **OQ-1 — `PlanState` instead of `SessionProjections`.** Target-architecture §2 types the state as
  `SessionProjections`. TASK-0268 puts the gate in `session-model`, which will import the planner,
  so the planner cannot import `session-model` without a cycle. **Recommend:** the narrow
  `PlanState` read model in this package; TASK-0268 builds it. The wiki phase records the delta.
- **OQ-2 — Action economy.** The engine tracks reactions and movement but no Action or Bonus Action
  use. `NO_ACTION_LEFT` and `NO_BONUS_ACTION_LEFT` cannot be raised, and TASK-0275 AC #1 (pips
  drain) needs them. **Recommend:** card "engine action economy" in lane LE, before TASK-0275. The
  planner raises both codes in that card.
- **OQ-3 — Dodge.** The card lists `dodge`, but the engine has no dodging state (contract: gap →
  N-09), and TASK-0274's ACs do not add one. **Recommend:** fold Dodge into the OQ-2 card. Until
  then `dodge` refuses `KIND_UNSERVED`.
- **OQ-4 — A player-written DC.** The contract lets any seat put `dc` or `difficulty` on `check`
  and `save`. A player choosing their own DC defeats the ruling. **Recommend:** ignore it for `pc`
  and `companion` actors (fact `ignored`) and ask for a ruling; honour it for `npc` actors.
- **OQ-5 — Stakes and the free retry.** Resolve's per-band effects (spec 070) and the free retry
  (`autoSuccess`) read model-written stakes. No Intent field carries stakes, and TASK-0269 deletes
  the resolve paths. **Recommend:** add an AC to TASK-0269: keep band effects and the free retry
  beside the Intent until a card puts stakes on Intents (a contract minor under C-CON).
- **OQ-6 — TASK-0145 and TASK-0147 rules with no Intent kind.** TASK-0145 #2 (tracker and scene end
  cite a fact), #3 (prompts) and #4 (log a refused Director move), and TASK-0147 #5 (a refused
  batch writes nothing) are Director, prompt or gate rules. **Recommend:** AC #3 counts TASK-0145 #1
  and TASK-0147 #1–#4. After TASK-0268 merges, close TASK-0147 as absorbed and trim TASK-0145 to
  #2–#4.
- **OQ-7 — A refusal after the first command.** In a `move`, a reaction attack can drop the mover,
  and the engine then refuses `move` (`ACTOR_UNABLE`). **Recommend:** the gate stops at the first
  refused command and keeps the events before it; a refused first command refuses the Intent.
  TASK-0268 implements this; `contracts/planner.md` states it.
- **OQ-8 — `DM_SEAT_REQUIRED` for AI-DM fiat.** No reserved code names "no harm by fiat".
  **Recommend:** reuse `DM_SEAT_REQUIRED` (the human DM seat may; the AI DM seat may not). The
  alternative is a new code, a contract minor under C-CON.
- **OQ-9 — Spell range.** The engine spell table has no range, so `cast` checks no band.
  **Recommend:** a `ponytail:` comment; add range with TASK-0227 (area spells).
- **OQ-10 — Fact naming with spec 098.** TASK-0245's fact sheet reads settled engine events (F4).
  **Recommend:** spec 098 names its row type `FactRow`, never `Fact` or `PlanFact`. TASK-0268 stores
  `PlanFact`s on the Intent outcome carrier event. TASK-0272 renders them as "why" rows.
- **OQ-11 — Who reacts on a move.** Resolve lets only AI-run hostiles strike a party mover.
  **Recommend:** keep that port. TASK-0276 (N-11) offers reactions to players.
- **OQ-12 — Unarmed strikes.** No combatant carries an `Unarmed Strike` entry, so
  `weapon: "unarmed"` refuses `STAT_UNDEFINED`. The SRD derives it (1 + Strength modifier,
  bludgeoning). **Recommend:** add the derived entry in TASK-0223 (engine-derived amounts).

## Operator rulings (2026-11-09)

- OQ-1, OQ-6, OQ-7, OQ-9, OQ-10, OQ-11: adopted as recommended (orchestrator; technical seams).
- OQ-2, OQ-3: action economy and Dodge are carded as TASK-0304 (engine, before TASK-0275). Until it merges, `dodge` refuses KIND_UNSERVED.
- OQ-4: a `dc` or `difficulty` from a pc or companion actor is ignored (fact `ignored`) and the planner asks for a ruling; an npc actor's value is honoured.
- OQ-5: band effects and the free retry stay beside the Intent path; AC added to TASK-0269.
- OQ-8: AI-DM harm by fiat refuses DM_SEAT_REQUIRED. No new code.
- OQ-12: unarmed strikes are derived in TASK-0223 (AC added).
- Spec 099 OQ-1 (cross-spec): the close-combat ranged-disadvantage rule moves to the ENGINE (TASK-0274). The planner does not fold it; it reports the engine's result as a fact.
