# Contract: engine commands

`EngineCommandSchema` is a `z.discriminatedUnion("type", [...])` of the 22 commands below.
Every command carries `reason: z.string().min(1).max(500)` — the ledger reason copied onto
every event it produces (decision-0021 idea 2). Commands carry no actor; the gate knows who
asked.

Shared fragments:

```ts
const Reason = z.string().min(1).max(500);
const Id = CombatantIdSchema;
const RollMode = z.enum(["normal", "advantage", "disadvantage"]).default("normal");
const Amount = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), value: z.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal("roll"), expression: z.string().min(1).max(200) }),
]);
const SlotLevel = z.number().int().min(1).max(9);
const DamageType = DamageTypeSchema;   // engine-api.md: the 13 SRD 5.2.1 damage types
const DefenseSet = DefenseSetSchema;   // engine-api.md: { resistances, vulnerabilities, immunities }
```

**Who decides what (orchestrator ruling 2026-10-25, research R8).** Adjudication (an LLM node)
decides which rule applies and hands the engine *data*: an attack expression, an AC, a DC, a
damage type, a defense set, a roll mode, a condition record. The engine does every piece of
arithmetic and every comparison: hit or miss, success or failure, critical doubling,
resistance, vulnerability and immunity. No command accepts a computed outcome or a final
adjusted amount.

"Common refusals" below means the two every command can return: `INVALID_COMMAND` (schema
parse failure) and `INVALID_STATE` (state parse failure). Each table lists only the further
codes. Codes are defined in [refusals.md](refusals.md); events in [events.md](events.md).

## Dice

| Command | Fields | Events (in order) | Refusals |
|---|---|---|---|
| `roll` | `expression`, `mode: RollMode`, `reason` | `dice.rolled` | `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE` |

A free-standing roll for any number with no target to compare against (a random table, a
recharge roll). Attacks use `attack.roll`; checks and saves use `check.roll`. It changes no
state. Advantage and disadvantage require exactly one dice term with `count 1`, `sides 20`,
no keep and a positive sign (a "plain d20 term"); the engine rolls it twice and keeps one.

