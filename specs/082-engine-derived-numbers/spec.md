# Feature Specification: Engine-derived numbers — modifiers, DCs and AC from combatant stats

**Feature Branch**: `task-0104-engine-derived-numbers`

**Created**: 2026-11-03

**Status**: Draft. Spec only (M3 runbook B, lane B3, spine #13, re-split R3). Builds after TASK-0127
(spec 070) and TASK-0170 (spec 080) merge. The operator ruled OQ-1 to OQ-7 at (a) on 2026-11-02 (see Open questions).
This spec, plan.md and tasks.md are written against each (a). The Phase 0 seam check (T001) ran
against merged specs 070, 080 and 081; `deviations.md` records each moved seam.

**Input**: TASK-0104. "When the DM runtime resolves a check, attack or save, the engine computes the
roll's modifier from the combatant's stats and the DC or AC from the target's stats or an
engine-tabulated DC. The model names the ability, the skill and the target; it never writes the
modifier or the DC."

`speckit-specify` ran as authoring guidance only. The spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, its research
findings (TASK-0115, decision-0022 D14 point 4) and constitution VI settle the behaviour. The open
questions below are scope edges the card leaves open; each has a default.

## Decision records and rules this card implements

- **Constitution VI**: the engine owns every number. A model MUST NOT roll or compute them.
- **TASK-0042 research R8**: the engine owns attack, save and check arithmetic. This card moves the
  modifier, the DC and the condition-driven roll mode from "inputs the adjudicator supplies" to
  "numbers the engine derives". R8's other inputs stay as they are.
- **TASK-0102 operator requirement (2026-10-26)**: rules with definitions are deterministic, and the
  AI does not invent them.
- **Research findings 2026-10-26 (card notes)**: the modifier comes from ability, proficiency and
  skill data. The model picks an SRD 5.2.1 difficulty tier (SRD p.6, record
  `playing-the-game.d20-tests.ability-checks.difficulty-class`): Very Easy 5, Easy 10, Medium 15,
  Hard 20, Very Hard 25, Nearly Impossible 30. Advantage and disadvantage come from conditions where
  the SRD defines them, plus a model-stated circumstance with a reason.

## Order with neighbouring cards (re-split R3)

1. **TASK-0208 (spec 079, merged in #117)** added the `move` step and the engine opportunity
   attack. Its `apps/server/src/dm/reactions.ts` converts the reactor's SRD melee action into a
   to-hit expression and damage. This card moves that conversion into the combatant's engine stats.
   The reaction then reads the same stats as a model attack. One path serves both.
2. **TASK-0127 (spec 070)** lands first. Its D1 step contract adds `stakes`, `onCost`, `onSevere`
   and `newRisk` to the check step. Its engine computes `margin = total − DC` and the band. This
   card supplies that DC from the model's difficulty tier; the band rule is unchanged.
3. **TASK-0170 (spec 080)** lands first. It makes `stakes.success` required, adds `reveals`, and
   carries the applied outcome as fact. Merged 0170 left `expression`, `mode`, `dc` and the attack
   step alone (T001, `deviations.md`).
4. **TASK-0104 (this card)** removes every model-written number from check and attack steps.
5. **Later consumers**: TASK-0105 (spells) reads the caster's spell attack bonus and spell save DC
   from the functions this card exports. TASK-0128 adds an opposition DC derived from the opponent's
   stats beside the tier. TASK-0058 (m-4) later replaces the seed as the PC stats source.

### The check step after specs 070 and 080 (the shape this card starts from)

```
{ step: "check", reason, combatantId: id|null, kind: "ability-check"|"saving-throw",
  ability, skill: skill|null, expression: str, mode: roll mode, dc: int,
  autoFail: {reason}|null, onSuccess: [effect], onFailure: [effect],
  stakes: {success: str, cost: str|null, failure: str, severe: str|null},
  reveals: clue ref|null, onCost: [effect], onSevere: [effect], newRisk: str|null }
```

`stakes.success` is required (spec 080). An ability check needs `cost` and `severe`
(`requireAbilityStakes`, spec 070). Spec 081's `say` is a reading field, not a step field.

The attack step is unchanged by 070, 080, 081 and 0208:
`{ step: "attack", reason, attackerId: id|null, targetId, expression, mode, targetAc: int|null, onHit: [effect] }`.

### What this card removes and adds

| Step | Removed (model-written numbers) | Added |
|---|---|---|
| `check` | `expression` (the modifier), `dc`, `mode` | `difficulty` (a tier), `circumstance` (`{mode, reason}` or null) |
| `attack` | `expression` (the to-hit), `targetAc`, `mode`, damage effects in `onHit`, a null `attackerId` | `attack` (an attack name from the attacker's stats), `circumstance` |

Every spec 070 and 080 field stays, `reveals` included.

## Background: what happens today

1. Interpret writes `"expression":"1d20+3"` and `"dc":12` on each check, and an expression and an
   optional `targetAc` on each attack (`apps/server/src/dm/nodes/schemas.ts`). The step grammar
   says "The expression carries the modifier you choose".
2. The engine parses the expression and compares it against the DC or AC it is handed. An engine
   combatant holds no ability scores, proficiency or skills; only `ac`, `initiativeBonus` and
   `conModifier`.
3. The seed already holds each PC's ability modifiers, proficiency bonus, save and skill totals and
   attacks. The SRD monster records hold the same for monsters. Neither reaches the engine.
4. The engine never derives advantage or disadvantage from a condition. A poisoned goblin attacks
   normally unless the model remembers to write `disadvantage`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A check's modifier and DC come from stats and a tier (Priority: P1)

Tamsin tries to force a stuck shutter. Interpret names her, Strength, Athletics and the tier
"medium". The engine rolls 1d20+5 from her sheet (Strength +3, Athletics proficiency +2) against DC
15. No number in the plan came from the model.

**Why this priority**: card AC #1 and #2, the card's outcome.

**Independent Test**: engine scripted-dice tests over a combatant with stats; a resolve integration
test whose interpret script holds a check with `difficulty`, where the ledger's dice row shows the
derived expression.

**Acceptance Scenarios**:

1. **Given** Tamsin's stats (Str +3, Athletics total +5), **When** the engine resolves a Strength
   (Athletics) check at tier `medium`, **Then** it rolls `1d20+5` against DC 15.
2. **Given** Odo's stats (Dex +0, no Stealth total), **When** the engine resolves a Dexterity
   (Stealth) check, **Then** it rolls `1d20`: the ability modifier (0) with no proficiency. A zero
   modifier renders no `+0` term.
3. **Given** Tamsin (Str save total +5), **When** the engine resolves a Strength saving throw,
   **Then** it rolls `1d20+5`. **Given** her Wisdom save (no total listed, Wis +1), **Then** it
   rolls `1d20+1`.
4. **Given** a check that pairs Athletics with Constitution, **When** the engine derives it,
   **Then** the modifier is the Constitution modifier plus the Athletics proficiency part.
5. **Given** interpret returns a check step with `dc` or `expression`, **When** the reading is
   parsed, **Then** the strict schema rejects it.
6. **Given** a check at tier `hard` with spec 070's bands on, **When** it resolves at total 18,
   **Then** the engine records DC 20, margin −2 and band `success-at-cost`.

---

### User Story 2 - An attack's to-hit, damage and AC come from stats (Priority: P1)

Kestrel looses an arrow at Snag. Interpret names her, the Shortbow and Snag. The engine rolls
1d20+5 from her Shortbow entry against Snag's AC 15 from the SRD record. On a hit, resolve applies
1d6+3 piercing from the same entry. The model wrote no number.

**Why this priority**: card AC #1 and #3.

**Independent Test**: engine tests over `attack.roll` with an attack name; a resolve integration
test for a hit and a miss; spec 079's reaction tests still green on the shared path.

**Acceptance Scenarios**:

1. **Given** Kestrel's Shortbow entry (to-hit +5, 1d6+3 piercing) and Snag (AC 15), **When** resolve
   runs an attack step naming `Shortbow`, **Then** the engine rolls `1d20+5` against AC 15 with AC
   source `record`.
2. **Given** that attack hits, **When** resolve continues, **Then** it applies `1d6+3` piercing to
   Snag from the entry before any `onHit` effect. A critical hit doubles the dice.
3. **Given** an attack step with `targetAc`, `expression` or a damage effect in `onHit`, **When**
   the reading is parsed, **Then** the schema rejects it.
4. **Given** a goblin's opportunity attack (spec 079), **When** resolve runs it, **Then** it reads
   the goblin's first melee entry from the same stats and rolls the numbers spec 079 rolls today.

---

### User Story 3 - A step naming something the stats do not define is refused (Priority: P1)

Interpret writes an attack with Tamsin's "Warhammer", which her sheet does not list. The plan gate
refuses the group before any die is rolled, and the turn records why.

**Why this priority**: card AC #4.

**Independent Test**: schema tests, plan-gate unit tests and engine refusal tests, one per case.

**Acceptance Scenarios**:

1. **Given** a check naming an ability or skill outside the SRD lists, **When** it is parsed,
   **Then** the schema rejects it (closed enums, as today).
2. **Given** an attack step with `attackerId: null`, **When** it is parsed, **Then** the schema
   rejects it.
3. **Given** a check or attack naming a combatant the engine does not hold, **When** the plan gate
   runs, **Then** it refuses with `UNKNOWN_COMBATANT` (as today).
4. **Given** an attack naming an attack the attacker's stats do not list, **When** the plan gate
   runs, **Then** it refuses the group with `STAT_UNDEFINED` before any step runs.
5. **Given** a check of an ability the combatant's stats do not define, or a combatant with no
   stats, **When** the plan gate runs, **Then** it refuses with `STAT_UNDEFINED`.
6. **Given** the same commands sent to the engine directly, **When** it executes them, **Then** it
   refuses with `STAT_UNDEFINED` before any die is drawn.

---

### User Story 4 - Advantage and disadvantage follow SRD conditions (Priority: P2)

A goblin is poisoned. It attacks Tamsin, who is prone. The engine rolls with disadvantage
(poisoned attacker) and with advantage (melee against a prone target). The two cancel, so the roll
is normal. The model stated neither.

**Why this priority**: the research finding on advantage; card AC #5 asks for derivation tests.

**Independent Test**: engine scripted-dice tests per condition rule and for cancellation.

**Acceptance Scenarios**:

1. **Given** a poisoned or frightened checker, **When** the engine resolves an ability check,
   **Then** the roll has disadvantage.
2. **Given** a restrained combatant, **When** the engine resolves a Dexterity saving throw, **Then**
   the roll has disadvantage.
3. **Given** an attacker that is blinded, frightened, poisoned, prone or restrained, **When** it
   attacks, **Then** the roll has disadvantage. **Given** an invisible attacker, **Then** advantage.
4. **Given** a target that is blinded, paralyzed, petrified, restrained, stunned or unconscious,
   **When** it is attacked, **Then** the roll has advantage. **Given** an invisible target, **Then**
   disadvantage.
5. **Given** a prone target, **When** a melee entry attacks it, **Then** advantage. **When** a
   ranged entry does, **Then** disadvantage.
6. **Given** a combatant with exhaustion level 2, **When** it makes any derived d20 test, **Then**
   the modifier drops by 4.
7. **Given** one source of advantage and one of disadvantage, **When** the engine folds them,
   **Then** the roll is normal (SRD "they don't stack").
8. **Given** a step with `circumstance: {mode: "advantage", reason}`, **When** it resolves, **Then**
   the circumstance counts as one source, and the plan gate claim-checks its reason.

---

### User Story 5 - Existing scripts and the scripted CI playtest stay green (Priority: P2)

Every shipped DM script, test script and playtest fixture is rewritten to the new step shapes.
Each roll keeps its outcome and band, so every existing test and the scripted playtest pass.

**Why this priority**: card AC #5.

**Independent Test**: the full `pnpm ci:check`, including `dm-scripts.test.ts` and the playtest
harness integration test.

**Acceptance Scenarios**:

1. **Given** a script check with `"expression":"1d20+4","dc":12`, **When** it is migrated, **Then**
   it carries a tier and no expression or DC, and its scripted die still gives the same outcome and
   band.
2. **Given** `downed-seat.json` drops Tamsin with a fixed 13 damage in `onHit`, **When** it is
   migrated, **Then** derived damage drops her instead (a scripted critical hit).

---

### Edge Cases

- **Scene check** (`combatantId: null`): the engine rolls a flat `1d20` with no modifier and no
  condition sources. The tier still sets the DC.
- **Auto-fail and auto-success** (spec 070): no die is rolled; the event still records the DC from
  the tier.
- **Explicit numbers from code**: `check.roll` still accepts `expression` and `dc`, and
  `attack.roll` still accepts `expression` and `targetAc`. Only code sends them: session-model
  recipes, recorded proposals and later cards (0105 spell DCs, 0128 opposition DCs). No model step
  field reaches them. The engine never folds condition modes into an explicit-expression roll, so
  recorded commands resolve exactly as before.
- **Pending human-DM proposals** from before this card carry explicit commands. They approve and
  resolve unchanged.
- **Paused plans** from before this card hold old-shape steps. Resume drops a reading whose steps
  fail the new step schema, and that action is interpreted again (OQ-5).
- **Combatants added before this card** have no stats. A derived check or attack on them is refused
  with `STAT_UNDEFINED` (OQ-4).
- **A skill with another ability**: the modifier is that ability's modifier plus the skill's
  proficiency part (the skill total minus the skill's default ability modifier).
- **Monster skills**: SRD records name skills in title case ("Sleight of Hand"). Code maps them to
  the engine's kebab-case keys. Totals are stored as written, so two SRD monsters whose Stealth
  bonus is not a proficiency multiple (giant-frog, shambling-mound) still derive their listed total.
- **Monster attack riders**: an SRD damage part with a `condition` (for example "if the attack roll
  had Advantage") is skipped, as spec 079 does today.
- **`melee-or-ranged` entries** (a thrown dagger) count as melee for the prone rule (OQ-6).
- **Frightened** applies its disadvantage with no line-of-sight test: the engine has no positions
  (OQ-6). **Grappled**'s attack disadvantage needs the grappler's id, which no record holds; it is
  not derived.
- **Joining combatants**: a combatant the Director's opening adds this turn is not in S0. The plan
  gate skips its stats check; the engine still checks it at roll time.
- **Attack names**: matched case-insensitively against the attacker's entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An engine combatant MUST carry optional `stats`: ability modifiers (any subset of the
  six), proficiency bonus, save totals, skill totals, attack entries (name, range, to-hit, damage
  components) and spellcasting ability (or null). `combatant.add` MUST accept and copy them.
- **FR-002**: The engine MUST derive a check modifier as the ability modifier plus the skill's
  proficiency part, and a save modifier as the save total (the ability modifier when no total is
  listed). Each drops by 2 per exhaustion level.
- **FR-003**: `check.roll` MUST accept `difficulty` (`very-easy`, `easy`, `medium`, `hard`,
  `very-hard` or `nearly-impossible`) and map it to DC 5, 10, 15, 20, 25 or 30. It MUST be refused
  with `INVALID_COMMAND` unless exactly one of `difficulty` and `dc` is set.
- **FR-004**: `check.roll` MUST treat `expression` as optional. With no expression, the engine MUST
  roll `1d20±modifier` derived per FR-002 (plain `1d20` at modifier 0), or a flat `1d20` when
  `combatantId` is null.
- **FR-005**: `attack.roll` MUST accept `attack` (an attack name) and treat `expression` as
  optional. It MUST be refused with `INVALID_COMMAND` unless exactly one is set. With `attack`, the
  engine MUST roll `1d20±(to-hit − 2 × exhaustion level)` from the named entry.
- **FR-006**: With no explicit expression, the engine MUST fold the command's `mode` with the
  condition sources of User Story 4 by the SRD no-stack rule.
- **FR-007**: The engine MUST refuse a derived roll with a new code `STAT_UNDEFINED`, before any
  draw, when its combatant has no stats, its ability has no modifier, or its attack name is not in
  the attacker's entries.
- **FR-008**: `check.resolved` MUST carry an optional `difficulty`. `attack.resolved` MUST carry an
  optional `attack` name. Old rows parse.
- **FR-009**: The engine MUST export pure functions for each derivation: check modifier, save
  modifier, attack lookup, roll mode, the tier table, and the caster's spell save DC (8 +
  spellcasting ability modifier + proficiency bonus) and spell attack bonus (spellcasting ability
  modifier + proficiency bonus) for TASK-0105.
- **FR-010**: The DM runtime MUST set `stats` on every combatant it adds: PCs from the seed
  character's `identity` (spellcasting ability from the SRD class record), and monsters and
  pulled-in NPCs from their SRD monster record.
- **FR-011**: The seed loader MUST refuse a seed with an attack expression not of the form
  `1d20±N`, an attack whose name is no SRD weapon, or an `identity.combatant` that carries `stats`.
- **FR-012**: The opportunity attack (spec 079) MUST read the reactor's first melee entry from its
  engine stats and submit `attack.roll` with that `attack` name. Its damage MUST come from the same
  entry.
- **FR-013**: The `check` step MUST be a strict object that drops `expression`, `dc` and `mode` and
  carries `difficulty` and `circumstance` (`{mode: "advantage"|"disadvantage", reason}` or null).
- **FR-014**: The `attack` step MUST be a strict object that drops `expression`, `targetAc` and
  `mode`, carries `attack` (1–60 characters) and `circumstance`, and requires a non-null
  `attackerId`. A damage effect in `onHit` MUST be refused. `onHit` MAY be empty.
- **FR-015**: Resolve MUST submit checks with `difficulty` and no expression or DC, and attacks with
  `attack`, no expression and `targetAc: null`.
- **FR-016**: On a hit or critical hit, resolve MUST apply the attack entry's damage to the target
  (a critical hit doubles the dice) before the step's `onHit` effects.
- **FR-017**: The plan gate MUST refuse a group with `STAT_UNDEFINED` before any step runs when a
  check or attack names a combatant whose engine stats cannot derive it. It MUST use the engine's
  exported functions. It MUST claim-check each `circumstance.reason` like a step reason.
- **FR-018**: The step grammar and the interpret and adjudicate prompts MUST render the new step
  shapes and the tier list from the engine enum. They MUST state the rule: the engine derives every
  modifier, DC and AC; name the ability, skill, tier and attack only.
- **FR-019**: Every shipped DM script, test script and playtest fixture MUST use the new step
  shapes, with each roll's outcome and band unchanged.

### Acceptance criteria mapping (card TASK-0104)

| Card AC | Requirements | Proving test |
|---|---|---|
| #1 no model-written modifier on check, save and attack steps; the engine derives it | FR-001, FR-002, FR-004, FR-005, FR-010, FR-013–FR-015 | engine `derive.test.ts`, `attacks.test.ts`; `interpret.test.ts`; `resolve.integration.test.ts` |
| #2 DC from a tabulated tier or a target stat; the model picks a tier | FR-003, FR-009, FR-013 | engine `derive.test.ts`, `attacks.test.ts`; `interpret.test.ts` |
| #3 attack uses the target's AC from its stats; no model-written `targetAc` | FR-014, FR-015 | `interpret.test.ts`; engine `attacks.test.ts` (AC source `record`); `resolve.integration.test.ts` |
| #4 an undefined combatant, ability, skill or attack is rejected at the schema or engine gate, with a test | FR-007, FR-011, FR-014, FR-017 | `interpret.test.ts`, `plan-gate.test.ts`, engine `attacks.test.ts`, `seed.test.ts` |
| #5 scripted-dice engine tests per derivation; dm tests and the scripted CI playtest green | FR-006, FR-012, FR-016, FR-019 | engine tests; `reactions.test.ts`; `pnpm ci:check` incl. `dm-scripts.test.ts`, `harness.integration.test.ts` |

### Key Entities

- **Combatant stats**: the derivation inputs on an engine combatant. Code sets them once at
  `combatant.add`; every derived roll reads them.
- **Attack entry**: name, range (`melee`, `ranged` or `melee-or-ranged`), to-hit and damage
  components. PC entries come from the seed sheet; monster entries come from SRD actions.
- **Difficulty tier**: the SRD 5.2.1 Typical Difficulty Classes row the model picks.
- **Circumstance**: one model-stated advantage or disadvantage source, with a reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero check or attack steps that reach resolve carry a modifier, a DC or an AC.
- **SC-002**: Every derived roll in the scripted runs shows a dice expression whose modifier equals
  the actor's sheet value, verified by test for each of the three seed PCs and both goblin kinds.
- **SC-003**: Each of the four undefined cases (combatant, ability, skill, attack) has a refusing
  test.
- **SC-004**: Each condition rule of User Story 4 has one engine test, plus one for cancellation.
- **SC-005**: `pnpm ci:check` is green with every migrated script and fixture.

## Open questions (operator)

- **OQ-1 — Attack damage.** (a) Damage comes from the attack entry; `onHit` refuses damage effects.
  Class features with extra damage (Kestrel's Sneak Attack) stop applying until sheets carry them
  (TASK-0058). (b) Keep model-written damage in `onHit`; derive only the to-hit. **Resolved (a),
  operator 2026-11-02**: "I'm okay with stats-only as long as the rule for Sneak Attack is
  something that's going to come later. I don't want to miss it, and I think there's a better time
  to handle it (when we handle other abilities, maybe) but I do not want to lose it either".
  Sneak Attack is carded as TASK-0225 (m-4, after TASK-0058). Each playtest scenario carries a
  standing S-sneak-attack row (`docs/design/playtest-scenarios.md`) until TASK-0225 is Done.
- **OQ-2 — Condition auto-fail and auto-crit.** SRD paralyzed, petrified, stunned and unconscious
  make Strength and Dexterity saves fail, and a melee hit on a paralyzed or unconscious target is a
  critical hit. (a) Out of scope here; card a follow-up (it changes R8's "the engine does not
  derive automatic failure"). (b) Include now. **Resolved (a), carded as TASK-0222.**
- **OQ-3 — Other model-written dice.** The `roll` step's expression, and the `Amount` of damage and
  heal effects in effect steps and check effect lists, stay model-written. (a) Out of scope; card a
  follow-up for environmental damage and healing amounts (spell amounts are TASK-0105). (b) Include.
  **Resolved (a), carded as TASK-0223.**
- **OQ-4 — Sessions started before this card.** Their combatants have no stats. (a) Refuse with
  `STAT_UNDEFINED`; the operator starts a new scene. (b) Add a `combatant.stats` backfill command.
  **Resolved (a), default accepted**: hosted dev sessions are short-lived.
- **OQ-5 — Paused plans from before this card.** (a) Resume drops a reading that fails the new step
  schema; the action is interpreted again, and an already approved roll stays on the ledger. (b) A
  legacy-step branch in resolve. **Resolved (a), default accepted**: it only bites across one
  deploy.
- **OQ-6 — Proxies without positions.** (a) Frightened applies with no line-of-sight test; prone uses
  the entry's range as the 5-foot proxy (`melee-or-ranged` counts as melee); grappled is not
  derived. (b) Derive none of the position-dependent rules. **Resolved (a), default accepted**,
  each proxy marked `ponytail:` in code.
- **OQ-7 — Saves a monster feature calls.** An SRD monster feature can name its own save DC (for
  example a breath weapon). (a) The model still picks the tier nearest the narrated effect; card a
  follow-up that reads feature DCs from the record (beside TASK-0105's spell DCs). (b) Add a
  `feature` field to the check step now. **Resolved (a), carded as TASK-0224**: no shipped seed
  monster has a save feature.

## Assumptions

- TASK-0127 (spec 070), TASK-0170 (spec 080) and TASK-0207 (spec 081) have merged. Main is at
  interpret-v10 and adjudicate-v7; this card bumps them to v11 and v8. If another card bumps
  either first, the build goes one past `main` and records it in `deviations.md`.
- The seed's `identity` stats are operator-authored sheet data, not model output. TASK-0058 later
  moves the source to the codex PC entity; only the stats builder changes then.
- No migration: stats ride the existing `combatant.added` JSON payload; new event fields are
  optional.
- Every shipped seed attack is an SRD weapon by name (Longsword, Light crossbow, Mace, Shortbow,
  Shortsword; `getByName` matches case-insensitively), and every shipped encounter monster has an SRD attack action.
