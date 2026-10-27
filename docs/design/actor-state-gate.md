# Actor-state rule gate: design inventory

- **Card:** TASK-0135, acceptance criterion #1 (the inventory). Criteria #2–#4 follow the
  operator's ruling at checkpoint C3 (`docs/design/m3-table-sweep-runbook.md`, branch
  `sweep-m3-runbook`).
- **Escape line:** E3. This inventory and the later decision record stand in for a spec set.
- **Verified against:** branch `task-0135-actor-state-gate`, cut from `origin/main` `a4aab3c`.
  Every `file:line` below refers to that tree.
- **Status:** draft for checkpoint C3. Nothing here is decided. Section 3 holds the question
  for the operator.

## Terms

- **Actor:** anything with tracked stats. Today that is a party member with a combatant, or an
  engine combatant (a monster added by `combatant.add`). A seed NPC has no tracked state
  outside an encounter.
- **Actor state:** per actor, what the engine tracks: HP (current, max, temp), life state
  (`conscious`, `unconscious`, `stable`, `dead`; `packages/dnd5e-engine/src/schema/state.ts:9-14`),
  conditions with expiry, death saves, hit dice, spell slots, AC, defenses, initiative.
- **Stage state:** table mode and active actor, the encounter (order, round, active
  combatant), the scene, trackers.
- **Untracked:** position, range, presence in the scene (arrived, fled, surrendered),
  disposition, action economy, items (the clapper). None of these exist in engine state.
- **Gate:** a deterministic check in code that refuses or replaces an output.
- **Audit:** the model call `dm.audit`. It judges; it is not a gate.

## 1. Inventory

Seven `dm.*` purposes (`apps/server/src/dm/purposes.ts:7-15`). Two other gateway callers sit
outside the DM runtime and outside this card: the rules answerer (`library/answer.ts:329`,
rules text, no world state) and the playtest auditor `playtest.audit` (offline judge of a
captured run).

Most prompts render state through one helper, `projectionEntries`
(`apps/server/src/dm/prompts/common.ts:168-223`). It writes one line for table mode, one line
per party member (HP, AC, life state, conditions, sheet mods, attacks) and one line for the
encounter order (initiative, HP and life state per combatant, but no conditions, no AC and no
display name). The section is capped at 800 tokens and cut from the end
(`common.ts:22`), so in a large party the encounter line is the first to go.

### 1.1 Pre-generation selection (code, no model)

These decide who gets a model turn before any model runs.

| Check | Where | Scope |
|---|---|---|
| NPC turn only when the active combatant is `conscious` | `nodes/assemble.ts:151` | active combatant |
| Companion skipped when `dead`, `unconscious` or `stable`, or when no scene is set | `companion.ts:114-124` | that companion |
| Present NPCs: every NPC of every seed beat, with no state | `nodes/assemble.ts:270-275` | seed, not state |
| Declare permission: control of the character only, life state ignored | `packages/session-model/src/gate/permissions.ts:59-72` | declarer |
| Turn advance skips `dead` only; unconscious PCs keep turns for death saves | `packages/dnd5e-engine/src/commands/encounter.ts:187-215` | encounter order |
| Monsters die at 0 HP; PCs make death saves | `dm/seed/combatants.ts:27` | monsters |

### 1.2 Per output

