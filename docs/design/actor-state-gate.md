# Actor-state rule gate: design inventory

- **Card:** TASK-0135, acceptance criterion #1 (the inventory). Criteria #2–#4 follow the
  operator's ruling at checkpoint C3 (`docs/design/m3-table-sweep-runbook.md`, branch
  `sweep-m3-runbook`).
- **Escape line:** E3. This inventory and the later decision record stand in for a spec set.
- **Verified against:** branch `task-0135-actor-state-gate`, cut from `origin/main` `a4aab3c`.
  Every `file:line` below refers to that tree.
- **Status:** decided. The operator ruled at checkpoint C3 on 2026-10-26: **Formulation 3
  (ledger plus opposition dice) is adopted**; seed NPCs get minimal scene presence state in
  M3; position and range are revisit TASK-0139. The binding record is decision-0025 (D17,
  `backlog/decisions/decision-0025 - D17-Actor-state-rule-gate-…md`). Where this inventory
  and decision-0025 differ, decision-0025 wins. Sections 1–4 are the inventory as presented
  at C3; section 5 lists the cards to create.

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

**Formulation 1 — Dice only (literal).** *Not adopted.* Only a die roll recorded this turn may change plot.
A no-roll outcome is narrated as an attempt with no change.
- Amends decision-0022 point 3: a certain outcome or a no-risk retry must roll anyway, or it
  achieves nothing. That reintroduces "roll for everything", which D14 point 3 exists to stop.
- "I grab the clapper" (M2 seq 304) needs a roll or fails to happen.
- Scene framing and talk need explicit carve-outs as flavor.
- Director encounter end, tracker advance and scene end each need a roll or a carve-out. A
  morale rule must exist first.
- Simplest gate: a plot change with no roll row in the same batch is refused.

**Formulation 2 — Ledger only.** *Not adopted.* The model may change plot only through a fact the ledger
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

**Formulation 3 — Ledger only, and opposition needs dice. ADOPTED at checkpoint C3 (decision-0025).** Formulation 2, plus: a plot change
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

Superseded by section 5.2, which maps decision-0025's rules. The table below is the C3 draft.

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

No card covers these. Section 5 cards each one:

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


## 5. Decision and cards

### 5.1 The ruling

Decision-0025 (D17) records the operator's words and the C3 choices. It adopts Formulation 3:

- Plot moves only through a recorded fact: a die result, an engine event, or a no-roll
  outcome row under decision-0022 point 3.
- A change to an actor other than the acting actor needs a roll against that actor in the
  same batch, or an SRD rule the engine codes.
- Uncontested effort needs no roll. Scene framing and talk are flavour and may not assert
  unrecorded state.
- `resolve` runs the action groups before the Director group (amends decision-0017).

The two open questions of the C3 draft are closed. Seed NPCs get scene presence in M3 (card
U8 below). Position and range are revisit TASK-0139. "Scene presence" (`present`, `yielded`,
`absent`) is distinct from decision-0024's player connection presence.

### 5.2 Rule-to-card table

Rule numbers refer to decision-0025.

