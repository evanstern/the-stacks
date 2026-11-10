---
name: seed-npc-presence
description: Seed NPC presence (TASK-0142, specs/050-seed-npc-presence, decision-0025 U8) - the required per-beat `presence` map in the scene seed, its cross-checks, NPC `aliases`, the dm-visibility option on the `scene-presence` proposal, the Director's unseen-monster arrivals as `combatant.add` (spec 088), the code-owned seed-presence group in resolve (scene start as dm rows, encounter start as arrived rows), NPC lists read from logged presence, and the at-least-one human-seat rule with `listSeeds`.
kind: pipeline
sources:
  - apps/server/src/dm/seed/schema.ts
  - apps/server/src/dm/seed/load.ts
  - apps/server/seeds/greyhollow-ford.json
  - apps/server/seeds/greyhollow-ford-duo.json
  - apps/server/seeds/greyhollow-ford-trio.json
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/src/dm/gates/plan-gate.ts
  - apps/server/src/dm/nodes/assemble.ts
  - apps/server/src/dm/nodes/narrate.ts
  - apps/server/src/dm/snapshot/build.ts
  - packages/session-model/src/gate/proposals.ts
  - packages/session-model/src/gate/plan.ts
size_budget_exempt: TASK-0237 adds the dependent-arrivals paragraph to the one arrivals note; the note sat 246 chars under the budget before it, and the arrival rules do not split without a TASK of its own
verified_against: 849583241734158db445178cc8c1f70c65af8e23
---

# Seed NPC presence

The scene seed declares where each NPC stands in each beat. Code turns that declaration into
logged `scene-presence.changed` rows, so the actor snapshot ([[actor-snapshot]]) and every NPC
list read presence from the log, never from the seed. Spec: `specs/050-seed-npc-presence/`.
The rows use the existing proposal kind ([[proposal-gate]]) and event ([[session-model]]);
the DM pipeline is in [[dm-runtime]].

## The seed declaration

`SceneSeedSchema` (`seed/schema.ts`) gives the scene `tableRules` (`outcomeBands`, `naturals` default true; `groupChecks` default false, spec 070; it has no behaviour: SRD 5.2.1 has no group-check rule, TASK-0232) and every beat a required `presence`: a record from NPC
id to `ScenePresenceSchema` (`present`, `yielded`, `absent`). There is no default, so a seed
without it fails to load. `SeedNpc.identity` gains `aliases` (up to 6 strings of up to 60
characters, default empty). Spec 083: the plan gate reads each character's `identity.spells` as the prepared list, and `resolve` reads `identity.level` as the spell `casterLevel`; Odo's list adds `cure-wounds`. `SeedCharacter.identity` gains required `class` (up to 40 characters) and `level` (1 to 20); the three seeds set them. Scene start copies both onto each `director:party:<id>` row's `after` (TASK-0164; `PartyMemberSchema` holds them as optional fields). Spec 100 (TASK-0271): the seed also declares an optional `space` (`zones`, `edges`, `start`), `npcs[].zone` and `encounters[].zone`. `crossCheckSeed` refuses a start that is unknown, hidden or a `feature`, an NPC or encounter zone outside the space, and a zone field in a seed with no space. All four shipped seeds declare a space (the `ferry-house-door` and `camp-post` feature zones; the loft, reed marsh and reed camp are hidden). `greyhollow-ford.json` declares all three NPCs in all three beats
and aliases "the keeper" (`wenna`), "the boy" (`pell`) and "the goblin leader" (`snag`).
Since spec 080, beat clue text is also the learned fact: a check step's `reveals` (`<beatId>#<n>`) names one clue, and resolve copies its text (`clueFor`) onto the submission. The ferry-house footprint clue names goblin feet.
`greyhollow-ford-duo.json` (TASK-0163, `specs/054-two-player-alpha-kit/`) is the same scene with
the same three NPCs and presence maps and three party characters: `tamsin` and `kestrel` seat
`human`, `odo` seat `companion`.
`greyhollow-ford-trio.json` (TASK-0176, `specs/061-trio-seed/`) is the same scene again with the same NPCs and presence maps; all three characters seat `human` and no character seats `companion`, so a table that starts it has no AI companion ([[dm-runtime]]).

`crossCheckSeed` (`seed/load.ts`) reports an issue for each of these:

- a character whose `identity.combatant` carries `stats` (the loader builds them from the sheet), or whose attack expression is not `1d20` plus or minus a number, or whose attack names no SRD weapon (spec 082);
- an NPC whose `identity.combatant` differs from its id, or names no encounter monster;
- a beat that lists an NPC in `npcIds` and declares no presence for it;
- a beat whose `presence` names an unknown NPC;
- a beat that lists an NPC in `npcIds` and declares it `absent`;
- fewer than one character with seat `human` ("at least one character must have seat \"human\""). The rule was exactly one before TASK-0163; the trio seed seats three.

`listSeeds(dir)` loads every `*.json` in the seed directory through `loadSeed`, returns the valid
seeds sorted by `seedId`, and logs one `dm.seeds.load-failed` line per bad file. It never throws
for a bad file or a missing directory ([[dm-runtime]], `GET /dm/seeds`).

## The proposal option

