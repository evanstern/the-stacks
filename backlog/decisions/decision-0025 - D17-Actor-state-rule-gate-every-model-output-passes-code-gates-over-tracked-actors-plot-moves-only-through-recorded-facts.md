---
id: decision-0025
title: >-
  D17 Actor-state rule gate: every model output passes code gates over tracked
  actors; plot moves only through recorded facts
date: '2026-10-27 03:48'
status: accepted
---
## Context

The engine owns numbers (decision-0017), but nothing in code owns actor state against model
output. The TASK-0135 inventory (`docs/design/actor-state-gate.md`, commit 0cb18c8) found seven
gaps. Narration is checked against this turn's facts, not against the actors (G1). Scene
presence is not state, so flight and surrender happen in prose (G2). Director plot moves land
before the dice and ignore actor state (G3). Nothing refuses a downed actor's action (G4).
Companion `say` and chronicle entries ship with no state check (G5). Prompt state is cut
silently under the token cap (G6). Model-chosen numbers are already carded (G7).

Evidence: M2 demo seq 225 ("Two down!" for one death), seq 296-301 (goblins flee on a no-roll
dare; the Director ends the encounter on prose), F52 (seq 307); TASK-0110 run 183818Z seq
260-265 (a bargain ends the encounter before any roll); TASK-0112 run 192319Z seq 201, 216.

The operator raised the issue on 2026-10-26 (M3 sweep Lane-0 ruling on TASK-0055):

> "NPCs, PCs, anything with trackable stats should be tracked explicitly and the data should
> be passed around to the functions/gates which decide what happens."

The operator proposed a hard rule:

> "The LLM can add flavor or advance plot only in response to dice-rolls and those
> LLM-generated results must pass rule gates which take into account all trackable actors in
> the input."

Read literally, the dice-only clause conflicts with decision-0022 point 3 (no stakes, no roll),
with scene framing and with talk. The inventory offered three formulations. The operator ruled
at checkpoint C3 on 2026-10-26, recorded on the TASK-0135 card:

- Binding wording: "3: Ledger + opposition dice".
- Seed NPCs: "M3, minimal". Seed NPCs get scene presence state now; richer NPC records stay
  with the Codex (M4).
- Position and range: carded as revisit TASK-0139.

## Decision

### Terms

- **Actor:** anything with tracked state. In M3 that is a party member, an engine combatant,
  and a seed NPC (scene presence only).
- **Scene presence:** an actor's place in the scene: `present`, `yielded` or `absent`.
  `yielded` means present and no longer opposing (surrendered, conceded, handed something
  over). `absent` means gone from the scene (left, fled, removed). Scene presence is not the
  player connection presence of decision-0024 (D16).
- **Plot:** any change to an actor's tracked state or scene presence, or to a tracker, the
  encounter, the table mode or the scene. Everything else is flavour.
- **Recorded fact:** a ledger row written by the gate. It is a die result, an engine event,
  or a no-roll outcome row under decision-0022 point 3. Prose is never a recorded fact.
- **Acting actor:** the actor whose resolved step it is. For a committed action, that is the
  declared character. For an NPC turn, it is the active combatant. For a companion `act`, it
  is the companion's character. The Director is never an acting actor.
- **Another actor:** any actor in the snapshot other than the acting actor.

### 1. The actor-state contract

1. Code builds one `ActorSnapshot` from the projections and the seed. No model writes it.
2. Each actor carries id, display name, aliases, kind (party, monster, NPC), controller, HP,
   life state, conditions, initiative, resources and scene presence.
3. The stage carries table mode, active actor, encounter round, scene and trackers.
4. `assemble` builds snapshot S0. `resolve` produces snapshot S1 and the S0-to-S1 diff.
5. Every model node receives the snapshot: director, interpret, adjudicate, narrate, audit,
   companion and chronicle. The snapshot replaces `projectionEntries` and `npcNames`.
6. A token cap never drops an actor silently. Under the cap, code compresses dead and absent
   actors to one line each. If the snapshot still does not fit, the node fails loudly.

### 2. The hard rules (formulation 3: ledger plus opposition dice)

1. **Plot moves only through a recorded fact.** A plot change with no recorded fact behind it
   is refused. Prose may add flavour. Prose may not assert any actor or stage state the
   snapshot does not hold.
2. **A change to another actor needs a roll against that actor, or an SRD rule.** This covers
   harm, a condition, scene presence (flight, leaving), `yielded` (surrender, a handover, a
   concession) and disposition. The roll must be in the same resolve batch and name that
   actor as its target or opponent: an attack, a save, or a check against a DC derived from
   that actor (decision-0022 point 5). An SRD rule qualifies only when the engine codes it:
   for example, 0 HP makes a creature unconscious, or a willing creature accepts a beneficial
   effect. A willing creature is an ally of the acting actor; a hostile actor is never willing.