| Output | Actor state received | Stage state received | Deterministic gates | Rides only on the model, or nothing | Actor scope |
|---|---|---|---|---|---|
| **`dm.director`**: hold, table mode, trackers, scene end, pacing, `goalNote`, companion prompts (`nodes/schemas.ts:196-248`) | `projectionEntries` with trackers (`prompts/director.ts:71-76`) | Table mode, encounter, runnable encounters with triggers, seed beats, transcript tail of 20, beat (`prompts/director.ts:59-94`) | Schema; reason caps (`nodes/director.ts:89-101`); `legalizeDirector` (`nodes/director.ts:104-227`): scene start holds nothing, a hold needs free mode and a free AI companion, turn mode only from free mode into a runnable encounter, free mode only from turn mode, trackers must exist, scene end needs a scene, companion prompts only in free mode | Whether opposition is beaten before `to: "free"`; whether the goal is met before scene end; whether a tracker's advance-when happened; spotlight on a downed hero; `goalNote` text, which reaches narrate as a "Private note" (`prompts/narrate.ts:173`). `dm.audit` never sees Director output | Every actor in the projections, cut at 800 tokens |
| **`dm.interpret`**: readings and steps (`nodes/schemas.ts:120-194`) | `projectionEntries` without trackers (`prompts/interpret.ts:89-94`); NPC turn id and SRD id; ledger rows already applied | Seed, transcript tail, director pacing and note, beat | Schema with closed lists for abilities, skills, conditions and damage types (`nodes/schemas.ts:24-79`, `prompts/step-grammar.ts:23-26`); readings must match the beat (`nodes/interpret.ts:51-66`); at resolve the engine refuses an unknown combatant or a `dead` attacker, target or checker (`commands/attacks.ts:15-35`, `:98-103`), a bad dice expression, a missing d20 term, an unknown AC, a condition or HP change on the dead (`commands/conditions.ts:43,104`, `commands/hit-points.ts:190`) | An `unconscious` or `stable` attacker or checker is not refused (`attacks.ts:27-33` tests `dead` only); the modifier and DC are model numbers (TASK-0104); spells (TASK-0105); whether a roll is warranted (D14 point 3 is prompt text, `prompts/interpret.ts:56`); range, presence and hostility (untracked) | Party plus encounter order |
| **`dm.adjudicate`**: ruling text, citations, steps (`nodes/schemas.ts:251-270`) | `projectionEntries` (`prompts/adjudicate.ts:58-63`) | None beyond the action and the rules question | Citations verified in code, unverified ones dropped and the ruling marked improvised (`nodes/adjudicate.ts:144-175`); steps take the same engine gates as interpret | Ruling text: it lands in a DM journal entry (`nodes/resolve.ts` ruling group) and reaches narrate as a fact line (`prompts/narrate.ts:89-93`) with no check against state | Party plus encounter order |
| **`dm.narrate`**: player-facing prose (`nodes/narrate.ts`) | **No actor snapshot.** `NarrationFacts` (`facts.ts:90-119`): this turn's rolls, HP, life-state and condition changes, events, party names and controllers, and `npcNames`, which lists every seed NPC and every non-party engine combatant with no life state (`facts.ts:497-503`). Prior state reaches it only through the public transcript tail | Scene-start framing, mode change, scene ended, pacing, `goalNote` (`prompts/narrate.ts:152-182`) | `deterministicChecks` (`nodes/audit.ts:190-301`), eight checks, all blocking: digits; dice words when no roll; death words with no death fact this turn; unconscious words with no down fact this turn; a recorded death or down omitted; a single-outcome actor paired with the opposite word within two words (`audit-words.ts:49-59`); length, list and either-or; clarify ends on a question; dice lines equal the renderer's | Who died or dropped: the death and unconscious checks match words, not actors (`audit.ts:229-250`). Actors acting, speaking or present while dead, down or gone. Counts and quantifiers ("two down", "no goblins left"). Everything else rides on `dm.audit` | **This turn's facts only** |
| **`dm.audit`**: verdict and issues (`nodes/audit.ts:55-67`) | The same `NarrationFacts` and the prose (`prompts/audit.ts:38-42`) | Same | Schema; blocking derived in code: `ledger-mismatch`, `invented-mechanics`, and `player-agency` only when the detail names a party member (`nodes/audit.ts:73-143`); three attempts, then the code fallback `factualSummary` (`fallback.ts:156`) | It is the model check itself. It cannot see prior state either, which is why the M2 playtest auditor and this one disagree on presence (F52, below) | **This turn's facts only** |
| **`dm.companion`**: `say`, `comment`, `act` (`companion.ts:25-37`) | `projectionEntries` (`prompts/companion.ts`), own sheet, open and committed actions | Scene, table mode, whether it is this companion's turn | Self life-state skip (`companion.ts:114-124`); gate permission (`permissions.ts:47-72`); a comment must name an open action (`companion.ts:210-213`); the active companion is forced to act and commit (`companion.ts:168-173`); `act` later runs the full pipeline | `say` ships as public in-character talk with no check of any kind, not even `dm.audit` (`companion.ts:200-207`) | Every actor in the projections |
| **`dm.chronicle`**: journal entries, public or DM (`chronicle.ts:23-35`) | **None.** Transcript slice, roster, tracker names, goal (`chronicle.ts:93-98`) | None | Schema; entry id dedupe; gate journal permission (`chronicle.ts:117-141`) | All content, public entries included (TASK-0109: distinct combatants) | Transcript only |

Two structural facts sit under the table:

- **Director moves land before the beat's dice.** `resolve` runs the Director group first
  (`nodes/resolve.ts:858`), which can end the encounter and set free mode
  (`resolve.ts:670-679`, `:746-749`), then the action groups (`resolve.ts:893`).
