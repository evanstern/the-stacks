# Feature Specification: Engine action economy and Dodge

**Feature Branch**: `task-0304-action-economy`
**Card**: TASK-0304 (milestone m-10, epic TASK-0258). Must merge before TASK-0275.
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: `origin/main` `b7102dc0`.
Source: `specs/097-planner/spec.md` OQ-2 and OQ-3, operator ruling 2026-11-09 ("action economy and Dodge are carded as TASK-0304").
Evidence: `docs/playtests/2026-11-14-combat-smoke-hosted.md` finding 5 (session `8c7d506e-43a0-48e6-a60c-8b1f3d3493b8`, seq 80 and 85).
Runbook: `docs/design/r1-fast-table-runbook.md` (wave 3: "TASK-0304 (action economy; also covers F5, the double attack)").
Operator ruling: every fix carries a test that replays the failing flow.
**Clarify**: skipped. The card ACs, the SRD records and the code settle the behaviour. The judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as specs 114 and 116 were. `.specify/feature.json` is untouched.

## Summary

The engine tracks a Reaction (`Encounter.reactionsSpent`) and movement (`Encounter.movement`) per
turn. It tracks no Action and no Bonus Action. So the planner cannot raise `NO_ACTION_LEFT` or
`NO_BONUS_ACTION_LEFT` (both reserved in `packages/intent/src/refusals.ts`), TASK-0275 cannot drain
pips, and `dodge` refuses `KIND_UNSERVED` (owner TASK-0304).

On the hosted run, Tamsin (a level-1 Fighter) sent two `/attack` Intents in one turn. Both settled
with batch rows (seq 80 and 85). A level-1 Fighter has no Extra Attack, so the second must refuse
`NO_ACTION_LEFT`.

This card adds:

1. A per-turn action record in the engine, the `action.spend` command, and the `ACTION_SPENT` refusal.
2. A planner cost table. The planner refuses a second Action or Bonus Action and appends `action.spend` to every costed plan.
3. A `dodging` list in the engine, the `dodge` command, and its roll effects.
4. `dodge` served by the planner.

### SRD sources (SRD 5.2.1)

- `playing-the-game.actions` (the Actions table), Dodge: until the start of your next turn, attack
  rolls against you have Disadvantage and your Dexterity saves have Advantage. You lose the benefit
  while Incapacitated or at Speed 0. The same table lists Attack, Dash, Disengage, Help, Hide,
  Influence, Magic, Search, Study and Utilize as actions.
- `playing-the-game.actions.bonus-actions` (p. 10): you have a Bonus Action only when a feature or
  spell grants one, and you take only one Bonus Action on your turn.
- Condition `incapacitated` (p. 184), effect Inactive: no action, Bonus Action or Reaction.
- Spell records: `castingTime` is `Action` for `fire-bolt`, `sacred-flame`, `inflict-wounds`,
  `ray-of-sickness` and `cure-wounds`, and `Bonus Action` for `healing-word`.

## Decision record