The `scene-presence` proposal gains `visibility`: `"public"` or `"dm"`, default `public`
(`gate/proposals.ts`). The planner (`gate/plan.ts`) writes that value as the row's visibility,
where it used to write `public`. An effect-driven `presence` effect in resolve sets
`visibility: "public"` explicitly. Only the seed-presence group sends `dm`.

## The seed-presence group

`arrivingNpcs` (`gates/plan-gate.ts`, spec 058) mirrors the encounter-start branch below for the plan gate: it lists the seed NPCs the beat declares `present` whose logged presence is not, so a roll reason naming one passes against the planned `arrived` change ([[dm-failure-and-gates]]). Resolve adds the Director's `arrivals` ids to that list, so an arriving id is not absent to the plan gate.

`seedPresence` in `nodes/resolve.ts` runs inside the Director's opening moves. It reads the
seed and the projections only and never a Director field. For each seed NPC it reads the beat's
declared value and the logged value (no entry means `present`):

| Moment | Beat read | Declared | Row |
|---|---|---|---|
| Scene start, after the party and tracker rows | `seed.beats[0]` | `absent` | reason `removed`, visibility `dm` |
| Scene start | `seed.beats[0]` | `yielded` | reason `conceded`, visibility `dm` |
| Director opening, before any action group | the `arrivals` ids the Director names (offstage at scene start) | `present` | reason `arrived`, visibility `public` |
| Encounter start, before the initiative join | the beat whose `encounterId` is that encounter | `present` | reason `arrived`, visibility `public` |

A declared `present` at scene start logs nothing, and a declared `absent` or `yielded` at
encounter start logs nothing. Scene start drops every `arrivals` id, so only the seed declares an NPC on scene start. The Director's arrival rows log before the encounter-start group; the group then reloads projections before `seedPresence` when any arrival logged, so it reads the new presence. A row is skipped when the logged value already equals
`REASON_TO_PRESENCE[reason]`.

**Dependent arrivals** (spec 089, TASK-0237). `splitArrivals` in `nodes/resolve.ts` splits the Director's `arrivals` into `unconditional` and `dependent`: an id is dependent when a stake text of a check in this beat's readings or rulings names it (`namedActorIds`, a unique-alias match; a monster by its seed name). The opening loop and the plan gate's `arriving` take only `unconditional`. `landHeldArrivals` runs after the NPC group and lands a dependent arrival, same key `director:arrival:<id>`, only when `bandTexts` of the applied band name it; otherwise it logs `dm.arrival.held` and writes no row.

**Monster arrivals** (spec 088, TASK-0238; spec 099 adds turn mode). In free mode the Director may also name an unseen encounter monster in `arrivals` (`unseenMonsters` in `gates/plan-gate.ts`: a monster of an encounter that has not run, not yet a combatant, not a seed NPC id). A monster has no actor to flip, so the arrivals loop in `directorOpening` writes a keyed `director:arrival:<id>` `combatant.add` opening move from the SRD record instead of a presence row. Any landed arrival (NPC or monster) triggers one fresh projections load, used by the encounter start's "already a combatant" skip and by `seedPresence`, so a monster added this beat is not added twice. `arrivingMonsters` lists the Director's monster arrivals then the encounter-start joiners; resolve passes it as the plan gate's `joining` ([[dm-failure-and-gates]]), and the interpret prompt's "Arriving this beat" section lists the same ids. A seed NPC id stays on the arrivals path above. Spec 099: a monster added gets side `hostile`; in turn mode only a `joinableMonsters` id (an active encounter's monster not yet a combatant) is legal, and its `combatant.add` is followed by `initiative.join`. `arrivingMonsters` and `arrivingNpcs` return nothing for an encounter that already ran (a resume adds no one and runs no start presence group). A `fled` presence now sends `combatant.depart` (order and zone), and a hostile's `surrendered` sends `combatant.side` `neutral`, so neither takes a turn in a later start or resume. Each row is submitted under the key
`seed:presence:<moment>:<npcId>` with `actionId: null` and a note `Seed presence: <name>
<reason>`. The key makes a reclaim replay the same submission, and `findLanded` recognises a
row that landed before its checkpoint.

Resolve builds these proposals, as it does every `scene-presence` proposal. Seed rows are the only path from the seed to logged presence.

## NPC lists from presence

- `assemble` builds S0 first, then sets `presentNpcIds` to the seed NPCs (in seed order) whose
  snapshot actor does not read `absent`. It no longer collects `beats[].npcIds`.
- At scene start `narrate` takes the NPC ids from `seed.beats[0].presence` (every NPC not declared `absent`), not the Director's beat (spec 076; a loft NPC such as Wenna reaches the opening). Seeds also carry a required `opening.premise` (why the party is here), which the opening prompt reads.
- Otherwise `narrate` filters the beat's NPC ids, or `presentNpcIds` when no seed beat matches,
  against the S1 snapshot and drops each actor that reads `absent`. It then withholds refused
  rulings, `goalNote` text and a monster `say` line ([[output-claim-gate]]; spec 081); this does not touch the NPC list.
- `buildSnapshot` adds `identity.aliases` to the NPC actor's `aliases`
  ([[actor-snapshot]]).

`canSee` shows a `dm`-visibility row to the DM viewer only ([[session-model]]).
