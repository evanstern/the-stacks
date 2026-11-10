# Contract: Fact sheet (spec 098, TASK-0245)

Status: binding on TASK-0245 merge. Consumers: TASK-0272 (prose slots, leak and contradiction
check), TASK-0215 (startle on the sheet), TASK-0268 and TASK-0269 (the `PlanFact` feed, §6),
TASK-0247 (rows as stream rows, spec OQ-3).

Home: `apps/server/src/dm/fact-sheet.ts` (spec OQ-2). Pure. It imports no engine value, no RNG and
nothing from `gate/`. It joins narrate's import closure, so the `narrate.test.ts` closure test
covers it.

## 1. Input: settled engine events

```ts
buildFactSheet(input: FactSheetInput): FactSheet

interface FactSheetInput {
  /** Today's settled-facts record, built by buildNarrationFacts from ledger rows. */
  settled: NarrationFacts;
  /** The beat's declared actions, from assemble (BeatItem). */
  beat: readonly { actionId: string; characterId: string | null;
                   scope: "character" | "party"; actor: string; text: string }[];
  /** Projections after resolve: party (controllers), tableMode, encounter. */
  projections: Pick<SessionProjections, "party" | "tableMode" | "encounter">;
  /** Combatant id → display name, from the snapshot after resolve. */
  nameOf: (id: string | null) => string;
  /** Resolve's submissions (key, result); a refused `act:<actionId>:*` step after an applied one marks `partial`. */
  submissions: readonly { key: string; result: "applied" | "pending" | "suggested" | "refused" }[];
}
```

- Every field is derived from events the gate appended and the projections that fold them:
  ledger rows (`roll`, `outcome`, `change`), `action.resolved`, `table-mode.changed`,
  `encounter.changed`, `scene-presence.changed`. Interpret's clarify question is the one model
  text the sheet carries, and it is carried verbatim, never rewritten (§3.3).
- No digit in the sheet comes from a model. `settled.director.goalNote` and NPC `say` lines stay
  under `withholdRefusedInputs` exactly as today.

## 2. Output: `FactSheet`

```ts
type SlotName = "restate" | "describe" | "ask";

interface FactSheet {
  trigger: TurnTrigger;
  mode: "free" | "turn";                // mode after the beat
  /** One per declared action the beat narrates, in beat order. Empty when no action. */
  restate: RestateTarget[];
  /** Code-rendered rows, in narration order (§3). */
  rows: FactRow[];
  /** NPCs the narrator may voice. */
  speakers: Speaker[];
  /** The model slots allowed for this job (§4). */
  slots: SlotName[];
  /** A code-settled ask (a clarify question, verbatim); null when none. */
  ask: string | null;
  /** The code-rendered State line; null only on a talk reply (§4). */
  state: string | null;
  /** The settled-facts record (today's NarrationFacts); the prompt and the audit read it. */
  settled: NarrationFacts;
}

interface RestateTarget {
  actionId: string;
  /** "Tamsin Vale" or "The party". */
  subject: string;
  /** The declared text, digits spelled out (spellDigits). */
  text: string;
  resolution: "applied" | "no-effect" | "refused" | "clarify" | "held" | "partial";
  refusalCode: string | null;
}

interface FactRow {
  kind: "roll" | "hp" | "life-state" | "condition" | "death-saves" | "spell-slot" | "assist"
      | "refusal";
  text: string;
}

interface Speaker {
  name: string;
  /** The settled line the NPC speaks this beat (FactNpcPlan.say), else null. */
  say: string | null;
}

interface NarrationSlots { restate: string; describe: string; ask: string }
```

`kind` names are additive (minor). A new kind (`position`, TASK-0271; `why`, TASK-0272) is a minor
change. Renaming or removing a kind is breaking and needs a decision record.

## 3. Rows

### 3.1 Change rows (`renderChangeLine`, extended)