- **Removal has a mechanism and no producer.** The engine has `combatant.remove`
  (`packages/dnd5e-engine/src/schema/commands.ts:121`) and facts render `combatant-left`
  (`facts.ts:374-376`), but no step, effect or Director field can emit it
  (`nodes/schemas.ts:95-157`, `:196-248`). Flight and surrender exist only in prose.

## 2. Gaps

Each gap names the case, the missing gate, and the evidence.

**G1. Narration is checked against this turn, not against the actors.** The narrator gets no
snapshot, and the checks are actor-anonymous. A combatant dead since an earlier turn can be
narrated acting; a casualty count can be invented.
- M2 demo `docs/design/m2-demo/demo-session/transcript.jsonl` seq 225: the goblin shrieks
  "Two down! Two of ours down" when the engine records one death (goblin-3, 7→0 HP, seq
  220; `transcript.md:500`). It shipped.
- TASK-0106 rerun `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/classification.md:27`,
  row 162: Tamsin at 0 HP narrated as aware. Only `dm.audit` caught it.

**G2. Presence is not state, so plot moves by prose.** Flight, surrender and handover are
narrated with no fact, and a later claim about them cannot be checked either way.
- M2 seq 296–301: Kestrel's "daring it to pick a fight" resolved `no-effect` (no roll). The
  narration (seq 299) has the goblin bolt, Snag drop the clapper and the fire goblin flee.
  The Director then ended the encounter with the reason "Snag and both remaining goblins have
  fled" (seq 301). goblin-2, goblin-4 and Snag are still alive in engine state.
- M2 F52 (`docs/design/m2-demo.md:245`, seq 307): "No goblins left to fight for it now." The
  auditor failed it; the operator ruled it a false positive from the Director's reason text.
  No gate could decide it, because presence is not state.
- Run 183818Z row 258: the goblin lookout "isn't there anymore" with no fact; `dm.audit` caught it.

**G3. The Director's plot moves outrun the dice and ignore actor state.** `legalizeDirector`
checks mode legality, not whether opposition remains, and the Director group lands before
the actions it depends on.
- TASK-0110, run `verify-20261026T183818Z` seq 260–265: Odo declared a bargain. The Director
  ended the encounter ("Morale condition met … Odo's bargain closes the encounter", seq 263)
  before any roll. The action then resolved `refused` (`UNKNOWN_COMBATANT`, seq 264), and the
  fallback said "Brother Odo cannot do that here." The bargain succeeded with no dice, and
  the action that caused it was recorded as refused.

**G4. No life-state gate on who acts.** The declare permission ignores life state
(`permissions.ts:59-72`). The engine refuses only `dead` actors (`attacks.ts:27-33`), so an
unconscious attacker or checker resolves.
- TASK-0112, run 192319Z seq 201 and 216: the seat kept declaring for Tamsin at 0 HP. The
  gate accepted, interpret planned, and the narrator was left to say she could not act.

**G5. Two model outputs ship with no state check at all.** Companion `say` is public talk with
no gate and no audit (`companion.ts:200-207`). Chronicle entries, public ones included, see
no state (`chronicle.ts:93-98`). No M2 contradiction from companion talk was found; the gap
is structural. TASK-0109 covers chronicle identity only.

**G6. State in prompts can be cut silently.** `projectionEntries` drops lines from the end
under the 800-token cap (`common.ts:22`, `:168-223`), and the encounter line comes after
every party line. The encounter line omits monster conditions and AC (`common.ts:203-213`).
No run has hit the cap yet; the gap is structural.

**G7. Model-chosen numbers.** Modifiers, DCs and spell numbers are model text (TASK-0104,
TASK-0105). This gap is carded and is listed only for completeness.

## 3. The operator's proposed hard rule

Quoted on the card: "The LLM can add flavor or advance plot only in response to dice-rolls
and those LLM-generated results must pass rule gates which take into account all trackable
actors in the input."

The rule has two clauses:

- **Clause A, the trigger:** flavor and plot only in response to dice rolls.
- **Clause B, the gate:** every model result passes rule gates over all trackable actors.

Clause B conflicts with nothing. It is the missing half of decision-0017's "ordering is the
anti-cheat": numbers are already engine-owned, and actor state is not yet checked. Clause A
conflicts with or leaves open the following.

### 3.1 Conflicts and terms to define

