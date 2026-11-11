---
name: actor-snapshot
description: The actor snapshot (TASK-0140, decision-0025 U1, specs/040-actor-snapshot) - one typed ActorSnapshot built from the DM projections and the scene seed, the NPC-combatant join, code-derived aliases, the S0-to-S1 diff, the dm/seat/fiction views with token caps and the loud state-overflow failure, which prompt reads which view, and the Track C cards that extend it. Read before any prompt or node that reads actor state.
kind: concept
sources:
  - apps/server/src/dm/snapshot/types.ts
  - apps/server/src/dm/snapshot/build.ts
  - apps/server/src/dm/snapshot/aliases.ts
  - apps/server/src/dm/snapshot/diff.ts
  - apps/server/src/dm/snapshot/render.ts
  - apps/server/src/dm/snapshot/index.ts
  - specs/040-actor-snapshot/contracts/actor-snapshot.md
verified_against: 7a36c9e9e90450f473fc5e54a082d0ce7c083727
---

# Actor snapshot

`apps/server/src/dm/snapshot/` turns the folded projections ([[session-model]]) and the scene
seed into one plain-data `ActorSnapshot`. Every DM prompt that shows actor state renders it, so
no prompt keeps its own projection renderer. Binding contract:
`specs/040-actor-snapshot/contracts/actor-snapshot.md`; later Track C cards amend that file and
never fork a second state view. Runtime wiring is in [[dm-runtime]].

## The type

`SNAPSHOT_VERSION = 1`. `ActorSnapshot` holds `throughSeq`, `seedId` (null without a seed),
`actors` and `stage`. A `SnapshotActor` has `id`, `combatantId`, `characterId`, `name`, `aliases`,
`kind` (`party`, `monster`, `npc`), `controller` (`player`, `ai-companion`, `dm`), `hp`,
`lifeState`, `conditions` (with the engine instance id), `ac`, `initiative`, `resources` (death
saves, hit dice, spell slots), `zone` and `reach` (spec 100: the zone id the actor stands in, or null, and the actor ids sharing it; zone-mode reach is `engaged`) , `sheet` (party only; since spec 083 the rendered sheet lists the character's spell ids) and `presence` (read from the log, see Build rules). The
stage holds the table mode with the active actor, the encounter order as actor ids, the scene,
the DM-only trackers and `zones` (id, name, kind, `revealed`; null when the scene has no space). The snapshot carries no seed text except names, so a player-facing prompt
cannot leak a DM-only string ([[dm-narration-quality]]). The module imports engine and
session-model types only, never a value; narrate's import closure includes it.

## Build rules

`buildSnapshot(projections, seed | null)` is pure and deterministic. Party actors come first and
copy the seed character's sheet numbers. Combatant state copies the engine combatant. A seed NPC
whose `identity.combatant` names an engine combatant (or, when unset, a combatant whose id equals the NPC id) and that combatant are **one actor**: the
NPC id and name, the combatant's state, the engine name in `aliases`. Every other combatant is a
`monster` actor, including a monster a Director arrival added before its encounter starts (spec 088; `build.ts` is unchanged). Order: party, encounter order, remaining combatants by id, then seed NPCs with
no combatant. With a null seed the build adds no NPC and no sheet. `presence` is the `scenePresence` projection entry keyed by actor `id` (party: character id;
NPC: NPC id; monster: combatant id; `presenceOf` in `build.ts`). No entry means `present`, and an
entry that matches no actor is ignored. Two actors with the same id
throw `SnapshotBuildError` (`ACTOR_ID_COLLISION`).

## Aliases

`aliases` holds the name, the id, the combatant id, the given name after leading title words
(`snapshot/aliases.ts` `nameTerms`, `TITLE_WORDS`) and the engine and seed names and the seed NPC's `identity.aliases` (spec 050), deduped.
`partyNameTerms` called `nameTerms` (the audit that used it is retired); `nameTerms` output is unchanged.

## The diff

`diffSnapshots(s0, s1)` matches actors by id and returns typed actor changes (`joined`, `left`,
`hp`, `life-state`, `condition` by instance id, `presence`, `initiative`, `resources`) and stage
changes (table mode, active actor, encounter start and end, round, tracker, scene). Identical
snapshots give empty lists. `resolve` builds S1 after its last gate write and returns it with the
diff. The diff is derived state: it is never logged, never sent to a client and rendered in no
prompt yet.

## Views, caps and overflow

`renderSnapshot(snapshot, { view, cap, trackers?, self? })` returns `{ ok, lines }` or the
overflow detail; `snapshotSection` returns `## <label>` plus the lines or throws
`SnapshotOverflowError`.

| View | Readers | Carries |
|---|---|---|
| `dm` | director (with tracker lines), interpret, adjudicate | ids, HP, AC, life state, conditions, initiative, resources, sheet, a `Zones:` line (fogged zones marked `(hidden)`), `zone <id>; reach <ids\|none>` per placed actor |
| `seat` | companion | full line for the party and `self`; others get HP, life state, conditions, initiative; only revealed zones, and no zone or reach for an actor in a fogged zone |
| `fiction` | narrate, chronicle | name, kind, life state, conditions, presence, a `Places:` line and `in <zone name>` for revealed zones only; no digit, no id, no tracker |

Caps (`prompts/common.ts` `CAPS`): `snapshotDm` 2000, `snapshotSeat` 2000, `snapshotFiction` 800.
The schema-maximum seed (6 party, 12 monsters, 20 NPCs) fits every view uncompressed. Over the
cap, only dead or absent actors shrink to one compressed line; a still-over total throws. No line
is dropped or cut, so a model never sees a partial state. The error surfaces as a `state-overflow`
node failure for a turn ([[dm-failure-and-gates]]), an `error` play for a companion and
`entries: 0` for the chronicle ([[dm-turn-jobs]]).

## Where each snapshot comes from

| Reader | Snapshot | Built by |
|---|---|---|
| director, interpret, adjudicate | S0 | `assemble` |
| narrate | S1 | `resolve` |
| companion | current state, `seat` view | the companion job, per companion |
| chronicle | state at the job's `throughSeq` | the chronicle job, from `loadProjections(..., { throughSeq })` |

## Extension points

TASK-0141 built the presence read (spec 048; the plan gate gains the `absent` reason, same
`UNKNOWN_COMBATANT` code); TASK-0142 built seed aliases and the seed rows, the only path from the seed to `presence` ([[seed-npc-presence]]);
TASK-0104 adds monster stats to `sheet`; TASK-0112 built the plan gate: it checks plan step ids against S0 actors' `combatantId` ([[dm-failure-and-gates]]);
TASK-0143 built the alias matcher (`checkClaims` in `dm/claims.ts`, spec 051; deleted by TASK-0272, the matcher now serves `narration-check.ts` through `namedActorIds` and `aliasOccurrences` in `snapshot/aliases.ts`), which reads `aliases`, `kind`, `lifeState`, `presence` and the diff and reads no other field; TASK-0144 and TASK-0161 reused it ([[output-claim-gate]], retired); TASK-0145 reads S0 for the Director's
hostility rules; TASK-0146 rendered the diff in the audit prompt; TASK-0147 maps batch effect
targets through `combatantId`. Each card amends the contract file. A new field is additive and
keeps `SNAPSHOT_VERSION` at 1 unless a field changes meaning.