| Kind | Text | Source event |
|---|---|---|
| `roll` | unchanged `renderRollLine` | ledger `roll` + `outcome` |
| `hp` | unchanged: `<target> takes <n> <type> (<b>→<a> HP)` / `<target> regains <n> HP (<b>→<a> HP)` | `hp.changed` |
| `death-saves` | unchanged | `death-saves.changed` |
| `life-state` | `<target>: <before> → <after>` | `life-state.changed` |
| `condition` | `<target>: <condition> applied` / `<target>: <condition> removed` | `condition.applied`, `condition.removed` |
| `spell-slot` | `<target> spends a level <n> spell slot` | `spell-slots.changed` (spend only) |
| `assist` | `<helper> helps <target> (<ability check \| attack>)` | `assist.granted` |

Order matches `renderDiceLines` today: per action (rolls then changes), pulled NPCs, the NPC turn,
settling. Refusal rows sit at their action's place.

`playtest/auditor/checks.ts` `DICE_LINE` widens to accept every row form, and `expectedDiceLines`
renders the same rows (its `DICE_RELEVANT` set gains `death-saves.changed`, `spell-slots.changed`,
`assist.granted`).

### 3.2 Refusal rows

`<subject>: refused, <reason> (<CODE>)`. Reasons by code:

| Code | Reason |
|---|---|
| `STEP_ACTOR_MISMATCH` | the step named another character |
| `UNKNOWN_COMBATANT` | that target is not in the scene |
| `NO_SLOT_AVAILABLE` | no spell slot of that level is left |
| `SPELL_UNKNOWN` | the caster does not know that spell |
| `SPELL_NOT_PREPARED` | that spell is not prepared |
| `SPELL_UNRESOLVED` | the engine cannot resolve that spell yet |
| `STAT_UNDEFINED` | the sheet has no value for that roll |
| `NOT_YOUR_TURN`, `TURN_MOVED` | it is not that character's turn |
| `CHARACTER_UNABLE` | that character cannot act |
| any other | the rules do not allow it |

### 3.3 The code-settled ask

`ask` is the first clarify question (`settled.clarify[0].question`) when any action's resolution is
`clarify`. Interpret writes it once; code carries it verbatim. A second clarify in one beat appends
as a second sentence of the same ask.

## 4. Decision tree

Axes: **trigger** (`commit`, `approval`, `reconcile`, `manual`, `held` are *action* triggers;
`npc-turn`; `talk`; `scene-start`; plus *encounter start* and *encounter end* and *scene end*,
read from `settled.events`, `settled.modeChange` and `settled.director.sceneEnded`),
**resolution** per action, **mode** after the beat.

### 4.1 Slots

| Trigger | `restate` | `describe` | `ask` (model) | `ask` (code) |
|---|---|---|---|---|
| action, any resolution but clarify | yes | yes | optional | — |
| action, any action in clarify | yes | yes | no | the clarify question |
| `npc-turn` | no | yes | no | — |
| settling only (`settled.settled` set, no action, no NPC turn) | no | yes | no | — |
| `scene-start` | no | yes | optional | — |
| `talk` (reply) | no | react text | no | — |

The model `ask` is optional: a single open question, not an either-or menu, never "What do you do?".

### 4.2 Status clause per action (in beat order)

| Resolution | Source | Clause |
|---|---|---|
| `applied` | `action.resolved` applied, all steps ran | `<Subject>'s action is done.` |
| `partial` | applied, and a later `act:<actionId>:*` submission was refused, or `FactAction.followUps` is non-empty | `<Subject>'s action is partly done; the rest has not happened.` |
| `no-effect` | `action.resolved` no-effect | `<Subject>'s action is done; nothing changed.` |
| `refused` | `action.resolved` refused | `<Subject>'s action did not happen.` |
| `clarify` | interpret clarify, no steps ran | `Nothing has happened yet. <Subject>'s action waits on <answerer>'s answer.` |
| `held` | TASK-0244 held for a companion | `<Subject>'s action waits for <companion>'s turn.` |

`<Subject>` is the character name, or "The party" for a party action. `<answerer>` is the party
member whose controller is the action's actor; for an AI companion actor, its own name.

### 4.3 Floor clause

| Mode after the beat | Condition | Clause |
|---|---|---|
| any | `settled.director.sceneEnded` | `The scene is over; the DM moves next.` |
| `turn` | encounter started this beat | `The fight begins. It is <active>'s turn.` |
| `turn` | otherwise | `It is <active>'s turn.` |
| `free` | encounter ended this beat | `The fight is over. Anyone may act.` |
| `free` | a clarify is open | `Anyone else may act.` |
| `free` | otherwise | `Anyone may act.` |

