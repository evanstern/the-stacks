# Data model: Seed NPCs carry minimal scene presence

## Beat presence declaration (seed, new)

| Field | Type | Rule |
|---|---|---|
| `beats[].presence` | `Record<npcId, "present" \| "yielded" \| "absent">` | Required. Keys equal the seed's NPC ids exactly. |
| `beats[].npcIds` | `npcId[]` (existing) | No entry may be `absent` in the same beat's `presence`. |
| `beats[0]` | — | The opening beat: its `presence` is each NPC's value at scene start. |

## Seed NPC identity (seed, amended)

| Field | Type | Rule |
|---|---|---|
| `identity.combatant` | `RefId \| null` (existing) | When set: equals the NPC `id` and names an encounter monster `combatantId`. |
| `identity.aliases` | `string[]` (new, default `[]`) | At most 6, each 1–60 characters. |

## `scene-presence` proposal (session model, amended)

`{ kind, ...ProposalNote, actorId, reason, actionId, visibility }`. `visibility` is new:
`"public"` (default) or `"dm"`. The planner copies it onto the `scene-presence.changed` row.
The event payload is unchanged (v1).

## Seed presence row (session event, no new type)

A `scene-presence.changed` v1 row written by the seed-presence group, `actionId: null`.

| Moment | Rows | Reason | Visibility |
|---|---|---|---|
| Scene start | one per NPC whose opening value is not `present` | `removed` (absent), `conceded` (yielded) | `dm` |
| Encounter start | one per NPC the encounter's beat declares `present` and the log does not | `arrived` | `public` |

State transitions follow spec 048: the reason fixes `after`; `before` comes from the projection.

## Snapshot NPC actor (amended)

`aliases` gains `identity.aliases` after the derived terms, deduped. `presence` is read from the
`scenePresence` projection by NPC id (unchanged).
