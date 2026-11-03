# Feature Specification: Opposition as a derived DC, and Help as advantage

**Feature Branch**: `task-0128-opposition-and-help`

**Created**: 2026-11-03

**Status**: Draft. Spec only (M3 runbook B, lane B3, spine #15). Builds on merged TASK-0104
(spec 082, PR #123). The open questions below carry defaults; the operator rules them at the
next checkpoint. This spec, plan.md and tasks.md are written against each default.

**Input**: TASK-0128. "Opposed efforts and assistance resolve by SRD 5.2.1 rules in the engine,
not by model-chosen numbers. SRD 5.2.1 states opposition as a check against a DC derived from the
opponent (for example the grapple escape DC, 8 + Strength modifier + proficiency bonus) and
defines the Help action as advantage on an ally's next check."

`speckit-specify` ran as authoring guidance only. The spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, the
research note `docs/research/Resolution-and-Outcome/Contests-Group-Checks-and-Help.md`, its
analysis (decision-0022 D14 point 5) and the SRD records settle the behaviour. The open questions
are scope edges the card leaves open; each has a default.

## Decision records and rules this card implements

- **Constitution VI**: the engine owns every number. A model MUST NOT roll or compute a DC.
- **Decision-0022 (D14) point 5**: "opposition becomes an engine-derived DC and Help becomes an
  advantage source. Group checks, which have no SRD rule, wait behind an operator flag."
- **TASK-0102 operator requirement (2026-10-26)**: rules with definitions are deterministic, and
  the AI does not invent them.
- **Spec 082 (merged)**: combatants carry `stats`; `derive.ts` derives modifiers and roll modes;
  a check names a `difficulty` tier and a `circumstance`; `STAT_UNDEFINED` refuses an underivable
  step. Spec 082 named this card as the place an opposition DC joins the tier.
- **Spec 077 (merged, TASK-0205)**: `askUndeclared` turns a roll for another human's PC into a
  clarify. This card applies the same rule to the Help step's helper.

## SRD 5.2.1 sources this card reads

| Rule | SRD record or page | What the engine derives |
|---|---|---|
| Unarmed Strike grapple and shove | Rules Glossary, Unarmed Strike (p. 190); Grappling (p. 182) | Save DC and escape DC = 8 + the grappler's Strength modifier + proficiency bonus |
| Influence action | `rules-glossary.influence-action` (p. 184) | Default DC = 15 or the monster's Intelligence score, whichever is higher |
| Help action | `rules-glossary.help-action` (p. 182–183) | Advantage on the ally's next check with the helper's chosen skill, or on the next ally attack against a distracted enemy; ends before the start of the helper's next turn |

Cases the SRD states that this card does not derive, each with an owner:

- **Finding a hider.** The hider's Stealth total is the DC to find it (Hide action). It needs
  tracked hidden state: TASK-0217.
- **A spell's save DC.** 8 + spellcasting modifier + proficiency bonus is exported by spec 082;
  TASK-0105 uses it.
- **A monster feature's own DC**, including a stat block's "escape DC N": TASK-0224 (OQ-2).
- **A contest (roll against roll).** It is a 2014 DMG rule, not SRD 5.2.1. Not built.
- **Group checks.** SRD 5.2.1 has no group-check rule (OQ-5).

## Background: what happens today

- An opposed effort is a check at a model-picked difficulty tier. Escaping Snag's grip is
  "Athletics, `medium`" (DC 15) whatever Snag's Strength is. Persuading Wenna is a tier the model
  picks, not the SRD's Influence DC.
- Help has no mechanic. Interpret's `intent` enum already lists `help`, and the fallback says
  "lends a hand" for a planned help intent, but no step grants anything. A model can only write a
  `circumstance` advantage with a reason, which is model-chosen and not consumed.
- `seed.tableRules.groupChecks` exists (spec 070, default `false`). Nothing reads it. Its schema
  comment says "read by nothing until TASK-0128".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An opposed check's DC comes from the opponent's stats (Priority: P1)

Snag has Tamsin grappled. Tamsin's player writes "I wrench free of his grip." Interpret plans a
Strength (Athletics) check for Tamsin whose difficulty names Snag as the opponent with the
`unarmed-strike` rule. The engine reads Snag's stats (Strength −1, proficiency +2) and sets
DC 9. No DC in the plan came from the model.

**Why this priority**: card AC #1, the card's outcome.

**Independent Test**: engine scripted-dice tests over two combatants with stats; a resolve
integration test whose interpret reading holds the opposed check.

**Acceptance Scenarios**:

1. **Given** Snag's stats (Str −1, PB 2), **When** the engine resolves Tamsin's Athletics check
   opposed by Snag with `unarmed-strike`, **Then** the DC is 9 and `check.resolved` records it
   with the opponent and the rule.
2. **Given** Tamsin's stats (Str +3, PB 2), **When** the engine resolves a goblin's Dexterity save
   against Tamsin's shove (`unarmed-strike`, opponent Tamsin), **Then** the DC is 13.
3. **Given** a commoner's stats (Int score 10), **When** the engine resolves Odo's Persuasion
   check opposed by the commoner with `influence`, **Then** the DC is 15. **Given** an aboleth
   (Int 18), **Then** the DC is 18.
4. **Given** an opponent with no stats, or a PC with no Intelligence score for `influence`,
   **When** the engine resolves the check, **Then** it refuses `STAT_UNDEFINED` before any draw.
5. **Given** an `unarmed-strike` opposition on a Wisdom (Insight) check, **When** the engine
   resolves it, **Then** it refuses `INVALID_COMMAND`: the rule does not cover that check.
6. **Given** spec 070's bands on, **When** an opposed check misses its derived DC by 1, **Then**
   the band is `success-at-cost`, exactly as for a tier DC.

---

### User Story 2 - Help grants advantage on the ally's next matching check (Priority: P1)

Kestrel's player writes "I spot Tamsin as she balances across the slick timbers." Interpret plans
a Help step: helper Kestrel, ally Tamsin, skill Acrobatics. Kestrel's sheet lists Acrobatics, so
the engine records an assist on Tamsin. Tamsin's next Acrobatics check rolls with advantage and
uses the assist up. Had interpret named Athletics, which Kestrel's sheet does not list, the engine
would refuse the Help with `NOT_PROFICIENT`.

**Why this priority**: card AC #2.

**Independent Test**: engine scripted-dice tests for `help.grant`, consumption and expiry; a
resolve integration test over two action groups in one beat.

**Acceptance Scenarios**:

1. **Given** Kestrel proficient in Acrobatics, **When** the engine runs `help.grant` (ability
   check, ally Tamsin, skill Acrobatics), **Then** Tamsin carries one assist by Kestrel.
2. **Given** that assist, **When** Tamsin's next Acrobatics check rolls, **Then** it rolls with
   advantage (two d20s, the higher kept) and the assist ends with cause `used`.
3. **Given** that assist, **When** Tamsin makes an Athletics check or a saving throw, **Then** it
   rolls without the assist's advantage and the assist stays.
4. **Given** an assist and a model `circumstance` of disadvantage on the same check, **When** it
   rolls, **Then** the two cancel (spec 082's no-stack rule) and the assist is still used.
5. **Given** an encounter with Kestrel in the order, **When** the turn reaches the start of
   Kestrel's next turn with the assist unused, **Then** the assist ends with cause `expired`.
6. **Given** Kestrel distracts goblin-2 (Help on an attack), **When** Tamsin next attacks
   goblin-2, **Then** the attack rolls with advantage and the assist ends. **When** Kestrel
   herself attacks goblin-2, **Then** the assist does not apply.
7. **Given** Kestrel lacks the chosen skill, **When** `help.grant` runs, **Then** the engine
   refuses `NOT_PROFICIENT` before writing anything.
8. **Given** Kestrel already has an open assist, **When** she Helps again, **Then** the old assist
   ends with cause `replaced` and the new one is recorded (one action at a time).

---

### User Story 3 - Interpret emits opposition and Help in the step grammar (Priority: P1)

Interpret and adjudicate write an opposed check as a check whose `difficulty` names the opponent
and the rule, and write Help as a `help` step. The schemas parse both. The plan gate checks
their ids, their stats and their actors.

**Why this priority**: card AC #3.

**Independent Test**: `interpret.test.ts` schema cases for both shapes; `plan-gate.test.ts` cases
for the helper rules; the prompt snapshot.

**Acceptance Scenarios**:

1. **Given** a check step with `difficulty: {"opposedBy":"snag","rule":"unarmed-strike"}`, **When**
   the reading parses, **Then** it passes. **Given** `opposedBy` equal to the check's
   `combatantId`, **Then** the parse fails at `difficulty.opposedBy`.
2. **Given** a `help` step with an ability-check assist (ally and skill) or an attack assist
   (target), **When** the reading parses, **Then** it passes. **Given** an ally equal to the
   helper, **Then** the parse fails.
3. **Given** Tamsin's player's action holds a Help step whose helper is Kestrel (another human's
   PC), **When** `askUndeclared` runs, **Then** the action becomes the other-player clarify, as
   spec 077 does for a check or an attack.
4. **Given** Kestrel's own action holds a Help step that names Tamsin as the ally, **When**
   `askUndeclared` runs, **Then** it passes: receiving advantage is not an act by Tamsin.
5. **Given** a Help step whose helper is not the action's actor, **When** the plan gate runs,
   **Then** it refuses `STEP_ACTOR_MISMATCH`, as spec 079 does for an attacker.
6. **Given** an opposed check whose opponent has no stats, **When** the plan gate runs, **Then**
   it refuses `STAT_UNDEFINED` before any step runs.

---

### User Story 4 - Narration knows a Help happened (Priority: P3)

A Help action rolls nothing. Today the facts for it hold no roll and no change, so the fallback
says "goes ahead with it". The facts gain an assist change, so narrate and the fallback name it.

**Why this priority**: OQ-4 default (a). Not a card AC; it keeps prose grounded in facts.

**Independent Test**: `facts.test.ts` and `fallback.test.ts` over an `assist.granted` row.

**Acceptance Scenarios**:

1. **Given** an `assist.granted` ledger row, **When** facts are built, **Then** they hold an
   `assist` change naming the helper, the holder and the kind.
2. **Given** that change, **When** the fallback renders, **Then** it says "Kestrel lends Tamsin a
   hand." (ability check) or "Kestrel distracts the goblin." (attack), with no digits.

---

### Edge Cases

- **Opponent joining this turn or pulled in.** The plan gate skips the stat check for a joining
  id, as spec 082 does. A non-combatant NPC named as `opposedBy` is pulled in before the step
  runs (spec 068), so it has SRD stats (default `commoner`) when the engine derives the DC.
- **Opponent dead.** The engine refuses `TARGET_DEAD`. An opposition from a dead creature is not
  an opposition.
- **Influence and attitude.** The SRD's attitude (indifferent, friendly, hostile) changes the
  check. Attitude is not tracked. The model states it as a `circumstance` with a reason.
- **Grapple save ability.** The SRD lets the grapple or shove target choose Strength or
  Dexterity. The step names the ability. For a monster target, interpret picks it.
- **Help with no roll.** An auto-fail or a free retry (spec 070) draws no die and does not consume
  an assist. Advantage only matters to a roll.
- **Explicit-expression checks.** A `check.roll` with an explicit `expression` (session-model
  fixtures, a human DM) neither folds nor consumes an assist, as spec 082 does for conditions.
- **Two helpers.** Two assists on one check give advantage once (no stacking). The check consumes
  both: each was "the next check".
- **Helper leaves the order.** Its turn never starts, so its assist lasts until used or until the
  encounter ends.
- **Help committed after the check it meant to aid.** Action groups resolve in commit order
  (OQ-6). The assist then applies to the ally's next matching check.
- **First aid.** SRD Help can administer first aid. Stabilizing stays a Wisdom (Medicine) check at
  tier `easy` (DC 10); it is not a `help` step.
- **Tool proficiencies.** Seeds and SRD stats carry none. A Help naming a tool is not expressible.

## Requirements *(mandatory)*

### Functional Requirements

**Opposition (card AC #1)**

- **FR-001**: The engine MUST define the opposition rules `unarmed-strike` (8 + the
  opponent's Strength modifier + proficiency bonus) and `influence` (the higher of 15 and the
  opponent's Intelligence score), each citing its SRD record.
- **FR-002**: The engine MUST define which checks each rule covers. `unarmed-strike` covers a
  Strength (Athletics) or Dexterity (Acrobatics) ability check and a Strength or Dexterity saving
  throw. `influence` covers a Charisma (Deception, Intimidation, Performance or Persuasion) or
  Wisdom (Animal Handling) ability check.
- **FR-003**: `check.roll` MUST accept an `opposition` (opponent id and rule). It MUST be
  refused with `INVALID_COMMAND` unless exactly one of `dc`, `difficulty` and `opposition` is set,
  when the opponent equals the checker, or when the rule does not cover the check (FR-002).
- **FR-004**: With `opposition`, the engine MUST refuse `UNKNOWN_COMBATANT` or `TARGET_DEAD` for
  the opponent as for any named id, and `STAT_UNDEFINED` when the opponent's stats cannot derive
  the DC. Every refusal happens before any draw.
- **FR-005**: `check.resolved` MUST carry an optional `opposition` beside its `dc`. Old rows parse.
- **FR-006**: Engine stats MUST carry optional ability scores. The SRD stats builder MUST fill all
  six from the monster record. The seed sheet carries no scores, so a PC has none.

**Help (card AC #2)**

- **FR-007**: The engine MUST accept a `help.grant` command with a helper and one assist: an
  ability-check assist (ally id and skill) or an attack assist (target id).
- **FR-008**: `help.grant` MUST be refused before any write: `ACTOR_UNABLE` for an unable helper;
  `UNKNOWN_COMBATANT` or `TARGET_DEAD` for a named id; `INVALID_COMMAND` when the ally or target is
  the helper; `STAT_UNDEFINED` when an ability-check helper has no stats; `NOT_PROFICIENT` (a new
  code) when the helper's skill totals do not list the chosen skill.
- **FR-009**: `help.grant` MUST record the assist on its holder (the ally for an ability check, the
  enemy for an attack) with the helper and its expiry. In an encounter with the helper in the
  order, the expiry is the start of the helper's next turn. Otherwise the expiry is null.
- **FR-010**: A helper MUST hold at most one open assist. A new grant MUST end the old one with
  cause `replaced`.
- **FR-011**: A derived ability check MUST roll with an advantage source when its checker holds an
  ability-check assist for its skill. A derived attack MUST roll with an advantage source when its
  target holds an attack assist from a helper other than the attacker. A spell attack roll
  (`spell.cast`, spec 083) is an attack roll and follows the same rule. Each source folds with the
  others by the SRD no-stack rule. (Amended at the seam check: deviations S1.)
- **FR-012**: A roll that applied an assist MUST end it with cause `used`. A check or attack with
  no draw MUST NOT end it.
- **FR-013**: An assist MUST end with cause `expired` at its expiry boundary, through the same
  turn-boundary rule that ends conditions, and with cause `encounter-ended` when the encounter
  ends.
- **FR-014**: The engine MUST add the events `assist.granted` and `assist.ended`. The projection
  fold MUST apply both. Old states parse with no assists.

**Step contract, gates and resolve (card AC #3)**

- **FR-015**: The check step's `difficulty` MUST accept a tier or an opposition object
  `{opposedBy, rule}`. The reading refinement MUST refuse an `opposedBy` equal to the check's
  `combatantId`, and a rule that does not cover the check (FR-002).
- **FR-016**: The step union MUST gain a `help` step: `reason`, `helperId`, and an `assist` that is
  `{kind: "ability-check", allyId, skill}` or `{kind: "attack", targetId}`. The refinement MUST
  refuse an ally or target equal to the helper.
- **FR-017**: Resolve MUST submit an opposed check as `check.roll` with `opposition` and no tier,
  and a Help step as `help.grant`. Every other check field stays as merged.
- **FR-018**: The plan gate MUST check every id a Help step or an opposition names, as for any
  step id. It MUST refuse `STEP_ACTOR_MISMATCH` when a Help step's helper is not the action's
  actor. It MUST refuse `STAT_UNDEFINED` when an opposition's opponent cannot derive the DC or an
  ability-check helper lacks stats. It MUST add a Help step's `reason` to the reason check.
- **FR-019**: `askUndeclared`'s other-player rule MUST treat a Help step's `helperId` as it treats
  an attack's `attackerId`. It MUST NOT test the ally or the target.
- **FR-020**: The step grammar MUST show both shapes and state when to use them. The prompt
  versions MUST move from interpret-v12 to interpret-v13 and from adjudicate-v9 to adjudicate-v10.

**Narration facts (OQ-4 default (a))**

- **FR-021**: Facts MUST turn an `assist.granted` row into an `assist` change. Narrate MUST list
  it in the facts it shows, and the fallback MUST voice it in one digit-free sentence. The narrate
  prompt version MUST move from narrate-v16 to narrate-v17 and audit from audit-v10 to audit-v11:
  both rendered prompts change.

**Group checks (OQ-5 default (a))**

- **FR-022**: This card MUST NOT read `tableRules.groupChecks`. Its schema comment MUST say the
  flag has no behaviour and name the follow-up card TASK-0232.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): opposition and Help MUST be reachable through the same
  `mechanics` proposal a human DM and the AI DM use. `help.grant` is a plain engine command.
- **CR-004** (VI. 5e engine boundary): every opposition DC and every assist advantage MUST be
  computed in the engine and covered by scripted-dice tests. No model writes a DC or a roll mode
  for either.
- **CR-005** (VIII. Operator-owned content): code comments cite SRD 5.2.1 record ids and pages.
  No book text ships.

### Acceptance criteria mapping (card TASK-0128)

| Card AC | Requirements | Proving test |
|---|---|---|
| #1 the engine derives an opposition DC from the opponent's stats for each SRD-defined case, with tests | FR-001–FR-006 | engine `derive.test.ts`, `commands/attacks.test.ts`; `seed-stats.test.ts` |
| #2 a Help action grants advantage on the ally's next matching check and expires per SRD 5.2.1, with a test | FR-007–FR-014 | engine `commands/help.test.ts`, `commands/attacks.test.ts`, `commands/encounter.test.ts`; `opposition-and-help.integration.test.ts` |
| #3 interpret emits opposition and help as step kinds, and a schema test covers both | FR-015–FR-020 | `interpret.test.ts`, `plan-gate.test.ts`, `interpret-prompt.test.ts` |

**AC #3 wording.** The card says "step kinds". Under OQ-1 default (a), Help is a new step kind and
opposition is a check whose `difficulty` names the opponent. The schema test covers both shapes.
OQ-1 (b) makes opposition its own step kind instead.

### Key Entities

- **Opposition**: the opponent's combatant id and a rule name. It replaces the tier on one
  check.
- **Opposition rule**: an SRD rule that turns an opponent's stats into a DC, with the checks it covers.
- **Assist**: one Help benefit on its holder: the helper, the kind (ability check with a skill, or
  attack), and the expiry point.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For both rules, every engine test DC equals the SRD formula over the
  opponent's stats. No model-written number reaches an opposed check.
- **SC-002**: An assist applies to exactly one roll: the next matching one. Tests cover use,
  non-matching checks, expiry at the helper's turn start, replacement and encounter end.
- **SC-003**: Both new step shapes parse, and each invalid variant named in User Story 3 fails at
  the named path.
- **SC-004**: The scripted CI playtest and every shipped DM script stay green unchanged: a tier
  `difficulty` string still parses.

## Open questions (operator)

- **OQ-1 — Opposition shape.** (a) A check whose `difficulty` is a tier or `{opposedBy, rule}`. One
  check step keeps stakes, bands, reveals, free retries and every gate rule. Help is the new step
  kind. (b) A new `opposed` step kind that copies the check's fields. Every check consumer
  (`first-stage.ts`, `stakes.ts`, `askUndeclared`, `stepIds`, `stepTexts`, `plannedDiff`,
  `presenceTargets`, `effectsForBand`) then needs a second case. **Default (a).**
- **OQ-2 — Monster stat-block escape DCs.** 38 SRD monster attacks state "escape DC N"; 21 differ
  from 8 + Strength + PB (for example the aboleth's 14 against a formula 17). (a) This card uses
  the formula for every opponent. The stat-block escape DC joins TASK-0224 (monster feature DCs
  from the stat block): the orchestrator adds it to that card. No shipped seed monster grapples.
  (b) Parse "escape DC N" into the attack entry now. **Default (a).**
- **OQ-3 — Help outside an encounter.** Out of combat there are no turns, so the SRD expiry never
  arrives. (a) The assist lasts until used, until its helper Helps again, or until an encounter
  ends. (b) Resolve ends every unused assist at the end of the beat that granted it (a new
  `help.end` command). **Default (a).**
- **OQ-4 — Help in the narration facts.** (a) Add an `assist` fact (User Story 4): `facts.ts`,
  `prompts/narrate.ts` (one fact line; next version), `fallback.ts`. This adds `fallback.ts` to the runbook's
  fallback sequence, before 0214. (b) No fact; the narrator reads the action text and the fallback
  says "goes ahead with it". **Default (a).**
- **OQ-5 — Group checks.** SRD 5.2.1 has no group-check rule. `tableRules.groupChecks` exists,
  defaults off and is read by nothing. Spec 070 said this card would add its behaviour. (a) This
  card leaves the flag unread. The orchestrator cards "group checks behind
  `tableRules.groupChecks`" (a house rule: the group succeeds when at least half succeed), and the
  seed schema comment points to this OQ. (b) Build it here. **Default (a).**
- **OQ-6 — Help and the check in one beat.** (a) Action groups keep commit order. A Help committed
  after the check it meant to aid applies to the ally's next matching check. (b) Resolve runs
  every group holding a Help step before the other action groups. **Default (a).**

## Assumptions

- TASK-0104 (spec 082) is merged: combatant `stats`, `derive.ts`, `difficulty`, `circumstance`,
  `STAT_UNDEFINED`.
- TASK-0105 (spec 083), TASK-0211, TASK-0171 and TASK-0204 are merged. The seam check recorded
  every moved seam in [deviations.md](deviations.md). Versions on `main`: `dm.interpret-v12`,
  `dm.adjudicate-v9`, `dm.narrate-v16`, `dm.audit-v10`.
- The operator accepted defaults (a) for OQ-1 to OQ-6. OQ-2 is noted on TASK-0224. OQ-5 is
  carded as TASK-0232.
- "Proficient in a skill" is "the stats list a total for that skill". Seed sheets and SRD stat
  blocks list only proficient skills.
- The engine has no factions and no positions. "One of your allies" is any attacker other than
  the helper, and "within 5 feet" is not checked. Both are marked `ponytail:` in code.
- No migration: new state and event fields are optional JSON; the two new event types join the
  mechanics catalog through the engine schema.