| Rule (decision-0025) | Card |
|---|---|
| §1 ActorSnapshot built in code; every node receives it | **U1 (TASK-0140)** (new) |
| §1.6 No silent drop under the token cap | **U1 (TASK-0140)** (new) |
| §2.1 Plot only through a recorded fact; §2.2 other-actor change needs a roll or SRD rule; §2.4 deterministic batch test (§3.3) | **U9 (TASK-0147)** (new) |
| §2.2 The opposition roll against another actor (derived DC) | TASK-0128 |
| §2.3 Uncontested effort resolves as a no-roll outcome row | TASK-0127 (AC #5) |
| §2.5 Director stage changes need a basis in state; no spotlight on a downed or absent actor (§3.1) | **U5 (TASK-0145)** (new) |
| §2.6 Scene framing and §2.7 talk as flavour, in narrate and audit doctrine | TASK-0113 (scene start), TASK-0130 (NPC reactions and talk wording) |
| §3.1 Declare gate refuses a non-conscious or absent character | **U6 (TASK-0112)** (new; recommended as added ACs on TASK-0112) |
| §3.1 Playtest seat stops declaring for a downed hero | TASK-0112 (AC #1); its AC #2 is answered by decision-0025 |
| §3.2 Plan gate: step actor and target exist and are not absent; engine refuses an unconscious, stable or incapacitated actor | **U6 (TASK-0112)** (new) |
| §3.4 Output claim gate over narrate prose, ruling text and `goalNote` | **U3 (TASK-0143)** (new) |
| §3.4 Claim gate on companion `say` and public chronicle entries | **U4 (TASK-0144)** (new) |
| §3.5 `dm.audit` receives S1 | **U7 (TASK-0146)** (new) |
| §4 Resolve order: action groups before the Director group | TASK-0110 |
| Scene presence as tracked state with a producer | **U2 (TASK-0141)** (new) |
| Seed NPCs carry minimal scene presence (C3 ruling) | **U8 (TASK-0142)** (new) |
| Numbers from the sheet; the snapshot carries stats | TASK-0104 |
| Spells by SRD id | TASK-0105 |
| Allowed involuntary effects in NarrationFacts (decision-0022 point 1) | TASK-0113 |
| Chronicle keeps distinct combatants distinct | TASK-0109 |
| Position and range | TASK-0139 (revisit) |

### 5.3 Cards to create

The orchestrator creates these cards on `main`. Each card's spec cites decision-0025 and
names the rules it implements (runbook merge condition for Track C).

**U1 (TASK-0140). Actor snapshot: one code-built state view for every DM node**
- Outcome: code builds an `ActorSnapshot` from the projections and the seed, and every DM
  node renders state from it. This is the first implementation card (TASK-0135 AC #4).
- Acceptance criteria:
  1. An `ActorSnapshot` type carries, per actor, id, display name, aliases, kind, controller,
     HP, life state, conditions, initiative, resources and scene presence; and the stage.
  2. `assemble` builds S0 and `resolve` builds S1 plus the S0-to-S1 diff, with tests.
  3. Director, interpret, adjudicate, narrate, audit, companion and chronicle prompts render
     state from the snapshot; `projectionEntries` and `npcNames` are retired.
  4. Under the token cap, dead and absent actors compress to one line; no actor is dropped,
     with a test over a large party and encounter.
  5. A snapshot that cannot fit fails the node loudly, with a test.
  6. Existing dm tests and the scripted CI playtest stay green.
- Dependencies: none. Scene presence fields are present but default to `present` until U2.

**U2 (TASK-0141). Scene presence as tracked actor state, with a producer**
- Outcome: an actor's scene presence (`present`, `yielded`, `absent`) is a logged fact, and
  only a resolved step can change it.
- Acceptance criteria:
  1. A catalogued event records a scene presence change with actor id, new value and reason
     (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`).
  2. A step kind lets interpret and adjudicate propose a presence change; the gate applies it
     only through the engine, with tests.
  3. An `absent` combatant leaves the encounter order through `combatant.remove`.
  4. The snapshot reads scene presence from the log.
  5. No Director field writes scene presence, with a test.
- Dependencies: U1.

**U3 (TASK-0143). Output claim gate: actor-aware checks over shipped narration**
- Outcome: a deterministic checker keyed to snapshot aliases refuses shipped text that
  contradicts actor state.
- Acceptance criteria:
  1. The checker refuses a dead, downed or absent actor shown acting or speaking, with tests
     over M2 seq 225 and run 192319Z row 162.
  2. It refuses a death or drop named on the wrong actor.
  3. It refuses a count or quantifier that disagrees with the snapshot ("two down", "no
     goblins left"), with a test over M2 seq 225 and F52.
  4. It runs on narrate prose and on the ruling and `goalNote` text that reach narrate.
  5. A refusal feeds the existing regenerate loop and code fallback.
  6. The actor-anonymous word checks in `audit-words.ts` are replaced or keyed to actors.
- Dependencies: U1, U2, U8.

**U4 (TASK-0144). Claim gate on companion `say` and public chronicle entries**
- Outcome: the two model outputs that ship with no state check pass the U3 checker.
- Acceptance criteria:
  1. Companion `say` passes the claim gate before `gate.submit`; a refusal drops or
     regenerates it, with a test.
  2. Public chronicle entries pass the claim gate against the snapshot at `throughSeq`, with
     a test.
  3. DM-only chronicle entries are not gated and say so in the contract.
- Dependencies: U3; TASK-0109 (same chronicle footprint, merge after it).

**U5 (TASK-0145). Director legality over actor state**
- Outcome: `legalizeDirector` reads the snapshot and refuses stage changes the state does not
  support.
- Acceptance criteria:
  1. Free mode and encounter end are refused unless every hostile actor is dead, unconscious,
     stable, `yielded` or `absent`, with a test over run 183818Z seq 260-265.
  2. A tracker advance and a scene end must cite a recorded fact from the turn; one with no
     valid citation is refused, with tests.
  3. The spotlight and companion prompts never name a downed or absent actor, with a test.
  4. A refused Director move is logged and does not block the turn.
- Dependencies: U1, U2, U8, TASK-0110.

**U6 (TASK-0112). Able-actor gates: declare and engine refuse a downed or absent actor**
- Outcome: no downed or absent actor reaches a model or the engine as an actor.
- Recommended delivery: as added acceptance criteria on TASK-0112, whose runbook row (C4)
  already names the gate half. A separate card only if the orchestrator prefers.
- Acceptance criteria:
  1. The declare gate refuses a character that is not `conscious` or is `absent`, with a
     refusal code and a test.
  2. The engine refuses an unconscious, stable or incapacitated attacker or checker, beside
     the existing dead-actor refusals, with engine tests.
  3. A plan gate refuses a step whose actor or target is missing from S0 or `absent`.
  4. Death-save turns for unconscious PCs still run.
- Dependencies: none for criteria 1, 2 and 4; criterion 3 needs U1 and U2.

**U7 (TASK-0146). `dm.audit` receives the actor snapshot**
- Outcome: the model auditor judges prose against S1, not this turn's facts only.
- Acceptance criteria:
  1. The audit prompt renders S1 and the diff, with a prompt test.
  2. A regression over F52 (M2 seq 307) shows the auditor's verdict follows recorded scene
     presence.
  3. Blocking derivation in code is unchanged.
- Dependencies: U1; U2 for criterion 2.

**U8 (TASK-0142). Seed NPCs carry minimal scene presence**
- Outcome: every seed NPC is an actor in the snapshot with scene presence, so claims about it
  can be checked. Richer NPC records stay with the Codex (M4).
- Acceptance criteria:
  1. A seed declares each NPC's initial scene presence per beat, with a schema test.
  2. Seed NPCs appear in the snapshot with id, name, aliases, kind `NPC` and scene presence.
  3. A seed NPC's scene presence changes only through U2's event, with a test over M2 seq
     296-301 (Snag stays present without a roll).
  4. A seed NPC that becomes a combatant keeps one identity across both.
- Dependencies: U1, U2.

**U9 (TASK-0147). Resolve batch gate: formulation 3 in code**
- Outcome: the resolve batch is refused when a plot change lacks a recorded fact, or when a
  change to another actor lacks a roll against that actor or an engine-coded SRD rule.
- Acceptance criteria:
  1. A change to another actor with no roll row naming that actor in the batch is refused,
     with a test over M2 seq 296-301.
  2. An engine-coded SRD rule (0 HP to unconscious; a willing ally accepting a beneficial
     effect) passes with no roll, with tests.
  3. An uncontested effort passes as a no-roll outcome row, with a test over M2 seq 304.
  4. The gate compares effect target ids with the acting actor; it reads no prose.
  5. A refused batch writes nothing and the action resolves `refused` with a refusal code.
- Dependencies: U1, U2, TASK-0110, TASK-0127, TASK-0128.

### 5.4 Recommended Track C order

This amends the runbook's Track C table (a checkpoint C3 runbook amendment). One card in
implementation at a time; TASK-0109 still floats.

| Order | Card | Why here |
|---|---|---|
| C1 | TASK-0135 | This decision. |
| C2 | TASK-0123 | Unchanged; `packages/srd` only. |
| C3 | U1 | Every other rule reads the snapshot. TASK-0135 AC #4 specs it. |
| C4 | TASK-0110 | Resolve order; U5 and U9 depend on it. |
| C5 | TASK-0112 with U6 | Able-actor gates; small; criteria 1, 2 and 4 need nothing new. |
| C6 | U2 | Scene presence and its producer. |
| C7 | U8 | Seed NPCs need U2's event. |
| C8 | TASK-0104 | Heaviest card; changes `StepSchema`. |
| C9 | U7 | Cheap once U1, U2 and U8 exist. |
| C10 | U3 | Needs aliases and presence for seed NPCs. |
| C11 | U4 | Reuses U3; after TASK-0109. |
| C12 | TASK-0128 | Depends on TASK-0104. |
| C13 | TASK-0105 | Depends on TASK-0104. |
| C14 | U5 | Needs U2, U8 and TASK-0110. |
| C15 | TASK-0111 | Narration audit; unchanged. |
| C16 | TASK-0113 | Unchanged. |
| C17 | TASK-0127 | Unchanged. |
| C18 | U9 | Needs TASK-0127 and TASK-0128. |
| C19 | TASK-0130 | Doctrine wording last, against the built gates. |
| float | TASK-0109 | Any time after C1; must merge before U4. |

The track grows by eight cards (U6 folded into TASK-0112). If the waves cannot carry it before
TASK-0053, the demo-critical subset is U1, TASK-0110, TASK-0112 with U6, U2, U8 and U3; the
orchestrator and operator rule on the rest at the wave boundary.

Adopted by operator ruling 2026-10-26; the demo (TASK-0053) runs after U1, TASK-0110, TASK-0112 (with U6), U2, U8 and U3.
