# Contract: planner v1

**Status**: Draft (spec 097, TASK-0267). Binding once TASK-0267 merges. TASK-0268 (gate) and
TASK-0269 (interpret) build against it.

**Package**: `@the-stacks/planner`. Runtime dependencies: `@the-stacks/intent`,
`@the-stacks/space`, `@the-stacks/dnd5e-engine`, `zod`. Nothing else.

## 1. Signature

```ts
export function plan(state: PlanState, space: SpaceView, intent: Intent): PlanResult;
```

- Pure and synchronous. Same inputs give deep-equal output. No model, clock, randomness or I/O.
- `intent` is a parsed `Intent` (`IntentSchema` output). The gate parses; the planner never does.
- `space` is the actor's view. Until TASK-0271 it is `spaceViewOf(state.engine)`.
- The planner never reads `intent.text`. It never reads `intent.commit`, `source` or `channel`.
- Seat, turn and policy are the gate's checks. The planner trusts `intent.actor`.

## 2. PlanState

```ts
type Side = "party" | "hostile" | "neutral";

type PlanActor = {
  id: string;                 // the Intent actor or target id (pc id, companion id, npc id)
  combatantId: string | null; // engine combatant, or null for an NPC not yet in the engine
  side: Side;
  presence: "present" | "yielded" | "absent";
  seen: boolean;              // false: the acting viewer cannot target it (TASK-0271 fills it)
  controller: "human" | "ai"; // who runs it: a player, or an AI DM or AI companion
};

type PlanState = {
  engine: EngineState;
  actors: Readonly<Record<string, PlanActor>>;
  casters: Readonly<Record<string, { level: number; spells: readonly string[] }>>; // by combatantId
  srdSpellIds: readonly string[];                    // SRD spell ids that exist
  inits: Readonly<Record<string, CombatantInit>>;    // pull-in and add_combatant sources, by id
  openRequests: Readonly<Record<string, RulingRequest>>; // by requestId
  tableRules: { outcomeBands: boolean; naturals: boolean };
};
```

`CombatantInit` is the engine's `combatant.add` `combatant` field type. The planner exports
`PlanStateSchema` (Zod) so the gate can validate what it builds in tests.

## 3. PlanResult

```ts
type PlanResult =
  | { kind: "commands"; commands: PlannedCommand[]; facts: PlanFact[] }
  | { kind: "refusal"; refusal: PlanRefusal; facts: PlanFact[] }
  | { kind: "needs_ruling"; request: RulingRequest; facts: PlanFact[] };

type PlannedCommand = {
  command: EngineCommand;
  when?: { step: number; outcomes: StepOutcome[] }; // index of an earlier command in this list
};

type StepOutcome =
  | "hit" | "miss" | "critical-hit"                              // attack.resolved
  | "success" | "success-at-cost" | "failure" | "severe-failure"; // check.resolved band or outcome

type PlanRefusal =
  | { source: "planner"; code: IntentRefusalCode; message: string; details?: Record<string, unknown> }
  | { source: "engine"; code: RefusalCode; message: string; details?: Record<string, unknown> };
```

Target-architecture §2 sketches `{ kind: "refusal", reason }` and `{ kind: "needs_ruling",
question }`. This contract renames them `refusal` and `request` and adds `facts` to
`needs_ruling`, so every branch carries its "why".

### Execution rule (for TASK-0268)

1. Run the commands in order through `execute(state, command, rng)`, evolving state after each.
2. Skip a command whose `when.step` did not run, or whose outcome is not in `when.outcomes`.
   Read a step's outcome with `stepOutcome(events)`.
3. A refused first command refuses the Intent, and nothing is appended.
4. A refused later command stops the run. The events of earlier commands stand (OQ-7).
5. An empty `commands` list is a legal no-roll outcome. The gate records it with its facts.

`stepOutcome(events: readonly EngineEvent[]): StepOutcome | null` returns the `attack.resolved`
outcome, else the `check.resolved` `band`, else its `outcome`, else `null`.

## 4. PlanFact

```ts
type PlanFact =
  | { kind: "rule"; rule: string }                              // SRD id, e.g. "rules-glossary.help-action"
  | { kind: "dc"; source: "difficulty" | "dc" | "opposition"; difficulty?: Difficulty; dc?: number;
      opposition?: { opponentId: string; rule: OppositionRule } }
  | { kind: "reach"; band: Band; use: "melee" | "normal" | "long" }
  | { kind: "pull-in"; actorId: string }
  | { kind: "reaction"; reactorId: string; trigger: "leaves-zone" }
  | { kind: "ruling"; requestId: string; decision: "accept" | "reject" | "amend";
      by: "dm" | "ai:dm"; reason?: string }
  | { kind: "no-roll"; reason: "uncontested" }
  | { kind: "ignored"; field: "dc" | "difficulty"; why: "player-seat" }
  | { kind: "unserved"; part: string; owner: string };          // owner is a card id
```

- Every value is code-chosen. `ruling.reason` is the DM's `reason` param, carried as data.
- **Seam with TASK-0245.** The fact sheet (spec 098) reads settled engine events, not `PlanFact`s
  (CP-5 F4). Spec 098 names its row type `FactRow`. TASK-0268 stores `PlanFact`s on the Intent's
  outcome carrier event. TASK-0272 renders them as "why" rows beside the fact rows.