| Point | Today | Literal clause A |
|---|---|---|
| decision-0022 point 3: no stakes, no roll; a retry with no new risk succeeds without a roll | interpret writes a `none` step; the action resolves `no-effect` and narration shows it succeed (`prompts/interpret.ts:56`, `prompts/narrate.ts:27`). M2 seq 304–307: "I grab the clapper" succeeds with no roll | The success cannot be narrated: no die. Either D14 point 3 is amended or "dice roll" must include an engine-recorded outcome with no roll |
| Scene framing | Scene start narrates the seed's opening framing with no roll (`prompts/narrate.ts:155-161`) | Forbidden unless carved out |
| Narrator talk chime-in (decision-0016; TASK-0052) | Not built. decision-0016 says talk "cannot roll or move anything" | Talk has no die, so the narrator could never chime in, or talk needs a carve-out as flavor that advances no plot |
| NPC reactions | "Every other character is part of the world. Give them words, moves and reactions" (`prompts/narrate.ts:26`) and "show what the world does with it" (`:27`) | An NPC yielding, fleeing or handing over to a no-roll action (M2 seq 299) is forbidden |
| Companions | A companion is a player-equivalent seat (`companion.ts:18-23`). Its `act` is a declaration, not an outcome | Ambiguous: a companion's speech is model text but not DM authority. Needs a ruling on whether clause A applies to a seat |
| Director plot moves | Encounter start on a fiction trigger, encounter end on morale, tracker advance, scene end: none rolled | Every one needs a die, or a carve-out. Morale has no rule in the project yet; TASK-0055 and TASK-0122 carry the DMG optional combat rules |
| Flavor intensity (decision-0022 point 7) | Not built | Compatible: flavor keyed to the natural die |
| Code fallback (`fallback.ts:156`) | Code, not model | Out of scope: not LLM-generated |

Terms the ruling must fix:

1. **Plot:** proposed definition: a change to any actor's tracked state or presence, or to a
   tracker, the encounter, the table mode or the scene. Everything else is flavor.
2. **Trackable actor:** whether seed NPCs become actors with state (presence at least), or
   only engine combatants count.
3. **In the input:** every actor in the scene, or only actors this turn touched. Clause B as
   quoted says all.
4. **In response to dice:** this turn's rolls only, or any recorded engine outcome.

### 3.2 Formulations for the ruling

Every formulation keeps clause B as written: each model output passes a deterministic gate
over a snapshot of every tracked actor and the stage, and the gate refuses an output that
asserts a state the snapshot contradicts.

**Formulation 1 — Dice only (literal).** Only a die roll recorded this turn may change plot.
A no-roll outcome is narrated as an attempt with no change.
- Amends decision-0022 point 3: a certain outcome or a no-risk retry must roll anyway, or it
  achieves nothing. That reintroduces "roll for everything", which D14 point 3 exists to stop.
- "I grab the clapper" (M2 seq 304) needs a roll or fails to happen.
- Scene framing and talk need explicit carve-outs as flavor.
- Director encounter end, tracker advance and scene end each need a roll or a carve-out. A
  morale rule must exist first.
- Simplest gate: a plot change with no roll row in the same batch is refused.

**Formulation 2 — Ledger only.** The model may change plot only through a fact the ledger
records: a die result, or an engine outcome reached without a roll under decision-0022
point 3. Prose may add flavor but may not assert any actor or stage state that the ledger
does not record.
- Keeps decision-0022 point 3, and makes it binding in code: a no-roll success becomes a
  recorded outcome, not a narrated one (TASK-0127 already plans "resolves without a roll").
- Scene framing is allowed as seed-authored content. Talk is flavor and changes nothing
  (matches decision-0016).
- M2 seq 299 is refused: the goblin cannot bolt and Snag cannot drop the clapper without a
  recorded fact. A producer for presence changes must exist (`combatant.remove`, or a new
  presence fact) before the Director may end an encounter by flight.
- Weakness: the DM may still grant an opposed outcome without a roll, as long as it records
  it. The Odo bargain (G3) would pass if the Director recorded "fled".

**Formulation 3 — Ledger only, and opposition needs dice.** Formulation 2, plus: a plot change
to any actor other than the acting one (harm, a condition, flight, surrender, a handover, a
change of disposition) needs a die roll against that actor, or an SRD rule that decides it
without one.
- Keeps decision-0022 point 3 for uncontested effort: "I grab the clapper" succeeds with no
  roll; "dare it to fight" rolls (Intimidation against the goblin) before the goblin bolts.
- Fixes G3 by rule: Odo's bargain needs a Persuasion check against Snag before the encounter
  ends.
- Meets decision-0022 point 5 (opposition as a DC derived from the opponent; TASK-0128).
- Director encounter end needs either a beaten opposition in state (all hostile actors dead,
  down or removed) or a roll. Scene framing and talk are as in Formulation 2.
- Cost: "other than the acting one" is a code test over the effect's target ids, so the gate
  stays deterministic. Deciding that a declaration is contested stays an interpret judgment;
  the gate checks only that no unrolled change touched another actor.