| # | Question | Option | Verdict | Reason |
|---|---|---|---|---|
| 1 | Where per-turn use lives | A. A list per slot, like `reactionsSpent`, cleared by `turn.advance` | Rejected | Only the active combatant spends an Action on its turn. A list needs a clear on every turn change for no gain. |
| 1 | | B. One record for the active turn, like `Encounter.movement` | **Chosen** | `movement` already reads a record whose `round` or `combatantId` differs from the active turn as unused. The same read resets the economy at turn start with no reset event. |
| 1 | | C. Add the fields to `movement` | Rejected | `movement` names feet. One concept, one name. |
| 2 | How an Action is spent | A. A `cost` flag on each costed engine command | Rejected | It touches six handlers (`attack.roll`, `check.roll`, `spell.cast`, `help.grant`, `movement.action`, `condition.apply`), and `condition.apply` is also DM fiat. |
| 2 | | B. A new `action.spend` command the planner adds | **Chosen** | One handler. The planner already decides legality. The engine stays the final authority: a double spend refuses `ACTION_SPENT`. |
| 3 | Where `action.spend` sits in the plan | A. First | Rejected | It shifts every `when.step` guard. It also breaks the planner contract rule "a refused first command refuses the Intent": an engine refusal on the real first command would leave a spent Action and a `stopped` carrier. |
| 3 | | B. Last | **Chosen** | No guard shifts. A refused first command still writes nothing. The Action is spent only when the deed ran. |
| 4 | Which kinds cost what | A cost table in the planner | **Chosen** | See "Cost table". The engine knows no Intent kinds. |
| 5 | Who spends | Only the active combatant, in an encounter | **Chosen** | Outside an encounter, no economy applies. A DM-seat Intent for a combatant whose turn it is not (a readied action, TASK-0276) spends nothing. |
| 6 | Bonus Action spells | Add `castingTime` to the engine `SPELLS` table | **Chosen** | The planner cannot import `@the-stacks/srd` (its Biome boundary). `apps/server/test/dm/spell-mechanics.test.ts` already pins each table entry to its SRD record, so it pins `castingTime` too. |
| 7 | Extra Attack and Multiattack | Out of scope | **Chosen** | The engine models neither. No combatant has a class feature, and `dm/monster-policy.ts` plans one attack per turn ("ponytail: one attack per turn; multiattack ... arrive with a card"). One Attack action is one attack. See OQ-1. |
| 8 | Where the dodging state lives | A. A condition instance | Rejected | `dodging` is not an SRD condition. `ConditionKeySchema` would grow a non-SRD key. |
| 8 | | B. An `Encounter.dodging` id list, like `reactionsSpent` | **Chosen** | Both end "at the start of your next turn". `turn.advance` already clears the incoming id from `reactionsSpent`, and `initiative.leave` clears the leaver. Dodging rides the same two clears. |
| 9 | Losing the benefit (Incapacitated, Speed 0) | A. Emit a removal on every event that incapacitates or zeroes Speed | Rejected | It hooks `condition.apply`, `damage.apply` (hp 0), `exhaustion.adjust` and life state changes. |
| 9 | | B. Compute it: `isDodging` is false while the dodger is unable or has Speed 0 | **Chosen** | One read in one helper. The gap: if the condition ends before the dodger's next turn, the benefit comes back. A `ponytail:` comment names it. |
| 10 | Dodge with no encounter | Plan `dodge`; the engine refuses `NO_ACTIVE_ENCOUNTER` | **Chosen** | Dodge only means something in combat. The refusal is the engine's, as with `movement.action`. |
| 11 | Refusal order | `KIND_UNSERVED`, then the economy check, then the kind handler | **Chosen** | A spent Action refuses before any ruling is asked or any probe runs. |
| 12 | Hosted replay | A. A CI scenario move (spec 116 pattern) | Rejected | The harness sends typed Intents only in `moves.free`. In turn mode it sends `moves.combat.text`, prose only. TASK-0349 AC #1 owns a scripted fight through typed `/attack`. See OQ-3. |
| 12 | | B. A gate unit test and a DB gate test, both parsing the slash text | **Chosen** | The hosted flow was composer slash text through `gate.handle`. The DB test replays it on the reed-camp world. The unit test runs in every `pnpm ci:check`. |

### Cost table

The planner reads the cost from the Intent kind. `cast` reads the spell's `castingTime`.

| Cost | Kinds |
|---|---|
| Action | `attack`, `cast` (casting time `action`), `check`, `contest`, `dash`, `disengage`, `dodge`, `grapple`, `help`, `hide`, `search`, `shove` |
| Bonus Action | `cast` (casting time `bonus-action`) |
| None | every other kind, including `save`, `move`, `stand`, `drop_prone`, `end_turn`, `roll_free`, `rest_short`, `rest_long`, `attempt`, `use_object`, `ruling`, `set_dc`, every DM kind and every unserved or not-planned kind |

