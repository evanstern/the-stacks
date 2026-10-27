# Contract: seed NPC scene presence (TASK-0142, decision-0025 U8)

This file collects the binding rules. The amended contracts carry them with an
"Amended 2026-10-27 (TASK-0142, operator ruling)" note quoting the ruling.

## 1. Seed (amends `specs/031-dm-runtime/contracts/scene-seed.md`)

1. Every beat carries `presence: Record<npcId, ScenePresence>` covering every seed NPC.
2. `beats[0]` is the opening beat.
3. A beat's `npcIds` names no NPC that beat declares `absent`.
4. An NPC's `identity.combatant`, when set, equals its `id` and names an encounter monster.
5. An NPC's `identity.aliases` holds at most 6 strings of 1–60 characters.
6. The loader refuses a seed that breaks rules 1, 3 or 4, with one issue per breach.

## 2. Proposal (amends `specs/029-proposal-gate/contracts/proposals.md` and `gate-api.md` §1)

1. `scene-presence` gains `visibility: "public" | "dm"`, default `"public"`.
2. The planner writes `scene-presence.changed` with that visibility. Engine rows in the batch
   stay `public`.
3. `proposals.md`'s rule "`scene-presence` is always `public`" becomes "`scene-presence` is
   `public` unless the proposal says `dm`".

## 3. Resolve (amends `specs/031-dm-runtime/contracts/resolve.md`)

1. The seed-presence group is code-owned. Its stepRefs start `seed:presence:`. It reads the seed
   and the projections only, never a Director field.
2. Scene start: after the setup group, one proposal per NPC whose opening value is not
   `present`; reason `removed` or `conceded`; `actionId: null`; visibility `dm`.
3. Encounter start: after the monsters join, before the initiative roll; one `arrived` proposal
   per NPC the encounter's beat declares `present` whose logged value is not `present`;
   visibility `public`.
4. No other beat change writes presence. A later arrival is a presence effect (spec 048).
5. No `director:`-keyed submission has kind `scene-presence` (spec 048 AC #5, unchanged).

## 4. Snapshot (amends `specs/040-actor-snapshot/contracts/actor-snapshot.md`)

1. Rule 7: presence stays a projection read. Seed declarations reach it only as logged rows.
2. §4: NPC aliases append `identity.aliases` after the derived terms, deduped.
3. U8 row: **Built** (spec 050). Note for U9 (TASK-0147): seed rows carry `actionId: null` and
   a `seed:presence:` key; they are code-owned, not an unrolled change to another actor.