`<active>` is `projections.encounter.activeCombatantId` through `nameOf`. In turn mode with a clarify
open, the clarify holds the turn (specs/073), so `<active>` is the answerer's character.

### 4.4 State line

`State: ` + status clauses + floor clause, joined by single spaces.

- It never holds `?` (a property test asserts it).
- It always names whose move it is: a combatant, "Anyone", or "the DM".
- A talk `reply` has no State line. A talk `escalate` that starts a fight carries the floor clause
  only (spec OQ-4).

Worked examples:

- Run 1 seq 15-20 (party clarify, free): `State: Nothing has happened yet. The party's action waits on Tamsin Vale's answer. Anyone else may act.`
- Applied attack, turn: `State: Tamsin Vale's action is done. It is Snag's turn.`
- Refused, turn: `State: Tamsin Vale's action did not happen. It is Odo's turn.`
- NPC turn: `State: It is Kestrel's turn.`
- Scene start: `State: Anyone may act.`

## 5. Slots and composition

### 5.1 Model output

Tagged text, one `callText` (spec OQ-1):

```
[restate] Tamsin means to lead the party along the timber posts toward the reed camp.
[describe] The posts are slick with reed-slime ...
[ask] ...
```

`parseSlots(text, sheet)`:

1. Split on `[restate]`, `[describe]`, `[ask]` tags at a line start. Text before any tag, or a reply
   with no tag, is `describe`.
2. Drop a slot not in `sheet.slots`.
3. `restate`: if empty or it holds a digit, use the code default:
   `<subject> means to: "<text>".` per target, joined by spaces.
4. `ask` (model): drop it unless it ends in `?`, holds one `?`, matches neither `EITHER_OR_END` nor
   the stock ending (`STOCK_ENDING`).
5. If `sheet.ask` is set, `ask` = `sheet.ask`.
6. `describe`: `clipProse` and `dropStockEnding`, as today.

### 5.2 Composition

`composeReply(slots, sheet)` = non-empty blocks joined by `"\n\n"`:
`restate`, `describe`, `ask`, rows (each row on its own line), `sheet.state`.

`NarrateOutput` gains `sheet: FactSheet` and `slots: NarrationSlots`; `prose` becomes the three slots
joined by `"\n\n"`; `diceLines` becomes the row texts; `text` is `composeReply`. The audit's
`deterministicChecks` compares `diceLines` to the rendered rows, as today.

## 6. Seam with the planner (`PlanFact`, spec 097)

- The sheet's input is settled engine events (§1). The planner path (TASK-0268 gate, TASK-0269
  interpret) produces the same events through `execute`, so `buildFactSheet` runs unchanged on it
  (CP-5 F4).
- `PlanFact` (`@the-stacks/planner`, spec 097 contract §4) is not a `FactRow`. TASK-0268 stores
  `PlanFact[]` on the Intent's outcome carrier event. TASK-0272 adds an optional
  `FactSheetInput.planFacts?: PlanFact[]` and one row kind, `why`, rendered by a mapping in
  `fact-sheet.ts`:

| `PlanFact.kind` | `why` row text |
|---|---|
| `rule` | `Rule: <SRD rule title>` |
| `dc` | `DC <dc> (<difficulty \| opposition rule>)` |
| `reach` | `Reach: <band>, <use>` |
| `pull-in` | `<name> joins the fight` |
| `reaction` | `<name> may react as <mover> leaves` |
| `ruling` | `DM ruling: <decision>` (+ `: <reason>`) |
| `no-roll` | `No roll needed` |
| `ignored` | `The DM sets the <field>` |
| `unserved` | omitted (DM console only) |

- `fact-sheet.ts` is the only server module that imports `PlanFact`. That import arrives with
  TASK-0272, after TASK-0268 merges. This card adds no planner import.
- The names never collide: `PlanFact` (planner), `FactRow` (sheet), `FactRoll`/`FactChange`
  (settled record).
