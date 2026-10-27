# Data model: Turn-mode floor passing (spec 049)

No new event type. No change to `TableModeSchema` or any spec 028 event schema.

## Floor (derived)

| Field | Source | Notes |
|---|---|---|
| `mode` | `tableMode.mode` | Floor exists only in `turn` mode. |
| `holder` | `tableMode.activeActor` | A user id, `ai:dm`, or `ai:companion:<id>`. |
| `characterId` | `tableMode.activeCharacterId` | Null for `ai:dm` (monster turn) and a held floor. |
| `turn` | `encounter.round`, `encounter.activeCombatantId` | The engine's turn. |
| `held` | `floorHeld(p)` | Turn mode, holder = seated human DM's user id, `characterId` null. |

**Transitions** (each is one gate append):

| From | Request | To |
|---|---|---|
| actor X's turn | `floor end` by X (or by the DM: Pass) | engine turn advanced and settled; holder = `activeActorFor(next)` |
| any turn | `floor take` by the seated DM | holder = DM, `characterId` null; engine turn unchanged |
| held | `floor return` by the seated DM | holder = `activeActorFor(encounter.activeCombatantId)` |
| held | `floor end` by the DM | engine turn advanced and settled; holder = next actor |
| actor X's turn | X's committed action resolves | unchanged existing path (resolve's turn-advance group) |

## `floor` proposal (spec 029 amendment)

```ts
z.object({
  kind: z.literal("floor"), ...ProposalNote,
  op: z.enum(["end", "take", "return"]),
  turn: z.object({ round: z.number().int().min(1), combatantId: CombatantIdSchema }),
  reason: ReasonSchema,
})
```

Visibility: always `public`. Policy: `ask` (human seat), `auto` (AI seat).

## `action.commit` override (spec 029 / 044 amendment)

`action.commit` gains `override: z.literal("stall").optional()`. Accepted only from `ai:dm`.

## Refusal codes (spec 029 `gate-api.md` §2 amendment)

`FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE` join `GATE_REFUSAL_CODES`. `details`:
`{ holder }` for `FLOOR_NOT_HELD`; `{ expected: turn, actual: turn }` for `TURN_MOVED`.

## Markers

| Purpose | Written when | Batch |
|---|---|---|
| `floor` | an `ai:dm` `floor end` (the absence pass) | `[marker, mechanics…, table-mode.changed]` |
| `signoff` | an `ai:dm` `action.commit` with `override: "stall"` | `[marker, action.committed(dm)]` |

## `floor` job (spec 031 amendment; migration 0007)

```ts
FloorJobInput = z.object({
  v: z.literal(1),
  sessionId: z.string().uuid(),
  check: z.enum(["absence", "stall"]),
  actionId: RefIdSchema.nullable(),        // stall only
  holder: z.string().nullable(),           // absence: the absent human user id
  stanceSeq: z.number().int().min(0).nullable(), // stall: latest stance seq at arm time
  notBefore: z.string().datetime(),        // database time, ISO UTC
})
FloorJobResult = {
  outcome: "passed" | "committed" | "noop" | "skipped" | "refused",
  seqs: number[],
  refusal?: { code: string; message: string },
}
```

Uniqueness: one queued job per `(session_id, check, actionId ?? "")`. Running: serialised
with `turn` and `companion` per session.

## View model (web)

| Item | Fields |
|---|---|
| `ModeView` (extended) | existing fields, plus `held: boolean`, `order: OrderEntry[]` |
| `OrderEntry` | `combatantId`, `label`, `isActive`, `isNext`, `isViewer` |
| `FloorControls` | `endTurn: boolean`, `pass: boolean`, `take: boolean`, `return: boolean`, `turn` |
| `TranscriptItem` kind `floor` | `seq`, `text` ("Bram's turn", "Your turn", "The DM has the floor") |
| `ActionCardView` additions | `commitsOnOwnTurn: boolean`, `suggest: boolean` |
