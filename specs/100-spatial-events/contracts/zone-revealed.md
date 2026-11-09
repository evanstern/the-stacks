# Contract: `zone.revealed` v1 and the fog rule

**Status**: Draft (spec 100, TASK-0271). Binding once TASK-0271 merges. Extends
`specs/028-session-model/contracts/session-events.md` (catalog) and, subject to the OQ-1 ruling,
`specs/029-proposal-gate/contracts/gate-api.md` (what a plan writes).

## 1. Catalog row

| Type | Version | Kind | Catalog visibility | Written by | Row visibility |
|---|---|---|---|---|---|
| `zone.revealed` | 1 | `state-change` | `any` | the gate only (`fogRows`, `revealRows`) | always `public` |

A client `send` of `zone.revealed` refuses `CATALOG_TYPE_REQUIRES_GATE`, as every catalog type
does today. `SESSION_EVENT_TYPES` grows from 19 to 20. The catalog grows from 42 to 43 entries.

## 2. Payload

```ts
// packages/session-model/src/events/space.ts
import { EdgeSchema, ZoneIdSchema, ZoneSchema } from "@the-stacks/space";

export const ZoneRevealedV1 = z
  .object({
    reason: ReasonSchema,
    /** true: `zones` and `edges` replace the players' map. false: they merge into it. */
    reset: z.boolean(),
    /** Revealed zones, as the engine space holds them, with `hidden: false`. */
    zones: z.array(ZoneSchema).max(64),
    /** Engine-space edges with at least one end in `zones`. */
    edges: z.array(EdgeSchema).max(256),
    /** Combatant id -> zone id, for every combatant standing in a revealed zone. */
    occupants: z.record(CombatantIdSchema, ZoneIdSchema),
  })
  .superRefine(/* rules below */);
export type ZoneRevealed = z.infer<typeof ZoneRevealedV1>;
```

Refinement rules (each adds one custom issue):

1. Every zone has `hidden: false`.
2. Zone ids are unique.
3. Every edge has at least one end in `zones`. With `reset: true`, both ends are in `zones`.
4. Every occupant's zone is in `zones`.
5. A row with `reset: false` has at least one zone.

The row carries the zone records themselves, so a player who never received `space.defined` can
build the map. It never carries a zone, an edge end or an occupant outside the revealed set and
the players' map.

## 3. The fog rule (`fogRows`)

`fogRows(p, rows)` runs inside `planProposal`, after `plan()` and before `validate()`. `p` is the
DM projection the gate already loads. It walks `rows` in order and keeps two running values:
`engine` (start `p.engine`, advanced by `evolve` over each mechanics row) and `map` (start
`p.spatial.map`, advanced by each `zone.revealed` it emits).

For each row:

1. **Not spatial, or not `public`.** Emit it unchanged. A `dm` or whisper row is never loosened
   and never reveals.
2. **`space.defined`.** Emit it with visibility `dm`. Then emit one `zone.revealed` with
   `reset: true`. Its zones are the new space's zones that are not hidden, are on `map`, or hold
   a party combatant. Its edges are the new space's edges with both ends among those zones. Its
   occupants are the combatants standing in those zones. Set `map` to that result.
3. **Names no fogged zone.** Emit it unchanged. A zone is fogged when `engine.space` holds it and
   `map` does not. FR-009 lists the zones each row type names.
4. **Reveals.** The row is `combatant.added`, or its subject is a party combatant, or it also
   names a zone on `map`. Emit one `zone.revealed` with `reset: false` for the fogged zones the
   row names, then emit the row `public`.
5. **Otherwise.** Emit the row with visibility `dm`.

A `zone.revealed` that rule 4 emits carries:

- `zones`: the fogged zones the row names, as `engine.space` holds them, with `hidden: false`.
- `edges`: the `engine.space` edges with one end in `zones` and the other in `zones` or `map`.
- `occupants`: each combatant in `engine` whose placement is in `zones`, before the row applies.

**Fail closed.** When `p.viewer.role` is not `dm`, every public row that names any zone is
written `dm` and nothing is revealed. The gate always passes the DM projection, so this branch is
a guard, not a path.

**Party combatant.** A combatant id equal to some `p.party[].combatantId`.

**Batch envelopes.** A `zone.revealed` row is session-native. It does not join the mechanics
batch, and it does not change any envelope's `index` or `count`. A batch's rows stay in order but
may be interleaved with `zone.revealed` rows.

## 4. Explicit reveal (`revealRows`)

```ts
export function revealRows(
  p: SessionProjections,   // the DM projection
  actor: string,
  zoneIds: readonly string[],
  reason: string,
): { ok: true; rows: PlannedRow[] } | { ok: false; refusal: GateRefusal };
```

- An id not in `p.engine.space`: refusal `INVALID_PROPOSAL` (`source: "gate"`), `details: { zoneId }`.
- No space: refusal `INVALID_PROPOSAL`.
- Ids already on the map are skipped. When none is fogged, `rows` is `[]`.
- Otherwise one public `zone.revealed` (`reset: false`) built as in §3 rule 4.

TASK-0268 calls it for a `reveal` Intent with a zone target and `to: "party"` (spec OQ-4).

## 5. Examples

Space: `bank` (start), `house`, `loft` (hidden), `camp` (hidden). Edges `bank`–`house` open 20,
`house`–`loft` climb 10, `bank`–`camp` open 60. Party combatant `tamsin`.

AI DM proposes `space.define`. The gate writes:

```jsonc
{ "type": "space.defined", "visibility": "dm", "payload": { /* envelope, all four zones */ } }
{ "type": "zone.revealed", "visibility": "public", "payload": {
  "reason": "The party's view of the scene", "reset": true,
  "zones": [ { "id": "bank", ... "hidden": false }, { "id": "house", ... "hidden": false } ],
  "edges": [ { "from": "bank", "to": "house", "kind": "open", "feet": 20 } ],
  "occupants": {} } }
```

Tamsin (in `house`) moves to `loft`. The gate writes:

```jsonc
{ "type": "zone.revealed", "visibility": "public", "payload": {
  "reason": "Tamsin climbs to the loft", "reset": false,
  "zones": [ { "id": "loft", "name": "Loft", "kind": "room", "tags": [], "hidden": false } ],
  "edges": [ { "from": "house", "to": "loft", "kind": "climb", "feet": 10 } ],
  "occupants": {} } }
{ "type": "combatant.moved", "visibility": "public", /* path house -> loft */ }
```

A goblin in fogged `camp` is placed in fogged `camp` again by the DM: one `combatant.placed` row,
`dm`. No reveal.

## 6. Reason text

- A rule 4 reveal row copies the triggering row's engine `reason`. That row is public anyway.
- A reset row carries the fixed reason `"The party's view of the scene"`. It never copies the
  `space.defined` reason, which may name hidden zones.
- A `revealRows` row carries the caller's reason.
- The gate does not rewrite producers' reasons. A producer must not name a fogged zone in the
  reason of a row the fog rule keeps public. Seeds and the runtime write zone names only in rows
  that name that zone. The hidden-information test (spec SC-001) checks every scripted scenario.