3. **Uncontested effort needs no roll.** An effort whose effects touch only the acting actor
   and the untracked world follows decision-0022 point 3. It resolves as a no-roll outcome row.
   That row is a recorded fact, so the success may be narrated.
4. **The gate test is deterministic.** Code compares each effect's target ids with the acting
   actor and the batch's roll rows. Interpret still judges whether a declaration is contested.
   The gate checks only that no unrolled change touched another actor.
5. **Director stage changes need a basis in state.** The Director may set free mode or end the
   encounter only when the snapshot shows the opposition beaten: every hostile actor dead,
   unconscious, stable, `yielded` or `absent`. A tracker advance and a scene end must cite a
   recorded fact from the turn. Encounter start passes, because initiative is a roll.
6. **Scene framing is flavour.** The seed-authored opening is narrated with no roll. It may
   describe actors and the stage only as S0 holds them. It may assert no change.
7. **Talk is flavour.** DM talk and chime-in (decision-0016, TASK-0052), companion `say`, and
   NPC speech inside narration may voice intent, offers and threats. They may not enact a
   change or assert a state the snapshot does not hold. An NPC may beg for mercy; it is not
   `yielded` until a recorded fact says so.

### 3. Gates

1. **Input gates (before a model runs).** The declare gate refuses a character that is not
   `conscious` or is `absent`. The NPC-turn and companion life-state skips stay. Director
   legality reads S0 and applies rule 2.5. The spotlight never lands on a downed or absent
   actor.
2. **Plan gates (after interpret and adjudicate, before resolve).** Every step's actor and
   target must exist in S0 and must not be `absent`. The engine refuses an unconscious,
   stable or incapacitated attacker or checker, beside the existing dead-actor refusals.
3. **Resolve batch gate.** Rules 2.1 to 2.4 run over the batch before it is written.
4. **Output claim gate (after generation, before ship).** A checker keyed to snapshot aliases
   tests every shipped text: narrate prose, companion `say`, public chronicle entries, and the
   ruling and `goalNote` text that reach narrate. It refuses a dead, downed or absent actor
   shown acting or speaking. It refuses a death or drop named on the wrong actor. It refuses
   a count or quantifier that disagrees with the snapshot. A refusal feeds the existing
   regenerate loop and code fallback.
5. **Audit.** `dm.audit` receives S1. It judges what the claim gate cannot parse, such as
   disposition and offers. It is a judge, not a gate.

### 4. Pipeline order (amends decision-0017)

```
assemble -> snapshot S0
  -> director (legalized against S0)
  -> interpret -> adjudicate
  -> plan gate against S0
  -> resolve: action groups first, then the Director group, then the batch gate
  -> snapshot S1
  -> narrate with S1 and the diff
  -> claim gate against S1 -> dm.audit with S1 -> ship, regenerate or fallback
companion: snapshot -> companion -> claim gate on say -> gate.submit
chronicle: snapshot at throughSeq -> chronicle -> claim gate on public entries -> gate.submit
```

Decision-0017 said resolve, then narrate, then audit. This record amends it in three places.
`resolve` runs the action groups before the Director group, so a Director move sees the
actions' results. Code gates over the snapshot run before `dm.audit`. Every node reads the
snapshot. "Ordering is the anti-cheat" now covers actor state as well as dice.

### 5. Amendment to decision-0022

Point 3 stands. Two clarifications bind it:

- A no-roll outcome is a recorded fact (a no-roll outcome row), not a narrated one.
- Point 3 covers only effort whose effects touch no other actor. An effort against another
  actor is contested and follows point 5. A retry against the same actor in unchanged
  circumstances stands on the earlier roll (one endeavor, one roll).

## Consequences

- TASK-0112 acceptance criterion #2 is answered here: an unconscious character's declared
  action is refused at the declare gate, before any model runs.
- TASK-0110 implements the resolve order change (section 4).
- TASK-0104 and TASK-0105 keep numbers and spells engine-owned; the snapshot carries the stats.
- TASK-0127 records no-roll outcomes as rows (rule 2.3). TASK-0128 supplies the opposition
  rolls rule 2.2 needs.
- TASK-0113 and TASK-0130 align narrate and audit wording with rules 2.6 and 2.7.
- TASK-0109 keeps distinct combatants distinct in the chronicle.
- New cards carry the rest: the snapshot, scene presence and its producer, seed-NPC scene
  presence, the claim gate, the gates on companion `say` and public chronicle entries, Director
  legality over state, the able-actor gates, audit with the snapshot, and the batch gate. The
  card proposals and the rule-to-card table are in `docs/design/actor-state-gate.md`.
- Disposition beyond `yielded` is untracked in M3. Prose asserting it rides `dm.audit` and the
  narrate doctrine. Richer NPC records belong to the Codex (M4).
- Position and range stay untracked until TASK-0139 rules.
- The resolve order change touches the turn-jobs contract; TASK-0110 documents it.