- `check` and `contest` cost an Action because the SRD lists Influence, Study, Search and the grapple
  escape as actions. A DM-called check is `request_roll` (TASK-0276), not `check`.
- `grapple` and `shove` cost an Action: each is an Unarmed Strike option of the Attack action.
- `attempt` and `use_object` cost nothing. Their outcome ruling plans no command. The cost table
  carries `// ponytail: Utilize is an action; add a cost when a ruling plans commands for attempt or use_object.`
- A `cast` of a spell with no `SPELLS` entry costs an Action. The handler then refuses it as today.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 The engine records Action and Bonus Action use per combatant per turn and resets them at turn start, with engine tests | FR-001–FR-006 | SC-001 | 1 |
| #2 The planner refuses a second Action or Bonus Action with `NO_ACTION_LEFT` or `NO_BONUS_ACTION_LEFT` | FR-013–FR-019 | SC-003, SC-004, SC-005 | 1, 2 |
| #3 Dodge sets a dodging state until the actor's next turn: attacks against it have disadvantage and its Dex saves have advantage, with golden-dice tests | FR-007–FR-012 | SC-002 | 1 |
| #4 The dodge Intent plans to the engine command instead of refusing `KIND_UNSERVED` | FR-020–FR-022 | SC-006 | 2 |
| Card note and operator ruling: a test replays the hosted double attack | FR-023, FR-024 | SC-005 | 2 |

## User scenarios

### US1 — A second attack in one turn is refused (P1, AC #2, hosted finding 5)

Tamsin, a level-1 Fighter, is the active combatant. She sends `/attack @goblin-2 with longsword`. It
settles: the attack rows, then `encounter.changed` marks her Action used. She sends the same slash
text again. The gate refuses `NO_ACTION_LEFT` (source `gate`) and writes no row.

### US2 — The Action returns at her next turn (P1, AC #1)

The turn passes round the order and returns to Tamsin in round 2. Her `/attack` settles again.

### US3 — A Bonus Action spell beside an Action (P1, AC #2)

Brother Odo is active. He casts `healing-word` (a Bonus Action), then attacks with his mace (an
Action). Both settle. A second `healing-word` refuses `NO_BONUS_ACTION_LEFT`.

### US4 — Dodge (P1, AC #3, #4)

Tamsin sends `/dodge`. It settles: `dodge` adds her to `Encounter.dodging`, and `action.spend` marks
her Action used. Snag's attack on her rolls with disadvantage. A Dexterity save she makes rolls with
advantage. When her next turn starts, she stops dodging.

### US5 — Dodge lost while incapacitated or at Speed 0 (P2, AC #3)

Tamsin dodges, then is grappled (Speed 0). Snag's next attack on her rolls normally.

## Requirements

### Engine: the action record (AC #1)

- **FR-001**: `EncounterSchema` MUST gain an optional `economy` record:
  `{ combatantId, round: int >= 1, actionUsed: boolean, bonusActionUsed: boolean }`. Add the comment
  `// Spec 117: the active combatant's Action and Bonus Action this turn. A record whose round or combatantId differs from the active turn reads as nothing used.`
  Absent reads as nothing used.
- **FR-002**: A new command `action.spend` MUST take `{ combatantId, cost: "action" | "bonus-action", reason }`.
- **FR-003**: `action.spend` MUST refuse, before any change and in this order:
  `UNKNOWN_COMBATANT` (no such combatant), `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN` (not the active
  combatant; the code `movement.action` and `stand` already use for "not your turn"),
  `ACTOR_UNABLE` (`isUnable`; SRD Incapacitated), and `ACTION_SPENT` when that slot is used.
  `ACTION_SPENT` details are `{ combatantId, cost }`.
- **FR-004**: On success it MUST emit one `encounter.changed` (subject the spender) whose `after`
  holds the current record with the slot set. When the stored record is stale or absent, the new
  record starts from `{ combatantId, round: enc.round, actionUsed: false, bonusActionUsed: false }`.
