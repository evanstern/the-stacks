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
| `turn`, opening | table mode is free; `encounterId` names a seed encounter not yet run | treated as `stay`; recorded |
| `free`, closing | table mode is turn | treated as `stay`; recorded |
| tracker advance, closing | `trackerId` names a seed tracker that exists in the projection | dropped; recorded |
| scene `end`, closing | a scene is set | treated as `continue`; recorded |
| `companionPrompts` | free mode; AI companions in the party | dropped; recorded |

## Decision → proposals (resolve's opening and closing moves)

Proposer `ai:dm` for all. `before` is filled by the gate.

Each decision is an opening move or a closing move. Opening moves (scene start, `turn`) run
before the ruling and action groups. Closing moves (tracker advance, `free`, scene `end`) run
after the action and NPC groups. See [turn-jobs.md](turn-jobs.md) "Resolve order (decision-0025 §4)".

| Decision | Proposals, in order |
|---|---|
| scene start (trigger `scene-start`), opening | `scene` (after: `sceneId` = seed id, title, summary = goal statement, location name); for each seed character: `mechanics` `combatant.add` (from the seed's identity), then `party` (controller from the start request seats); for each seed tracker: `tracker` (filled 0, `dm`); none of the beat decisions below run on scene start except `pacing` |
| tracker advance, closing | `tracker` with the new `after` |
| `turn`, opening | for each monster in the encounter not in engine state: `mechanics` `combatant.add` (built from its SRD record, [scene-seed.md](scene-seed.md)); then `mechanics` `initiative.roll` for every living party combatant and the encounter's monsters (mode `normal`); then `table-mode` `turn` with the active actor from the new encounter order |
| `free`, closing | `mechanics` `encounter.end` when an encounter is active; then `table-mode` `free` |
| scene `end`, closing | `mechanics` `encounter.end` when active; `table-mode` `free` when in turn mode; `scene` with `after: null`; the turn's narration closes the scene |
| `hold` | none; the runner queues one companion job for the named companions |
| `companionPrompts` | none; the runner queues one companion job after the turn (reason `prompt`) |

**Active actor rule.** For the encounter's active combatant: a party member controlled by a
player → that user id; by an AI companion → `ai:companion:<characterId>`; no party member →
`ai:dm`. `activeCharacterId` is the party member's `characterId`, or null.

## Holding a beat

1. The runner applies the opening moves and then the closing moves (trackers can still move), then ends the job with
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

## Amendment 2026-10-30 (specs/064-plan-first-step): the cut-beat hold row

Amended by specs/064-plan-first-step.

Add this row to the legality table. Code enforces it after the cut, not the model.

| Decision | Legal when | Otherwise |
|---|---|---|
| `turn`, `tracker` advance, scene `end` (cut beat) | no reading or ruling in the beat has `followUps` | treated as `stay`, dropped, or `continue`; recorded as an override with reason "held: the plan was cut to its first stage" |
| `turn`, `tracker` advance, scene `end` (clarify beat; amended by spec 073, TASK-0209) | no human action in the beat has a reading with `clarify` set and no ruling | treated as `stay`, dropped, or `continue`; recorded as an override with reason "held: an action awaits an answer" |

`holdDirector(director, cutBeat)` applies the row. A `free` decision is never held. The Director
prompt is `dm.director-v4`.

## Amendment 2026-11-02 (specs/078-revealed-npc-present): arrivals

- Field: `arrivals?: RefId[]` (max 4), the offstage seed NPC ids the transcript or the beat shows on screen. `legalizeDirector` always sets it; an omitted field reads `[]`.
- Legality: an arrival is legal when it names a seed NPC whose logged presence is `absent` and the trigger is not `scene-start`. Otherwise the id is dropped, duplicates collapse to the first, and one `arrivals` override is recorded.
- Proposal: resolve submits one public `scene-presence` `arrived` proposal per legal arrival, key `director:arrival:<npcId>`, as the first opening move after the scene-start block.

## Amendment 2026-11-03 (specs/085-combat-audit-pass-rate, TASK-0214): the `goalNote` restriction

The Director prompt is `dm.director-v7`. The `goalNote` shape text also says the note states no count of
the fallen or the remaining, no morale condition and no encounter trigger. The narrate node backs the
rule: `withholdRefusedInputs` blanks a note that states a count.

## Amendment 2026-11-05 (specs/088-pre-encounter-monster): monster arrivals

The Director prompt is `dm.director-v9`.

- Legality: an `arrivals` id is also legal when it is an encounter monster of an encounter that has not run, is not yet a combatant, and the table mode is `free`. Otherwise the id is dropped with one `arrivals` override: "an arrival named a monster that is not unseen, or the table is in turn mode".
- Proposal: resolve submits a keyed `run.mech` `combatant.add` for each legal monster arrival, key `director:arrival:<combatantId>`, in the arrivals group. It writes no presence row. One fresh projections load follows the group and feeds the encounter start and `seedPresence`.
- Run-encounter rule: the `turn` decision's runnable test and `legalEscalation` use `encounterRan`: an encounter has run when it is active or a logged `encounter.started` row's order held one of its monsters. A monster added alone does not make it run.

## Amendment: dependent arrivals (spec 089, TASK-0237)

- An `arrivals` id that a check's stake text names is legal as before, but resolve lands it only when the check's applied band delivers a text naming it. The Director does not decide the roll's result.

The Director prompt is `dm.director-v10`. The `goalNote` shape text says the note states no result a roll this beat could decide: no thing found, person reached or fact learned. The arrivals rule says a reveal a roll decides is the roll's, not the Director's. The narrate node backs the rule: `withholdRefusedInputs` blanks the note on a beat where any check failed, with a `doctrine` advisory.

**Amendment (TASK-0247).** Amended 2026-11-13 (spec `specs/091-mud-stream-and-composer`, plan.md "Contract amendments"). Additive.

> "Approve all" (operator, C-AMD ruling, 2026-11-13: applies OQ-A1 to OQ-A15 of spec 091; OQ-A8 re-confirms R1 (a), ruled 2026-11-05, as the C-GATE ruling for the `SceneSchema` optional fields)

The scene-start `scene` row adds `description`, `ways` and `cast`. All three come from the player-facing seed view, so no DM-only seed text reaches a player. `description` is the location features joined and cut to 1000 characters; `ways` is added when not empty; `cast` maps `PlayerSeedView.npcs`. No other opening or closing move changes.

## Amendment 2026-11-15 (specs/118-companion-code-director, TASK-0321): the companion's own turn

A turn job whose beat items all belong to the active AI companion in turn mode, with no monster turn, makes no `dm.director` call. The runner supplies the stay-put output: `resolve`, `stay`, no trackers, `continue`, pacing `rising` with no spotlight or beat, an empty `goalNote`, no companion prompts, no arrivals, no overrides. Resolve's code fight end still runs. Scene end, tracker advances and arrivals wait for the next beat that calls the Director (spec 107 OQ-8, spec 118 D2).
