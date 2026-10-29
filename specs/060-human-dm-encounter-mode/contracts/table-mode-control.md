# Contract: the human DM's table-mode control

TASK-0165. Written against the recommended options OQ-1 to OQ-6 (a). A ruling other than (a)
amends this file before implementation.

Amends, additively, `specs/030-play-route/contracts/ui-surfaces.md`, `live-frames.md` and
`table-source.md`. No frozen contract changes: no WebSocket frame shape
(`docs/wiki/ws-protocol.md`), no `specs/029-proposal-gate/contracts/` file, no
`specs/030-play-route/contracts/proposal-seam.md` rule. Both requests already exist in 029.

## Frames (`apps/web/app/play/frames.ts`)

```ts
/** A `mechanics` request ending the encounter. Null when the reason fails ReasonSchema. */
export function encounterEndFrame(input: EncounterEndInput): EventFrame | null;
// eventType: "mechanics", payloadVersion: GATE_REQUEST_VERSION
// payload: {
//   command: { type: "encounter.end", reason },  // reason trimmed, 1..500
//   actionId: null,
//   visibility: "public",
//   summary: "End the encounter",
//   rationale: null,
// }

/** A `table-mode` request. Null when `reason` or `after` fails its schema. */
export function tableModeFrame(input: TableModeInput): EventFrame | null;
// eventType: "table-mode", payloadVersion: GATE_REQUEST_VERSION
// payload: { reason, after, summary: "Table mode: <after.mode>", rationale: null }
// `after` parsed with TableModeSchema.
```

## Inputs and commands (`apps/web/app/play/source.ts`)

```ts
export interface EncounterEndInput {
  reason: string;            // trimmed; 1..500
  /** True when the table is in turn mode: the free-mode request follows (OQ-2 (a)). */
  thenFree: boolean;
}
export interface TableModeInput {
  reason: string;            // trimmed; 1..500
  after: TableMode;          // { mode: "free" } or the turn mode from TableModeView.turnAfter
}
// TableCommands gains:
endEncounter(input: EncounterEndInput): boolean;  // true when the mechanics request left / applied
setTableMode(input: TableModeInput): boolean;     // true when the request left / applied
```

Live (`use-live-table.ts`): `endEncounter` sends `encounterEndFrame`. Only when that send returned
true and `thenFree` is set, it sends `tableModeFrame({ reason, after: { mode: "free" } })`. It
returns the first send's result. `setTableMode` sends one `tableModeFrame`.

Fixture (`use-fixture-table.ts`): `endEncounter` appends `localEncounterEndEvents` and, with
`thenFree`, the `localTableModeEvents` free row. `setTableMode` appends `localTableModeEvents`.
Each returns false when its builder returns null.

## Fixture rows (`apps/web/app/play/local-log.ts`)

```ts
/** One `encounter.ended` mechanics batch row; null with no engine encounter. */
export function localEncounterEndEvents(p: SessionProjections, input: EncounterEndInput): LocalEventInput[] | null;
// payload: { batchId: `b-local-${p.throughSeq + 1}`, index: 0, count: 1, actionId: null,
//   proposalId: null, event: { type: "encounter.ended", v, reason, before: p.engine.encounter, after: null } }
// The fixture does not emit the engine's `condition.removed` rows (the live gate does).

/** One `table-mode.changed` row with `before` from the projection. */
export function localTableModeEvents(p: SessionProjections, input: TableModeInput): LocalEventInput | null;
```

## View (`apps/web/app/play/table-mode.ts`, new, pure)

```ts
export interface TableModeView {
  mode: "free" | "turn";
  encounterActive: boolean;
  canEnd: boolean;        // encounterActive
  canFree: boolean;       // mode === "turn"
  turnAfter: TableMode | null; // free mode and an encounter: { mode: "turn", ...activeActorFor(p, activeCombatantId) }; else null
}
export function tableModeView(p: SessionProjections): TableModeView;
// TableViewModel gains: tableMode: TableModeView | null  (null unless isDm)
```

## Surfaces

| Surface | Change |
|---|---|
| `TableHeader` | gains `modeOpen: boolean` and `onMode?: () => void`. When `model.isDm` and `onMode` is set, it renders a button named "Table mode" with `aria-controls="table-mode-panel"` and `aria-expanded={modeOpen}`. |
| `TableModePanel` | `components/table-mode-panel.tsx`; props `view: TableModeView`, `onEndEncounter(input: EncounterEndInput): boolean`, `onSetMode(input: TableModeInput): boolean`. `TableView` mounts it in the shared `Panel` (title "Table mode", id `table-mode-panel`) only when `model.tableMode` is not null. The panel closes when a command returns true. |

Accessible names and texts:

- Status line: "Free mode" or "Turn mode", then "Encounter active." or "No encounter."
- Field "Reason (optional)", starting blank. A blank reason sends the clicked action's default, as
  `floorReason` does (`tableModeReason(action)` in `frames.ts`). Defaults: "The DM ends the encounter.", "The DM switches to free mode.", "The DM switches to turn
  mode."
- Buttons, each shown only when allowed: "End encounter" (`canEnd`), "Switch to free mode"
  (`canFree`), "Switch to turn mode" (`turnAfter !== null`).
- Beside "Switch to free mode" with an encounter: "The encounter stays active."
- Free mode with no encounter: "Turn mode needs an encounter. The AI DM starts one."
- No `role="dialog"`, no `alertdialog`, no confirmation step.

## What players see

Every row is `public`. A player sees the `encounter.ended` and `table-mode.changed` rows in the
ledger, the badge change and the turn-order strip leave or return. A player sees no new control.

## Server behaviour (unchanged, relied on)

- A seated human DM's `mechanics` and `table-mode` requests are applied directly (029 matrix).
- `enqueue.ts` rule 4: a human-written turn-mode row naming `ai:dm` queues an `npc-turn`; naming a
  companion queues its `turn` job. A free-mode row or a human mechanics batch queues nothing.