- **FR-005**: The reset MUST be the stale read. `turn.advance` emits nothing new for the economy.
  The engine MUST export `actionsLeft(state, combatantId): { action: boolean; bonusAction: boolean } | null`.
  It returns `null` outside an encounter or for an id not in the order. For any other id, a record
  that is not that id's current-turn record reads as both available.
- **FR-006**: `RefusalCodeSchema` MUST gain `ACTION_SPENT` as its last member.

### Engine: Dodge (AC #3)

- **FR-007**: `EncounterSchema` MUST gain an optional `dodging: CombatantId[]`. Add the comment
  `// Spec 117: combatants that took the Dodge action, until the start of their next turn (SRD 5.2.1 playing-the-game.actions).`
- **FR-008**: A new command `dodge` MUST take `{ combatantId, reason }`. It refuses, in order:
  `UNKNOWN_COMBATANT`, `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN`, `ACTOR_UNABLE`. On success it emits
  one `encounter.changed` (subject the dodger) that adds the id to `dodging`. An id already in the
  list stays once. The command spends nothing. The planner adds the spend (FR-016).
- **FR-009**: `turn.advance` MUST remove the incoming combatant from `dodging` in the same
  `encounter.changed` that clears its Reaction. It emits that event when the incoming id is in
  `reactionsSpent` or in `dodging`. `initiative.leave` (and so `combatant.depart`) MUST remove the
  leaver and the incoming combatant from `dodging`, as `withoutSpent` does for `reactionsSpent`.
  `encounter.end` drops it with the encounter.
- **FR-010**: The engine MUST export `isDodging(state, combatantId): boolean`. It is true only when
  the id is in `dodging`, the combatant is not `isUnable`, and `effectiveSpeed` is not `0`. A
  combatant with no speed stat (`null`) keeps the benefit. Add the comment
  `// ponytail: the benefit is computed, not removed. If Incapacitated or Speed 0 ends before the dodger's next turn, the benefit returns. Emit a removal when a condition hook exists.`
- **FR-011**: The derived roll paths MUST add one mode source each, folded with `foldMode` beside the existing sources:
  - `attack.roll` with an `attack` entry: `disadvantage` when `isDodging(state, targetId)`. Reaction attacks included.
  - `spell.cast` with an attack delivery: `disadvantage` when the target is dodging.
  - `spell.cast` with a `dex` save delivery: `advantage` when the target is dodging.
  - `check.roll` with `kind: "saving-throw"`, `ability: "dex"` and no `expression`: `advantage` when the checker is dodging.

  An explicit `expression` path folds no source, as today for conditions.
- **FR-012**: Golden-dice tests MUST pin each FR-011 source and each FR-009 and FR-010 rule (SC-002).

### Engine and planner: casting time (AC #2)

- **FR-013**: `SpellMechanicsSchema` MUST gain `castingTime: z.enum(["action", "bonus-action"])`.
  `healing-word` is `bonus-action`. The other five entries are `action`.
  `spell-mechanics.test.ts` MUST assert each entry's value against the SRD record's `castingTime`
  (`Action` maps to `action`, `Bonus Action` to `bonus-action`).

### Planner: economy (AC #2)

- **FR-014**: The planner MUST export `actionCostOf(intent): "action" | "bonus-action" | null`, the
  "Cost table" above. `cast` reads `SPELLS[intent.params.spell]?.castingTime`, defaulting to `action`.
- **FR-015**: In `planCtx`, after the `KIND_UNSERVED` check and before the handler: when the cost is
  not null, an encounter is active, and the actor's combatant (`state.actors[actorIdOf(intent)].combatantId`)
  is the active combatant, the planner MUST read `actionsLeft`. A used Action refuses
  `NO_ACTION_LEFT`. A used Bonus Action refuses `NO_BONUS_ACTION_LEFT`. Both are `source: "planner"`
  with details `{ combatantId, cost }`. Otherwise the handler runs.
