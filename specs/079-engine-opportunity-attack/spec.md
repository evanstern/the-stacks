# Feature Specification: Engine opportunity attack

**Feature Branch**: `task-0208-engine-opportunity-attack`

**Created**: 2026-11-02

**Status**: Draft. M3 runbook B, lane B1, spine #7.

**Input**: TASK-0208. "An opportunity attack happens only by the engine's reaction rule (leaving a
hostile's reach, with its reaction unspent), on the enemy's side, and the player reads it as the
enemy's reaction, not as their own action 'striking home'." Evidence: runbook A playtest run 1
(`docs/playtests/2026-11-02-runbook-a-playtest.md`, PR #109, finding 19, session `9296c653`,
seq 151–166).

I followed the Spec Kit templates by hand, in the shape of spec 073. The skills' branch and setup
scripts did not run, because the spec dir was already claimed with a stub. `speckit-clarify` was
skipped: the card, the run 1 log, SRD 5.2.1 and the code settle the behaviour. The scope calls the
card leaves open are open questions with a recommended default (see the end). This spec, plan.md
and tasks.md are written against each default.

## Background: what happens today

1. Kestrel, active in turn mode, declared "I run to Pell and attempt to free him."
2. The Director's goal note said "charge costs an opening (reaction swing) before she arrives".
3. Interpret made the action's only step an `attack` step with `attackerId: goblin-2` and
   `targetId: kestrel` (1d20+4 → 19 = 23 vs AC 14, hit, 4 slashing). It parked the free as a
   followUp. Nothing checked that Kestrel left the goblin's reach, and no reaction was tracked.
4. The fallback (`dm/fallback.ts` `rollSentences`) wrote "Kestrel strikes home. Kestrel is
   wounded." It names the action's character as the subject of every roll in the action, so the
   goblin's hit became Kestrel's.
5. Snag's next NPC turn narrated "Kestrel's blade finds the rope … a strand parting" (seq 166).
   The free never resolved. That beat's facts did not carry Kestrel's followUp, so nothing told the
   narrator it had not happened.

The engine (`packages/dnd5e-engine`) has no positions, no map and no reaction state. An
`attack.roll` is any attack anyone asks for.

## The rule (SRD 5.2.1)

- **Reactions** (`playing-the-game.actions.reactions`, p. 10): a Reaction is an instant response to
  a trigger, on your turn or another's. After you take one, you cannot take another until the start
  of your next turn. It happens right after its trigger unless its description says otherwise.
- **Opportunity Attacks** (`playing-the-game.combat.melee-attacks.opportunity-attacks`, p. 15):
  you can make one when a creature you can see leaves your reach. You take your Reaction to make
  one melee attack against that creature, right before it leaves your reach. Disengage, teleport
  and movement that does not use the mover's own movement, action, Bonus Action or Reaction
  provoke none.

## Answers to the brief's questions

- **Q1. What is "leaving reach" with no map?** A `move` step in the mover's own plan names, in
  `leavesReachOf`, each hostile the mover stands next to and moves away from without Disengage.
  Interpret names them from the fiction (the transcript, the narration, the snapshot). This is the
  runbook default (OQ-1 (a)). The engine records no adjacency.
- **Q2. What records engagement?** Nothing persistent. `leavesReachOf` is a step field, read once
  by resolve. The engine records only whether a combatant's reaction is spent.
- **Q3. How is a reaction spent and reset?** The engine's encounter gains `reactionsSpent`, a list
  of combatant ids. An `attack.roll` with `reaction: true` refuses when the attacker's id is in it
  (`REACTION_SPENT`) and adds it when the attack resolves. The id leaves the list at the start of
  that combatant's next turn (`turn.advance`, or an `initiative.leave` that hands on the turn).
  Ending the encounter clears it with the encounter.
- **Q4. Who decides to take an optional reaction for an NPC?** Code. It always takes the reaction
  when the rule allows (OQ-2 (a)). No model chooses. A party member's own reaction is the player's
  choice; this card takes none for them (OQ-3 (a), a deferred card).