- `PlanFactSchema` is exported. The type lives only in `@the-stacks/planner`.

## 5. RulingRequest

```ts
type RulingRequest = {
  requestId: string;          // the id of the Intent being planned (a ruling or set_dc on replan)
  intent: Intent;             // the Intent to plan again; text kept for the DM to read
  ask: "difficulty" | "outcome";
  roll: {                     // ask "difficulty" only: the roll the planner will make
    kind: "ability-check" | "saving-throw";
    combatantId: string;
    ability: Ability;
    skill: Skill | null;
    mode: RollMode;
  } | null;
  opposition: {               // ask "difficulty" with a target only
    opponentId: string;
    rules: OppositionRule[];  // engine rules that cover the roll; [] means none
  } | null;
  stakes: "self" | "other";   // "other": a target is another actor (formulation 3: a roll against it)
  rule: string | null;        // SRD id the ask cites, e.g. "rules-glossary.search-action"
};
```

**Adjudication.** A request is answered by an Intent the gate routes back to `plan()`:

| Answer | Seat | Effect |
|---|---|---|
| `ruling { requestId, decision: "accept", difficulty }` | either DM | Plan `intent` with that tier. |
| `ruling { requestId, decision: "accept", dc }` | `dm` only | Plan `intent` with that DC. `ai:dm` with `dc` is `MODEL_NUMBER` at schema (decision-0030 Q3). |
| `ruling { requestId, decision: "accept" }` on ask `outcome` | either DM | No command; fact `no-roll`. |
| `ruling { requestId, decision: "accept" }` on ask `difficulty` | either DM | Ask again (FR-036). |
| `ruling { requestId, decision: "reject", reason? }` | either DM | No command; fact `ruling` (reject). |
| `ruling { requestId, decision: "amend", amend }` | either DM | Plan `amend` as the Intent body, same actor and id. |
| `set_dc { for, difficulty \| dc }` | either DM (`dc`: `dm` only) | As `accept`. |

An ask `outcome` accept never moves another actor: the stored Intent is `attempt` or
`use_object`, and a DM who wants a roll amends to `check` or `contest`. That keeps formulation 3:
a change to another actor needs a roll.

`RulingRequestSchema` is exported. The gate stores requests (a ruling job for the AI DM, a proposal
row for a human DM) and passes the open ones in `PlanState.openRequests`.

## 6. Refusals raised

**Planner source** (`IntentRefusalCode`, contract §9):

| Code | When |
|---|---|
| `KIND_UNSERVED` | the kind is Unserved or Not planned, or a served kind's unserved part (push, squares) |
| `TARGET_NOT_PRESENT` | a target id is unknown, absent, or (pull-in, `add_combatant`) has no init |
| `TARGET_UNSEEN` | a target has `seen: false` |
| `OUT_OF_REACH` | melee attack or attack-assist help outside the engaged band |
| `OUT_OF_RANGE` | ranged attack beyond long range |
| `NO_MOVEMENT_LEFT` | `move` with 0 ft left in an encounter |
| `NO_ACTION_LEFT` | a costed Action kind for the active combatant, whose Action is used this turn (spec 117) |
| `NO_BONUS_ACTION_LEFT` | a Bonus Action `cast` for the active combatant, whose Bonus Action is used this turn (spec 117) |
| `REQUEST_NOT_OPEN` | `ruling` or `set_dc` names no open request |
| `DM_SEAT_REQUIRED` | `ai:dm` fiat on a party actor, or `end_combat` with hostiles standing (FR-032) |

**Engine source** (engine `RefusalCode`, pre-checked with engine helpers): `UNKNOWN_COMBATANT`,
`ACTOR_UNABLE`, `STAT_UNDEFINED`, `SPELL_UNKNOWN`, `SPELL_NOT_PREPARED`, `SPELL_UNRESOLVED`, and
any refusal from the `move` probe.

**Economy rule (spec 117, TASK-0304)**: the planner costs an Intent with `actionCostOf` (an Action
for `attack`, `check`, `contest`, `dash`, `disengage`, `dodge`, `grapple`, `help`, `hide`, `search`
and `shove`; the spell's `castingTime` for `cast`; nothing for the rest). When the actor is the
active combatant of an encounter, the planner reads `actionsLeft` and refuses before the handler
runs. When the handler returns commands, the planner appends `action.spend` as the last command.
Other actors and free mode plan as before. `dodge` is served: it plans the engine `dodge` command
(29 served kinds, 11 unserved).

**Reserved, not raised by this card**: `NO_REACTION_LEFT` and `PROMPT_NOT_OPEN` (TASK-0276), the gate's seat and turn codes (TASK-0268).

## 7. Other exports

```ts
PLAN_KINDS: Record<IntentKind, { class: "served" | "ruling" | "unserved" | "not-planned"; owner?: string }>
hostilesStanding(state: PlanState): boolean  // a hostile actor present, conscious and not yielded
```

`hostilesStanding` is the TASK-0145 #1 predicate. The gate uses it for the Director's encounter
end and free-mode moves (TASK-0268).

## 8. Versioning

- Additive changes (a new fact kind, a newly served kind, a new optional state field) are minor.
  Record them in the package README CHANGELOG.
- Renaming or removing a result branch, a field or a fact kind is breaking. It needs a decision
  record before TASK-0268 merges against it.
