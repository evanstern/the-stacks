# Contract: the Director's decisions and their proposals

Node: `apps/server/src/dm/nodes/director.ts`, purpose `dm.director` (decision-0018). The
Director decides; resolve writes ([resolve.md](resolve.md)). Every decision below reaches the
log only as a gate proposal (FR-054).

## Output schema

```ts
export const DirectorOutput = z.object({
  beat: z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("resolve") }),
    z.object({ decision: z.literal("hold"),
      companions: z.array(RefIdSchema).min(1).max(4),    // AI companion characterIds
      reason: z.string().min(1).max(300) }),
  ]),
  tableMode: z.discriminatedUnion("to", [
    z.object({ to: z.literal("stay") }),
    z.object({ to: z.literal("turn"), encounterId: RefIdSchema, reason: z.string().min(1).max(300) }),
    z.object({ to: z.literal("free"), reason: z.string().min(1).max(300) }),
  ]),
  trackers: z.array(z.object({
    trackerId: RefIdSchema,
    advance: z.number().int().min(-3).max(3).refine((n) => n !== 0),
    reason: z.string().min(1).max(300),
  })).max(4),
  scene: z.discriminatedUnion("status", [
    z.object({ status: z.literal("continue") }),
    z.object({ status: z.literal("end"), outcome: z.enum(["goal-met", "retreat", "failed"]),
      reason: z.string().min(1).max(300) }),
  ]),
  pacing: z.object({
    tension: z.enum(["low", "rising", "high"]),
    spotlight: RefIdSchema.nullable(),        // a characterId the narration should favour
    beatId: z.string().max(64).nullable(),    // the seed beat now in play
  }),
  goalNote: z.string().max(300),              // a private note for narrate; never shown verbatim
  companionPrompts: z.array(RefIdSchema).max(4), // free mode: companions to prompt after this beat
});
```

Tracker advances are deltas. Code computes `after.filled = clamp(before.filled + advance,
0, segments)`. Tracker clocks are the Director's narrative state, not engine mechanics.

Amended by specs/033-director-robustness/contracts/director-output.md.

## Legality (enforced by code, not the model)

| Decision | Legal when | Otherwise |
|---|---|---|
| `hold` | table mode is free; the trigger is not `forced`; every named companion is an AI companion in the party with no committed action in this beat | treated as `resolve`; recorded as an override in the turn record |
| `turn` | table mode is free; `encounterId` names a seed encounter not yet run | treated as `stay`; recorded |
| `free` | table mode is turn | treated as `stay`; recorded |
| tracker advance | `trackerId` names a seed tracker that exists in the projection | dropped; recorded |
| scene `end` | a scene is set | treated as `continue`; recorded |
| `companionPrompts` | free mode; AI companions in the party | dropped; recorded |

## Decision → proposals (resolve's Director group)

Proposer `ai:dm` for all. `before` is filled by the gate.

| Decision | Proposals, in order |
|---|---|
| scene start (trigger `scene-start`) | `scene` (after: `sceneId` = seed id, title, summary = goal statement, location name); for each seed character: `mechanics` `combatant.add` (from the seed's identity), then `party` (controller from the start request seats); for each seed tracker: `tracker` (filled 0, `dm`); none of the beat decisions below run on scene start except `pacing` |
| tracker advance | `tracker` with the new `after` |
| `turn` | for each monster in the encounter not in engine state: `mechanics` `combatant.add` (built from its SRD record, [scene-seed.md](scene-seed.md)); then `mechanics` `initiative.roll` for every living party combatant and the encounter's monsters (mode `normal`); then `table-mode` `turn` with the active actor from the new encounter order |
| `free` | `mechanics` `encounter.end` when an encounter is active; then `table-mode` `free` |
| scene `end` | `mechanics` `encounter.end` when active; `table-mode` `free` when in turn mode; `scene` with `after: null`; the turn's narration closes the scene |
| `hold` | none; the runner queues one companion job for the named companions |
| `companionPrompts` | none; the runner queues one companion job after the turn (reason `prompt`) |

**Active actor rule.** For the encounter's active combatant: a party member controlled by a
player → that user id; by an AI companion → `ai:companion:<characterId>`; no party member →
`ai:dm`. `activeCharacterId` is the party member's `characterId`, or null.

## Holding a beat

1. The runner applies the Director group (trackers can still move), then ends the job with
   status `held`.
2. It queues one companion job: `{ companions, reason: "hold", beatJobId }`.
3. The companion job plays each named companion once ([companions.md](companions.md)).
4. When it ends, it upserts the session's queued turn job with `forceResolve: true`
   ([turn-jobs.md](turn-jobs.md)). That job's beat includes the original actions and any
   companion commits, in commit order.
5. A turn job with `forceResolve: true` treats any `hold` as `resolve`. One hold per beat
   follows (Open Question 6).

## Scene seed data the Director reads

Goal and end conditions, beats, trackers with `advanceWhen`, encounters with `trigger` and
`morale`. Monsters flee or surrender per `morale`: the Director signals it through `goalNote`
and `tableMode: free`; resolve does not remove fleeing monsters (they leave the encounter by
`encounter.end`).