## Attacks, checks and saves

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `attack.roll` | `attackerId: Id \| null`, `targetId`, `expression` (e.g. `"1d20+5"`), `mode: RollMode`, `targetAc: int 1..40 \| null = null`, `reaction?: boolean` (Amended by spec 079 (TASK-0208): spends the attacker's Reaction), `reason` | `dice.rolled` (purpose `attack`), `attack.resolved` | `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `D20_TERM_REQUIRED`, `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `TARGET_AC_UNKNOWN`, and with `reaction: true`: `NO_ACTIVE_ENCOUNTER`, `INVALID_COMMAND` (null attacker), `UNKNOWN_COMBATANT` (`details.reason: "not-in-order"`), `REACTION_SPENT`; emits `encounter.changed` after `attack.resolved` |
| `check.roll` | `combatantId: Id \| null`, `kind: "ability-check" \| "saving-throw"`, `ability: "str" \| "dex" \| "con" \| "int" \| "wis" \| "cha"`, `skill: string \| null = null`, `expression` (e.g. `"1d20+3"`), `mode: RollMode`, `dc: int 1..40`, `autoFail: { reason } \| null = null`, `autoSuccess?: { reason } \| null` (Amended by specs/070-stakes-before-dice), `houseRules?: { outcomeBands, naturals }` (Amended by specs/070-stakes-before-dice), `reason` | `dice.rolled` (purpose `check` or `save`), `check.resolved`; with `autoFail` or `autoSuccess`, `check.resolved` only | `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `D20_TERM_REQUIRED`, `UNKNOWN_COMBATANT`, `TARGET_DEAD` |

- Both commands require a plain d20 term in `expression`, else `D20_TERM_REQUIRED`. The
  rest of the expression carries the bonus adjudication chose (proficiency, ability
  modifier, bonus dice such as Bless `+1d4`).
- **Attack outcome** (SRD 5.2.1): the kept d20 face is the natural roll. Natural 20 →
  `critical-hit` (hits whatever the AC). Natural 1 → `miss` (misses whatever the total).
  Otherwise `total >= ac` → `hit`, else `miss`. Amended by spec 119 (TASK-0222): a derived
  attack that hits a `paralyzed` or `unconscious` target with a melee use is `critical-hit`.
- **AC source**: `targetAc` when given (adjudication supplies it: cover, a shield spell, an
  object not in the state); else the target record's `ac`. Neither → `TARGET_AC_UNKNOWN`.
  The event records which source was used.
- `attackerId`, when not null, must exist (`UNKNOWN_COMBATANT`) and not be dead
  (`TARGET_DEAD`); the target likewise.
- **Check and save outcome**: `total >= dc` → `success`, else `failure`. SRD 5.2.1 gives a
  natural 20 or 1 no automatic result on ability checks or saving throws, so the engine
  records `natural` but does not use it. `combatantId` null means a roll for something not in
  the state (an NPC the scene has not added); when not null it must exist and not be dead.
- **Automatic failure** (orchestrator ruling 2026-10-25). `autoFail: { reason:
  z.string().min(1).max(500) }` is adjudication's decision that a rule makes this check or
  save fail automatically (for example a Paralyzed creature's Dexterity save). The engine
  does not derive it from conditions (FR-011). With `autoFail` present, the engine still
  parses the expression and runs every precondition, then draws no die and emits only
  `check.resolved` with outcome `failure`, the DC, `autoFail` and null roll fields. No
  combination with `autoFail` is illegal: `mode` and a valid `expression` are simply unused,
  so `autoFail` adds no refusal code.
  Amended by spec 119 (TASK-0222): the engine derives automatic failure on Strength and Dexterity saves from `paralyzed`, `petrified`, `stunned` and `unconscious`; a command `autoFail` stays valid and wins.
- `attack.roll` applies no damage. The `resolve` node (no LLM) follows a `hit` or
  `critical-hit` with `damage.apply`, setting `critical: true` exactly when the
  `attack.resolved` outcome is `critical-hit`.

Amended by specs/033-director-robustness/contracts/rules-terms.md.

Amended by specs/070-stakes-before-dice (TASK-0127): `check.roll` bands its result.
`autoSuccess` draws no die and emits `check.resolved` with outcome `success`, band `success`, and null roll
fields; `autoFail` with `autoSuccess` refuses `INVALID_COMMAND`. `houseRules` defaults to both flags false
(SRD-pure); the DM runtime sends the seed's `tableRules`. With `naturals`, a natural 20 is a success and a
natural 1 a failure. With `outcomeBands`, an ability check missing its DC by 1 or 2 is `success-at-cost`
(outcome `success`) and by 5 or more is `severe-failure` (outcome `failure`). A saving throw never gets
those bands. The engine exports `bandOf` for this rule.

## Combatants

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `combatant.add` | `combatant: CombatantInit`, `reason` | `combatant.added` | `DUPLICATE_COMBATANT` |
| `combatant.remove` | `combatantId`, `reason` | `combatant.removed` | `UNKNOWN_COMBATANT`, `COMBATANT_IN_ENCOUNTER` |

```ts
const CombatantInit = z.object({
  id: Id,
  name: z.string().min(1).max(100),
  hp: z.object({
    max: z.number().int().min(1).max(10000),
    current: z.number().int().min(0).optional(),   // default max; refine <= max
    temp: z.number().int().min(0).optional(),      // default 0
  }),
  zeroHpRule: z.enum(["death-saves", "dies"]),
  initiativeBonus: z.number().int().min(-10).max(30).default(0),
  conModifier: z.number().int().min(-5).max(10).default(0),
  ac: z.number().int().min(1).max(40).nullable().default(null),
  defenses: DefenseSet.default({ resistances: [], vulnerabilities: [], immunities: [] }),
  hitDice: z.array(z.object({
    die: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    total: z.number().int().min(0).max(40),
    remaining: z.number().int().min(0).optional(),  // default total
  })).default([]),
  spellSlots: z.object({
    standard: z.record(z.enum(["1","2","3","4","5","6","7","8","9"]),
                       z.number().int().min(0).max(10)).default({}),   // max per level
    pact: z.object({ level: z.number().int().min(1).max(5),
                     count: z.number().int().min(1).max(4) }).nullable().default(null),
  }).default({ standard: {}, pact: null }),
});
```

A combatant added with `current: 0` starts `unconscious` (death-saves rule) or `dead` (dies
rule); otherwise it starts `conscious`. Slots start unexpended; conditions start empty.

## Hit points

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `damage.apply` | `targetId`, `components: [{ amount: Amount, damageType: DamageType }]` (1..10), `critical: boolean = false`, `defenses: DefenseSet \| null = null`, `reason` | `dice.rolled` per rolled component (in component order), `hp.changed`, then any of `life-state.changed`, `death-saves.changed`, `condition.applied` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, dice codes |
| `healing.apply` | `targetId`, `amount: Amount`, `reason` | `dice.rolled`?, `hp.changed`, then any of `life-state.changed`, `death-saves.changed`, `condition.removed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, dice codes |
| `temp-hp.grant` | `targetId`, `amount: Amount`, `reason` | `dice.rolled`?, `hp.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `TEMP_HP_NOT_HIGHER`, dice codes |

"Dice codes" are `INVALID_DICE_EXPRESSION` and `DICE_LIMIT_EXCEEDED`, possible only when an
amount has `kind: "roll"`. A rolled amount is `max(0, total)`. The engine parses the expression
before it rolls, so a bad expression refuses with zero dice drawn.

**Damage arithmetic** (per component, then summed):

1. **Raw.** A `fixed` component's raw amount is its value. A `roll` component rolls its
   expression; with `critical: true` the dice layer doubles the count of every dice term
   (modifiers are not doubled; a keep `n` doubles with its count). Raw is `max(0, total)`.
   The doubled count must stay within the dice limits, else `DICE_LIMIT_EXCEEDED` before
   any draw.
2. **Defense set.** `defenses` when given (adjudication's per-command set: a spell that
   grants resistance, a magic weapon that bypasses a resistance), else the target record's
   `defenses`. The given set *replaces* the record for this command; it does not merge. The
   event records which source was used.
3. **Applied** (SRD 5.2.1 order): immune to the type → 0. Otherwise start from raw; resistant
   → `floor(x / 2)`; then vulnerable → `x * 2`. A type in both resistances and
   vulnerabilities gets both (halve, then double). Immunity wins over both.
4. The command's damage is the sum of the applied amounts. Raw and applied values per
   component appear in `hp.changed.components` (events.md).

**Damage rules** (applied to the summed amount, in order):

1. Temporary HP absorb damage first; the rest reduces `hp.current`, floored at 0.
2. Target `conscious`, HP reaches 0:
   - `zeroHpRule: "dies"` → `life-state.changed` to `dead`.
   - `death-saves` and the damage left over after reaching 0 is at least `hp.max` (massive
     damage) → `life-state.changed` to `dead`.
   - otherwise → `life-state.changed` to `unconscious`, then `condition.applied`
     (`unconscious`, source `"hp-zero"`) unless an `unconscious` instance already exists.
3. Target already at 0 HP (`unconscious` or `stable`), death-saves rule:
   - damage at least `hp.max` → `life-state.changed` to `dead`.
   - otherwise `death-saves.changed` adds 1 failure (2 if `critical`). A `stable` target
     first gets `life-state.changed` to `unconscious`. Reaching 3 failures →
     `life-state.changed` to `dead`.
4. A total applied amount of 0 (an immunity, a zero roll) still emits `hp.changed` with
   equal before and after (the ledger shows the zero). It adds no death-save failure.
5. Massive damage and the death-save failure for damage at 0 HP use the summed *applied*
   amount, after defenses.

**Healing rules:** HP rise to at most `hp.max`; temporary HP are untouched. A target at 0 HP
that regains at least 1 HP gets `life-state.changed` to `conscious`, `death-saves.changed` to
0/0 (only if not already 0/0), and `condition.removed` for every `unconscious` instance with
source `"hp-zero"`.

**Temporary HP:** temporary HP never stack; the higher value wins.

- A `fixed` amount not strictly greater than the current `hp.temp` is refused with
  `TEMP_HP_NOT_HIGHER` (zero dice drawn).
- A `roll` amount cannot be compared before the draw, so it never refuses on that ground. The
  engine emits `dice.rolled`, then `hp.changed` with `after.temp = max(before.temp, rolled)`.
  When the roll is not higher, before and after are equal and the ledger shows the kept value.

## Conditions

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `condition.apply` | `targetId`, `condition: ConditionKey` (not `exhaustion`), `source`, `expiresAt: ExpiryPoint \| null = null`, `reason` | `condition.applied` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `CONDITION_ALREADY_PRESENT` |
| `condition.remove` | `targetId`, `condition: ConditionKey` (not `exhaustion`), `reason` | `condition.removed` (one per matching instance) | `UNKNOWN_COMBATANT`, `CONDITION_NOT_PRESENT` |
| `exhaustion.adjust` | `targetId`, `delta: int, -6..6, ≠ 0`, `reason` | `condition.applied`, `condition.changed` or `condition.removed`; then `life-state.changed` to `dead` at level 6 | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `EXHAUSTION_OUT_OF_RANGE` |

- `condition.apply` refuses a second instance of the same condition (conditions do not
  stack). Passing `condition: "exhaustion"` to `condition.apply` or `condition.remove` is
  `INVALID_COMMAND` (a schema refinement); exhaustion moves only through
  `exhaustion.adjust`.
- `condition.remove` on a dead target is allowed (cleanup).
- `exhaustion.adjust`: the new level is current level (0 if absent) plus `delta`. A result
  below 0 or above 6 is `EXHAUSTION_OUT_OF_RANGE`. 0 removes the instance; from 0 it applies
  one; otherwise it changes the level.
- Instance ids are `"<combatantId>#<n>"`, where `n` is `conditionSeq + 1`; the event carries
  the counter's before and after.

## Initiative and turns

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `initiative.roll` | `participants: [{ combatantId, mode: RollMode }]` (1..50, unique), `reason` | one `dice.rolled` per participant in list order, then `encounter.started` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD` |
| `initiative.join` | `combatantId`, `mode: RollMode`, `reason` | `dice.rolled`, `encounter.changed` | `NO_ACTIVE_ENCOUNTER`, `UNKNOWN_COMBATANT`, `ALREADY_IN_ENCOUNTER`, `TARGET_DEAD` |
| `initiative.leave` | `combatantId`, `reason` | when the leaver is active: `condition.removed` for its `turn-end` expiries and for the `turn-start` and `turn-end` expiries of each skipped dead combatant, then `encounter.changed`, then `condition.removed` for each `turn-start` expiry of the incoming combatant; otherwise `encounter.changed` only | `NO_ACTIVE_ENCOUNTER`, `UNKNOWN_COMBATANT` (also `details.reason: "not-in-order"` when the combatant is not in the order), `NO_ELIGIBLE_COMBATANT` (the order would be empty, or the leaver is active and every remaining combatant is dead) |
| `turn.advance` | `reason` | `condition.removed` for each `turn-end` expiry of the outgoing turn, `turn.advanced`, `condition.removed` for each `turn-start` expiry of the incoming turn. Amended by spec 079 (TASK-0208): an `encounter.changed` that resets the incoming combatant's Reaction follows `turn.advanced` when it was spent | `NO_ACTIVE_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT` |
| `action.spend` | `combatantId`, `cost: "action" \| "bonus-action"`, `reason` | `encounter.changed` (sets the slot in `Encounter.economy`). Amended by spec 117 (TASK-0304): the planner appends it last | `UNKNOWN_COMBATANT`, `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN`, `ACTOR_UNABLE` (role `actor`), `ACTION_SPENT` |
| `dodge` | `combatantId`, `reason` | `encounter.changed` (adds the id to `Encounter.dodging`; spends nothing). Amended by spec 117 (TASK-0304) | `UNKNOWN_COMBATANT`, `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN`, `ACTOR_UNABLE` (role `actor`) |
| `encounter.end` | `reason` | `condition.removed` for each instance with `expiresAt`, then `encounter.ended` | `NO_ACTIVE_ENCOUNTER` |

- Each participant rolls `1d20 + initiativeBonus` with its mode. Order: total descending,
  then bonus descending, then `combatantId` ascending. The encounter starts at round 1,
  `turnIndex` 0.
- `initiative.join` inserts by the same ordering. If the insert lands at or before the
  current `turnIndex`, `turnIndex` rises by 1, so the active combatant does not change.
- `initiative.leave` removes the combatant's entry from the order and keeps its state in
  `combatants`. It draws no die. It refuses with `NO_ELIGIBLE_COMBATANT` when the order would
  be left empty. If the leaver sits before `turnIndex`, `turnIndex` falls by 1, so the active
  combatant does not change. If the leaver is the active combatant, the leave is the turn
  transition and mirrors `turn.advance`: the `turn-end` expiries of the leaver run, the entry at
  the same index becomes active, dead entries are skipped with their `turn-start` and `turn-end`
  expiries, an index past the end wraps to 0 with the round + 1, and the incoming combatant's
  `turn-start` expiries run after `encounter.changed`. The next combatant is then active
  exactly once.
  Amended 2026-10-27 (TASK-0141, operator ruling OQ-3).
- `turn.advance` moves to the next entry whose combatant is not `dead`, wrapping to a new
  round after the last entry. Turns skipped because the combatant is dead still cross that
  combatant's `turn-start` and `turn-end` expiry points. If every combatant in the order is
  dead, it refuses with `NO_ELIGIBLE_COMBATANT`.
- An expiry point matches when its `round`, `combatantId` and `boundary` equal the boundary
  being crossed.

## Life

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `death-save.roll` | `targetId`, `mode: RollMode`, `reason` | `dice.rolled`, then `death-saves.changed` and any of `life-state.changed`, `hp.changed`, `condition.removed` | `UNKNOWN_COMBATANT`, `NOT_DYING` |
| `stabilize` | `targetId`, `reason` | `death-saves.changed`, `life-state.changed` | `UNKNOWN_COMBATANT`, `NOT_DYING` |

- "Dying" means `lifeState === "unconscious"` with `zeroHpRule: "death-saves"`. Anything
  else is `NOT_DYING` (including `TARGET_DEAD` cases: a dead target is not dying).
- `death-save.roll` rolls `1d20` with the mode. Natural 20: `hp.changed` 0→1,
  `death-saves.changed` to 0/0, `life-state.changed` to `conscious`, `condition.removed` for
  `hp-zero` unconscious instances. Natural 1: +2 failures. 10 or more: +1 success. Below 10:
  +1 failure. 3 successes → `death-saves.changed` to 0/0 and `life-state.changed` to
  `stable`. 3 failures → `life-state.changed` to `dead` (the tally keeps its 3).
- `stabilize` (a successful Medicine check or a spell, decided before the command):
  `death-saves.changed` to 0/0, `life-state.changed` to `stable`. The tally event is omitted
  when it is already 0/0.

## Rests

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `rest.short` | `participants: [{ combatantId, spend: [{ die, count }] }]` (1..20, unique), `reason` | per participant: per die `dice.rolled`; `hit-dice.changed` per pool spent; `hp.changed` if any die was spent; `life-state.changed` and the healing side effects when HP leaves 0; `spell-slots.changed` for an expended pact slot. Last: `rest.completed` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD`, `INSUFFICIENT_HIT_DICE` |
| `rest.long` | `participants: [combatantId]` (1..20, unique), `reason` | per participant, only for values that change: `hp.changed` (current to max, temp to 0), `death-saves.changed` to 0/0, `hit-dice.changed` per pool to `total`, `spell-slots.changed` per level and pool to 0 expended, exhaustion `condition.changed` or `condition.removed`. Last: `rest.completed` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD`, `LONG_REST_REQUIRES_HP` |

- Short rest: each hit die heals `max(0, face + conModifier)`; the sum applies once as one
  `hp.changed` (cause `rest`), capped at max. `spend` with `count: 0` or an empty list is
  allowed (the rest still restores pact slots). A participant that changes nothing produces
  no per-participant events.
- Both rests end with one `rest.completed` event naming the rest kind and the participants.
  It changes no state; it marks the rest in the ledger and keeps the result non-empty when
  nothing else changed.
- Long rest requires `hp.current >= 1` (SRD 5.2.1). It restores all spent hit dice
  (SRD 5.2.1 rule; the 2014 rule restored half).

## Spell slots

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `spell-slot.expend` | `targetId`, `pool: "standard" \| "pact"`, `level: SlotLevel`, `reason` | `spell-slots.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `SLOT_LEVEL_UNAVAILABLE`, `NO_SLOT_AVAILABLE` |
| `spell-slot.restore` | `targetId`, `pool`, `level`, `count: int 1..9 = 1`, `reason` | `spell-slots.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `SLOT_LEVEL_UNAVAILABLE`, `SLOT_NOT_EXPENDED` |

- `SLOT_LEVEL_UNAVAILABLE`: the combatant has no slot of that level in that pool (for
  `pact`, the pact pool is null or its level differs).
- `spell-slot.restore` refuses when `expended < count` (`SLOT_NOT_EXPENDED`); it never
  restores past max.

## Amended by specs/082-engine-derived-numbers (TASK-0104)

`attack.roll`: `expression` is optional; new optional `attack: string` names an entry in the attacker's
`stats.attacks`. Exactly one of `expression` and `attack`, else `INVALID_COMMAND`. With `attack`, the
attacker is non-null, the roll is `1d20+toHit` (minus 2 per exhaustion level) at a mode folded from
`mode` and the SRD conditions of attacker and target, and an unknown attack or missing stats refuses
`STAT_UNDEFINED` before any die. `check.roll`: `expression` and `dc` are optional; new optional
`difficulty` (`very-easy` 5, `easy` 10, `medium` 15, `hard` 20, `very-hard` 25, `nearly-impossible` 30).
Exactly one of `dc` and `difficulty`, else `INVALID_COMMAND`. Without `expression`, a named combatant's
modifier is derived from `stats` (`STAT_UNDEFINED` when it cannot be) and the mode is folded from
conditions; a null combatant rolls flat `1d20`. An explicit `expression` keeps the old behaviour (no
condition folding). `combatant.add`'s `CombatantInit` gains optional `stats`.

## Amended by specs/083-spells-by-srd-id (TASK-0105)

New command `spell.cast`: `casterId`, `spellId` (SRD id grammar), `targetId`, `slotLevel` (1..9 or
`null` for a cantrip), `casterLevel` (1..20), optional `houseRules`, `reason`. The engine looks the
spell up in its `SPELLS` table and resolves it in one result: spend the slot (the `spell-slot.expend`
rules, standard pool else pact), roll the spell attack or the target's save at the caster's spell DC,
then apply damage (half on a save when the table says so), healing (dice plus the spellcasting
modifier) or a condition. Every refusal comes before any die. Refusals: `SPELL_UNRESOLVED`,
`UNKNOWN_COMBATANT`, `TARGET_DEAD`, `ACTOR_UNABLE`, `STAT_UNDEFINED`, `SLOT_LEVEL_UNAVAILABLE`,
`NO_SLOT_AVAILABLE`, `TARGET_AC_UNKNOWN`.

## Amended by specs/084-opposition-and-help (TASK-0128)

`check.roll` gains optional `opposition: { opponentId, rule: "unarmed-strike" | "influence" }`, a third DC
source: exactly one of `dc`, `difficulty` and `opposition`. The engine derives the DC from the opponent's
stats (`unarmed-strike`: 8 + Strength modifier + proficiency bonus; `influence`: the higher of 15 and the
opponent's Intelligence score).

New command `help.grant`: `helperId`, `assist: { kind: "ability-check", allyId, skill } | { kind: "attack", targetId }`,
`reason`. Emits `assist.ended` (`replaced`) for the helper's open assist, then `assist.granted`. Refusals:
`UNKNOWN_COMBATANT`, `TARGET_DEAD`, `ACTOR_UNABLE`, `INVALID_COMMAND`, `STAT_UNDEFINED`, `NOT_PROFICIENT`.

A derived `check.roll` with a matching assist, and a derived `attack.roll` or `spell.cast` attack against a
target holding an attack assist (helper not the attacker), roll with advantage and emit `assist.ended`
(`used`) after the resolving event. `CombatantStats` gains optional `abilityScores`; `Combatant` gains
optional `assists`.