- **FR-016**: When the same condition holds and the handler returns `commands`, the planner MUST
  append `{ command: { type: "action.spend", combatantId, cost, reason: c.reason } }` as the last
  command, unguarded. No `when.step` changes. A `refusal` or `needs_ruling` gets no spend.
- **FR-017**: The check runs inside `planCtx`, so a ruling's replan of a stored Intent is costed
  under the same rule. The stored Intent's actor spends only if it is still the active combatant.
- **FR-018**: Outside an encounter, or for an actor that is not the active combatant, the planner
  MUST plan exactly as today, with no check and no spend.
- **FR-019**: Planner contract section 6 MUST list `NO_ACTION_LEFT` and `NO_BONUS_ACTION_LEFT` as
  raised codes, and remove them from "Reserved, not raised by this card".

### Planner: Dodge (AC #4)

- **FR-020**: `dodge` MUST move from `unserved` to `served` in `PLAN_KINDS` (29 served, 11 unserved).
- **FR-021**: A `dodge` handler MUST resolve the actor (`resolveActor`) and plan
  `{ type: "dodge", combatantId, reason }`, with the actor's facts. FR-016 appends the spend.
- **FR-022**: `packages/intent/src/kinds.ts` MUST set `dodge`'s engine status to
  `engine("served", "dodge")`. `specs/092-intent-contract/contracts/intent-schema.md` MUST show the
  `dodge` row as `served → dodge`. No schema changes, so `INTENT_SCHEMA_MINOR` stays.

### Hosted replay (operator ruling)

- **FR-023**: `packages/session-model/test/gate-intents.test.ts` MUST replay the double attack. In
  turn mode on Ana's turn, it sends two `attack` Intents parsed from the same slash text (ids
  `f5-80` and `f5-85`). The first settles, and its rows end with `encounter.changed` before the
  carrier. Fold those rows into the projections. The second refuses `NO_ACTION_LEFT` with source `gate`.
- **FR-024**: `apps/server/test/gate.intent.integration.test.ts` MUST replay it on the reed-camp
  world, in a new `describe` with its own `turnWorld()`. Tamsin sends
  `parse("/attack @goblin-2 with longsword", { id, actor: { kind: "pc", id: "tamsin" }, source: "composer", commit: "confirmed" })`
  twice through `w.as(tamsin, { kind: "intent", intent })`, with two ids. The first is ok, with an
  `intent.recorded` carrier `outcome: "settled"`. The second refuses
  `{ source: "gate", code: "NO_ACTION_LEFT" }`, and the ledger row count is unchanged after it. No
  model call is made.

## Success criteria

- **SC-001**: `packages/dnd5e-engine/test/commands/economy.test.ts` covers `action.spend`: an Action
  and a Bonus Action each record on the active turn; a second Action refuses `ACTION_SPENT` before
  any draw (`expectRefusedBeforeDraw`); a used Action leaves the Bonus Action free; off turn
  `MOVE_OFF_TURN`; no encounter `NO_ACTIVE_ENCOUNTER`; unknown id `UNKNOWN_COMBATANT`; an
  incapacitated spender `ACTOR_UNABLE`. Reset: after `turn.advance` round the order back to the
  spender, `actionsLeft` is `{ action: true, bonusAction: true }`, and the spender can spend again.
  `replay` of the events rebuilds the same state.
- **SC-002**: The same file covers `dodge` and its effects with scripted dice. Each case asserts
  the `dice.rolled` mode and the `attack.resolved` or `check.resolved` outcome:
  - an attack on a dodging target rolls `disadvantage` and keeps the lower face; the same faces on a non-dodger roll `normal`;
  - a reaction attack on a dodger rolls `disadvantage`;
  - a dodger's derived Dex save rolls `advantage`; its Con save rolls `normal`;
  - `fire-bolt` on a dodger rolls `disadvantage`; `sacred-flame` (a Dex save) on a dodger rolls `advantage`;
  - a dodger with `incapacitated`, and a dodger that is `grappled` (Speed 0), give no source;
  - dodging holds through the other combatants' turns and ends with the dodger's next `turn.advance`, in the same `encounter.changed` that clears `reactionsSpent`;
  - `initiative.leave` of the dodger clears it;
  - `dodge` refuses `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN`, `UNKNOWN_COMBATANT` and `ACTOR_UNABLE`.

  The coverage meta-test passes: each new command type and `ACTION_SPENT` appear in a command test.