- **Q5. Is the engine rule in scope, or only the interpret rule?** In scope. Card AC #1 and the
  runbook B merge condition both need the reaction to come from the engine with the goblin as its
  subject. The interpret line "A monster's reaction is never a step of a party member's action" is
  TASK-0113's (spec 074 plan D1, `NODE_LINE.interpret`). This card cites it, does not restate it,
  and adds the code guard behind it (FR-006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opportunity attacks come from the engine's rule (Priority: P1)

Kestrel pulls away from the pot-helm goblin on her turn. The goblin's reaction is unspent, so the
engine grants it one melee attack, with the goblin as attacker. A goblin she was never next to gets
nothing. A second move away from the same goblin in the same round gets nothing.

**Why this priority**: card AC #1 and the runbook B merge condition for TASK-0208.

**Independent Test**: engine command tests over `attack.roll` with `reaction: true` and over the
reset; a DB integration test replays run 1 seq 151–161 on the `greyhollow-ford-reed-camp` seed.

**Acceptance Scenarios**:

1. **Given** an active encounter with goblin-2 in the order and its reaction unspent, **When**
   Kestrel's action runs a `move` step with `leavesReachOf: ["goblin-2"]`, **Then** resolve submits
   `attack.roll` with `attackerId: goblin-2`, `targetId: kestrel`, `reaction: true`, before any
   later step of the action. The ledger holds `attack.resolved` with `attackerId: goblin-2` and
   `reaction: true`, and an `encounter.changed` row that adds goblin-2 to `reactionsSpent`.
2. **Given** goblin-2's reaction is spent, **When** a party member's `move` step names goblin-2
   again before goblin-2's next turn, **Then** no attack runs and the action goes on.
3. **Given** goblin-2's reaction is spent, **When** the turn advances to goblin-2, **Then** an
   `encounter.changed` row removes goblin-2 from `reactionsSpent`.
4. **Given** the engine, **When** an `attack.roll` with `reaction: true` names a spent attacker, an
   attacker outside the encounter order, no encounter, or a null attacker, **Then** the engine
   refuses (`REACTION_SPENT`; `UNKNOWN_COMBATANT` with reason `not-in-order`;
   `NO_ACTIVE_ENCOUNTER`; `INVALID_COMMAND`) and draws no die.
5. **Given** a `move` step that names a combatant who is not a seed encounter monster (a party
   member, a captive such as Pell), an unable combatant, or no encounter at all, **Then** no attack
   runs.
6. **Given** run 1's original plan (an `attack` step by goblin-2 inside Kestrel's action), **When**
   the plan gate runs, **Then** it refuses the group before any step runs, and no attack row is
   written.

---

### User Story 2 - The player's declared step resolves; the reaction is separate (Priority: P1)

Kestrel's free attempt runs as her own step, after the goblin's reaction. If the reaction drops
her, the engine refuses her step, as it refuses any unable actor today.

**Why this priority**: card AC #2.

**Independent Test**: the same integration test. The free attempt's `check.resolved` row names
Kestrel and follows the reaction rows in seq order. A narrate prompt test renders the reaction
apart from Kestrel's own rolls.

**Acceptance Scenarios**:

1. **Given** the US1 plan with a second step (a check for Kestrel to cut Pell's bonds), **When**
   resolve runs, **Then** the check resolves for Kestrel after the reaction rows, and the action
   resolves `applied`.
2. **Given** a reaction that misses, or hits without dropping Kestrel, **When** the action
   resolves, **Then** every declared step runs, as it would with no reaction.
3. **Given** a reaction that drops Kestrel to 0 HP, **When** her next step runs, **Then** the
   engine refuses it with `ACTOR_UNABLE` and the chain stops, as today.
4. **Given** the narration facts for that beat, **When** narrate's prompt is built, **Then** the
   reaction roll renders as a `reaction:` line naming goblin-2 as the attacker, apart from
   Kestrel's own `roll:` lines.

---

### User Story 3 - The fallback names the attacker (Priority: P1)

**Why this priority**: card AC #3.

**Independent Test**: a unit test builds the facts of run 1 seq 154–161 and asserts the fallback
text.

**Acceptance Scenarios**:

1. **Given** the facts of run 1 seq 154–161 (an attack roll by goblin-2 in Kestrel's action, a
   hit, 4 slashing on Kestrel), **When** the fallback is built, **Then** it holds "Goblin with a
   pot-helm strikes home." and "Kestrel is wounded.", and never "Kestrel strikes home".
2. **Given** a check rolled by the action's own character, **When** the fallback is built, **Then**
   the sentence names that character, as today.
3. **Given** an action whose only outcome was rolled by another combatant, **When** the
   deterministic audit runs, **Then** the opposite-outcome check does not pair the action's
   character with that outcome.

---

### User Story 4 - A followUp is never shown as done, in a later beat either (Priority: P1)

**Why this priority**: card AC #4 (run 1 seq 166).

**Independent Test**: a unit test over a pure helper that finds open followUps from earlier turn
checkpoints, and a narrate prompt test.

**Acceptance Scenarios**:

1. **Given** Kestrel's latest resolved action left the followUp "Kestrel cuts Pell's bonds" and she
   has declared nothing since, **When** Snag's NPC-turn facts are built, **Then** they carry that
   followUp as an earlier-beat open followUp for Kestrel.
2. **Given** those facts, **When** the narrate prompt is built, **Then** the facts section holds
   "earlier beat, not yet attempted: Kestrel: Kestrel cuts Pell's bonds", and the system prompt
   holds the rule that a not-yet-attempted step has not happened, in this beat or an earlier one.
3. **Given** Kestrel has declared a new action since, **When** facts are built, **Then** her old
   followUp is not carried.
4. **Given** this beat's own followUps, **When** narrate's prompt is built, **Then** they render as
   today ("not yet attempted").

---

### Edge Cases

- **Disengage, teleport, forced movement.** Interpret lists no hostile. No reaction runs.
- **A move in free mode or with no encounter.** No reaction runs. The step itself writes no row.
- **The reactor is unable** (unconscious, stable, incapacitated). No reaction runs (`canAct`).
- **The reactor has no SRD melee attack** (no SRD record, or ranged attacks only). No reaction
  runs; resolve logs `dm.reaction.skipped`.
- **A monster moves away from a party member on the NPC turn.** The party member's reaction is the
  player's choice. No reaction runs (OQ-3).
- **A monster moves away from another monster.** Not hostile. No reaction runs.
- **Two goblins named.** Each takes its own reaction, in `leavesReachOf` order.
- **A human DM seat.** A reaction attack is a `mechanics` proposal like any other. A pending one
  pauses the chain (`awaiting-dm`) and resumes through specs/057.
- **Reclaim.** Each reaction submission has its own key, so a reclaimed job replays it. A
  duplicate the engine refuses with `REACTION_SPENT` counts as "no reaction"; the chain goes on.
- **Old logs.** `reactionsSpent` and `reaction` are optional. Logged events parse and replay
  unchanged.
- **Snag's own plan text claims the free happened.** The fallback voices an NPC's plan reason
  (`plannedSentence`). This card adds the open followUp to the facts, which covers the narration
  path. The fallback path is a residual (OQ-5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine encounter MUST carry an optional `reactionsSpent` list of combatant ids.
  Absent means none spent.
- **FR-002**: `attack.roll` MUST accept `reaction` (default false). With `reaction: true` the
  engine MUST refuse, before any die, when there is no encounter, the attacker is null, the
  attacker is not in the order, or the attacker's reaction is spent. On success it MUST emit
  `attack.resolved` with `reaction: true`, then `encounter.changed` adding the attacker to
  `reactionsSpent`.
- **FR-003**: `turn.advance` MUST emit `encounter.changed` removing the incoming combatant from
  `reactionsSpent` when it is there. An `initiative.leave` MUST drop the leaver's id from the list,
  and the incoming combatant's id when it hands on the turn.
- **FR-004**: The step grammar MUST gain a `move` step with `combatantId` (the mover) and
  `leavesReachOf` (hostile ids, at most 6). It runs no engine command of its own.
- **FR-005**: For each `leavesReachOf` id, in order, resolve MUST run an opportunity attack when
  the rule allows. The rule allows it when: an encounter is active; the mover is a party member;
  the reactor is a seed encounter monster in the order, able to act, with its reaction unspent;
  and the reactor's SRD record has a melee attack. The attack's bonus and damage MUST come from
  that SRD record, never a model. A hit applies the damage as a separate effect submission. Then
  the action's next step runs.
- **FR-006**: The plan gate MUST refuse a party action's group when an `attack` step's non-null
  `attackerId`, or a `move` step's `combatantId`, is not the acting character's combatant. For a
  party-scope action, it MUST be a party member's combatant. The monster turn (`actionId: null`)
  is not checked.
- **FR-007**: Interpret's prompt MUST tell the model to plan a `move` step naming each hostile the
  mover leaves without Disengage, and to plan no attack for that hostile.
- **FR-008**: Roll facts MUST carry `reaction: true` for a reaction attack. Narrate MUST render a
  reaction roll as a `reaction:` line naming its attacker.
- **FR-009**: The fallback MUST name the roller (the roll's combatant) as the subject of a roll's
  outcome sentence. The deterministic opposite-outcome audit check MUST read only rolls made by the
  action's character.
- **FR-010**: Narration facts MUST carry each party member's open followUps from their latest
  resolved action of an earlier beat, until that member declares again. Narrate MUST render them
  and MUST state that a not-yet-attempted step has not happened, in this beat or an earlier one.
- **FR-011**: Every changed prompt MUST bump its version one past `main` at build time.
- **FR-012**: No event type is added. `attack.resolved`, `attack.roll` and the encounter state gain
  optional fields only. One refusal code is added (`REACTION_SPENT`).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): reactions are decided in code from state; no human-only path.
- **CR-004** (VI. 5e engine boundary): the engine owns the reaction rule and every number. No
  model writes the reaction's bonus, AC or damage.
- **CR-005** (IV. Event sourcing): a reaction's spend and reset are state-change events with before
  and after values; replay reproduces them.

### Key Entities

- **Reaction spend**: a combatant id in `encounter.reactionsSpent`, added by a reaction attack,
  removed at the start of that combatant's next turn.
- **Move step**: `{ step: "move", reason, combatantId, leavesReachOf: id[] }`.
- **Open followUp**: `{ name, text }`, a followUp of a party member's latest resolved action from
  an earlier beat.

## Success Criteria *(mandatory)*

- **SC-001**: The run 1 seq 151–161 replay writes one `attack.resolved` with `attackerId: goblin-2`
  and `reaction: true`, then Kestrel's own check, and the action resolves `applied`.
- **SC-002**: The run 1 seq 151–161 replay of the original plan writes no attack row.
- **SC-003**: The run 1 seq 154–161 fallback holds "Goblin with a pot-helm strikes home." and no
  "Kestrel strikes home".
- **SC-004**: `pnpm ci:check` is green with the DB suites run (`REQUIRE_DATABASE=1`).

## Assumptions

- The raw run 1 rows live on vm-104. The replays rebuild seq 151–161 from the playtest log and the
  `greyhollow-ford-reed-camp` seed, and name that source in the test header (as specs/073).
- goblin-2 ("Goblin with a pot-helm") is SRD `goblin-warrior`: Scimitar, melee, +4, 1d6 + 2
  slashing. Run 1's roll (1d20+4, 4 slashing) matches it.
- TASK-0113 (spec 074) merges before this card. Its interpret line on monster reactions and its
  involuntary-effects facts stand; this card edits neither.
- TASK-0205 (spec 077, spine #5) merges before this card. Its AC #2 adds a plan-gate rule: a check
  from one player's action rolls for that player's character. FR-006 extends that rule to `attack`
  and `move` steps and reuses its refusal code (OQ-4).
- TASK-0104 later derives model-step attack numbers from stats. The reaction attack reads the SRD
  record directly because no model writes it. 0104 may route it through its own derivation. This
  card does not touch the `attack` step's `expression` or `targetAc` fields.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 Opportunity attacks come from an engine reaction rule (leaving reach, reaction unspent), never from an interpret step on the mover's own action, with a test | US1, FR-001 to FR-007; Phase 1 (engine tests), Phase 2 (replay, plan-gate test) |
| #2 A player's action resolves its own declared step; an enemy reaction is a separate event | US2, FR-005, FR-008; Phase 2 (replay), Phase 3 (narrate test) |
| #3 The fallback names the attacker as the subject of an attack's outcome, with a test replaying seq 154–161 | US3, FR-009; Phase 3 (fallback and audit tests) |
| #4 Narration never shows a followUp as done, in a later beat either | US4, FR-010; Phase 4 |

## Open questions (each with a recommended default)

- **OQ-1. Leaving reach without a map.** **Default (a):** the `move` step's `leavesReachOf`, named
  by interpret. (b) An engine engagement fact: a melee attack records an engaged pair, and a move
  breaks it. (b) needs a positions model the engine lacks. If the operator wants it, the
  orchestrator cards "engine records melee engagement", ordered after TASK-0104.
- **OQ-2. Who takes an NPC's optional reaction.** **Default (a):** code always takes it when the
  rule allows. (b) The Director or interpret chooses, with a reason. (b) adds a model decision
  where the engine already decides. Card it only if the operator wants NPC restraint.
- **OQ-3. A party member's reaction.** A PC's opportunity attack on a fleeing monster is the
  player's choice. **Default (a):** this card takes none for a party member. The orchestrator cards
  "offer a party member's opportunity attack to its player", ordered after TASK-0208, reusing
  `reaction: true` and `reactionsSpent`. (b) Take it by code for AI companions now.
- **OQ-4. A foreign step in a party action.** **Default (a):** the plan gate refuses the group
  (FR-006) with the code TASK-0205 adds for its AC #2. If spec 077 adds none, this card adds
  `STEP_ACTOR_MISMATCH` to the engine refusal enum as a plan-gate-only code, as
  `REASON_CONTRADICTS_STATE` is. (b) Drop the foreign step and run the rest. (b) silently edits a
  model plan, and run 1's plan would then resolve nothing.
- **OQ-5. Open followUps on the fallback path.** The fallback never voices a followUp, but an NPC's
  `plannedSentence` may voice a plan reason that claims one happened. **Default (a):** no fallback
  change here; runbook B's playtest observes it. (b) Refuse an NPC plan reason that pairs an open
  followUp's character with an act verb. If the playtest shows the miss, the orchestrator cards (b).
- **OQ-6. Other reactions** (the goblin's Redirect Attack, the Shield spell). **Default (a):** out
  of scope. `reaction: true` and `reactionsSpent` are general, so a later card reuses them. The
  orchestrator cards "spell and trait reactions", ordered after TASK-0105.