## 4. Candidate design pattern

### 4.1 Shape

1. **A typed actor snapshot.** Code builds one `ActorSnapshot` from projections and seed.
   Each actor carries its id, names and aliases, kind (party, monster, NPC), controller, HP,
   life state, conditions, initiative, resources, and, once ruled, presence. The stage
   carries table mode, active actor, encounter round, scene and trackers. Every prompt
   renders state from it instead of `projectionEntries` and `npcNames`. A cap compresses
   dead or absent actors to one line; it never drops an actor silently (G6).
2. **Input gates (before a model runs).** Who may act: the declare gate refuses a
   non-conscious character (G4); NPC turn and companion skip stay. Director legality reads
   the snapshot: free mode and encounter end need beaten opposition or a recorded roll; the
   spotlight never lands on a downed actor (G3).
3. **Plan gates (after interpret and adjudicate, before resolve).** Every step's actor and
   target must exist, be present and be able. The engine refuses an unconscious, stable or
   incapacitated attacker or checker, alongside the existing `TARGET_DEAD` (G4).
4. **Output gates (after generation, before ship).** A claim checker keyed to snapshot
   aliases tests every shipped text: narrate prose, companion `say`, public chronicle entries,
   and the ruling and `goalNote` text that reach narrate. It refuses a dead, down or absent
   actor shown acting or speaking; a death or drop named on the wrong actor; a count or
   quantifier that disagrees with the snapshot ("two down", "no goblins left"). A refusal
   feeds the existing regenerate loop and code fallback (`nodes/audit.ts`). `dm.audit` gets
   the snapshot too (G1, G2, G5).
5. **The ruled formulation's trigger rule** runs as an output gate on the resolve batch:
   under Formulation 1 or 3, a plot change with no qualifying roll row is refused.

### 4.2 Place in the pipeline (decision-0017 order)

```
assemble ── snapshot S0
  → director ── legalize against S0                      (input gate)
  → interpret → adjudicate
  → plan gate against S0                                  (plan gate)
  → resolve: action groups, then the Director group       (order change, TASK-0110)
  ── snapshot S1 (post-resolve)
  → narrate with S1 and the S0→S1 diff
  → output gate against S1 → dm.audit with S1 → ship or regenerate or fallback
companion job: snapshot → companion → output gate on say → gate.submit
chronicle job: snapshot at throughSeq → chronicle → output gate on public entries → gate.submit
```

The order keeps decision-0017's anti-cheat and extends it: dice before narration, and now
actor state before every model output and every model output against actor state. Moving the
Director group after the action groups is a change to `resolve`; the decision record must
state it as an amendment to decision-0017.

### 4.3 Which card implements which rule

| Rule | Card |
|---|---|
| A committed action whose own effect ends the encounter resolves `applied`; Director group after action groups | TASK-0110 |
| Declare gate refuses a non-conscious character; seat stops declaring | TASK-0112 (gate half ruled here) |
| Modifiers and DCs from stats; the snapshot carries stats | TASK-0104 |
| Spells by SRD id | TASK-0105 |
| No-roll outcomes as recorded facts (D14 point 3) and outcome bands | TASK-0127 |
| Opposition rolls against the opponent (Formulation 3) | TASK-0128 |
| NarrationFacts shape and the allowed involuntary effects | TASK-0113 |
| Narrate and audit wording for NPC reactions (`prompts/narrate.ts:26-27`) to the ruled formulation | TASK-0130 |
| Chronicle keeps distinct combatants distinct | TASK-0109 |

No card covers these. The decision record must card each one:

- **U1.** The `ActorSnapshot` type, built once and rendered in every prompt. Every other rule
  reads it, so it is the natural first implementation card (AC #4).
- **U2.** Presence as tracked state, with a producer: a step effect or Director field that
  emits `combatant.remove` or a new presence fact.
- **U3.** The output gate: the actor-aware claim checker over shipped text.
- **U4.** A gate on companion `say`.
- **U5.** Director legality over actor state (beaten opposition, downed spotlight, scene-end
  goal).
- **U6.** Engine refusal of an unconscious, stable or incapacitated attacker or checker.
  TASK-0112 asks the question but scopes the gate, not the engine.
- **U7.** `dm.audit` receives the snapshot.

## Open questions for the orchestrator

- **Seed NPCs as actors.** Clause B says "all trackable actors". Seed NPCs have no state
  outside an encounter. Whether they get presence state in m-3 or with the codex (m-4) needs
  a ruling or a card.
- **Position and range.** Untracked. No rule here depends on them, but "all trackable
  actors" will. Card a revisit task with a trigger, per decision-0020.