- **SC-003**: `packages/planner/test/economy.test.ts` covers: an active actor's `attack` ends with
  `action.spend` `action`, and its damage guards keep their step indices; `healing-word` ends with a
  `bonus-action` spend; `save`, `move`, `stand` and `end_turn` plan no spend; free mode and an
  off-turn actor plan no spend; an attack with a pull-in still ends with the spend; a used Action
  refuses `NO_ACTION_LEFT` before the handler (an out-of-reach target still gets `NO_ACTION_LEFT`);
  a used Bonus Action refuses `NO_BONUS_ACTION_LEFT` while an Action `cast` still plans; a `check`
  with no DC under a used Action refuses rather than asking; a ruling accept replans with a spend.
  `actionCostOf` matches the cost table for every `INTENT_KINDS` member.
- **SC-004**: `packages/planner/test/refusals.test.ts` lists both codes in `PLANNER`, each with a golden case.
- **SC-005**: FR-023 and FR-024 pass. FR-024 runs on the worktree's stack with `REQUIRE_DATABASE=1`.
- **SC-006**: `kinds.test.ts` asserts 29 served and 11 unserved. A `dodge` Intent plans
  `[dodge, action.spend]` in an encounter on the actor's turn, and `[dodge]` with no encounter. The
  gate's `KIND_UNSERVED` test uses `delay` (owner `Q5`) in place of `dodge`.
- **SC-007**: `pnpm ci:check` is green. `node scripts/check-boundaries.mjs` exits 0. The wiki plan
  prints nothing. The wiki freshness gate prints `OK`.

## Scope

- **In**: the engine `economy` record, `action.spend`, `ACTION_SPENT`, `actionsLeft`; the engine
  `dodging` list, `dodge`, `isDodging` and its four roll sources; `SPELLS` `castingTime`; the
  planner cost table, check, spend and `dodge` handler; the `dodge` engine status in
  `packages/intent`; the two replay tests; contract amendments; wiki.
- **Out**: Extra Attack and Multiattack (OQ-1). The one-slot-spell-per-turn rule (OQ-2). Class
  Bonus Actions such as Cunning Action and Second Wind (no seed character has one at level 1).
  Pips in the web (TASK-0275). Reactions offered to players (TASK-0276). A CI scenario move (OQ-3).
  Any change to `monster-policy.ts`, the harness or the web.

## Open questions

- **OQ-1**: Extra Attack (Fighter 5) and monster Multiattack. Neither is modelled, so one Action is
  one attack. Default: out of this card. Recommend the orchestrator card "attacks per Attack action"
  with a trigger: the first seed with a level-5 martial character or a stat block with Multiattack.
- **OQ-2**: SRD 5.2.1 spellcasting allows one spell with a spell slot per turn. The rule is not in
  `packages/srd/data/rule.json`, so this spec does not cite a record id. Today a Bonus Action
  `healing-word` and an Action leveled spell can both spend slots in one turn. Default: out of this
  card. Recommend a card with a trigger: the first seed caster with a leveled Action spell and a
  leveled Bonus Action spell together.
- **OQ-3**: The CI scenario cannot send a typed Intent in turn mode. Default: no harness change here.
  Recommend the orchestrator append to TASK-0349 AC #1: the scripted reed-camp fight sends a second
  `/attack` in one turn and asserts the `NO_ACTION_LEFT` refusal entry.
- **OQ-4**: Existing tests may plan two costed Intents for one combatant in one turn (a companion
  `turn` list, a multi-stage interpret reading in turn mode). The rule now refuses the second.
  Default: change the fixture to one costed Intent per turn, never the rule. The implementer lists
  each changed fixture in the commit message.
