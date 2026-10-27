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
verified_against: 98787267ceb9b464788faea18ab76a51a199a95b
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
saves, hit dice, spell slots), `sheet` (party only) and `presence` (always `present` in U1). The
stage holds the table mode with the active actor, the encounter order as actor ids, the scene and
the DM-only trackers. The snapshot carries no seed text except names, so a player-facing prompt
cannot leak a DM-only string ([[dm-narration-quality]]). The module imports engine and
session-model types only, never a value; narrate's import closure includes it.

## Build rules

`buildSnapshot(projections, seed | null)` is pure and deterministic. Party actors come first and
copy the seed character's sheet numbers. Combatant state copies the engine combatant. A seed NPC
whose `identity.combatant` names an engine combatant and that combatant are **one actor**: the
NPC id and name, the combatant's state, the engine name in `aliases`. Every other combatant is a
`monster` actor. Order: party, encounter order, remaining combatants by id, then seed NPCs with
no combatant. With a null seed the build adds no NPC and no sheet. Two actors with the same id
throw `SnapshotBuildError` (`ACTOR_ID_COLLISION`).

## Aliases

`aliases` holds the name, the id, the combatant id, the given name after leading title words
(`snapshot/aliases.ts` `nameTerms`, `TITLE_WORDS`) and the engine and seed names, deduped.
`partyNameTerms` in the audit calls `nameTerms`; its output is unchanged.

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
| `dm` | director (with tracker lines), interpret, adjudicate | ids, HP, AC, life state, conditions, initiative, resources, sheet |
| `seat` | companion | full line for the party and `self`; others get HP, life state, conditions, initiative |
| `fiction` | narrate, audit, chronicle | name, kind, life state, conditions, presence; no digit, no id, no tracker |

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
| narrate, audit (and its regenerate) | S1 | `resolve` |
| companion | current state, `seat` view | the companion job, per companion |
| chronicle | state at the job's `throughSeq` | the chronicle job, from `loadProjections(..., { throughSeq })` |

## Extension points

TASK-0141 reads presence from the log; TASK-0142 seeds NPC presence and seed aliases;
TASK-0104 adds monster stats to `sheet`; TASK-0112 built the plan gate: it checks plan step ids against S0 actors' `combatantId` ([[dm-failure-and-gates]]);
TASK-0143 and TASK-0144 match prose against `aliases`; TASK-0145 reads S0 for the Director's
hostility rules; TASK-0146 renders the diff in the audit prompt; TASK-0147 maps batch effect
targets through `combatantId`. Each card amends the contract file. A new field is additive and
keeps `SNAPSHOT_VERSION` at 1 unless a field changes meaning.
