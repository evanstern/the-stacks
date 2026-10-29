# Contract: the operator's DM seat control

TASK-0177. Written against the recommended options OQ-1 to OQ-6 (a). A ruling other than (a)
amends this file before implementation.

Amends, additively, `specs/030-play-route/contracts/ui-surfaces.md`, `live-frames.md` and
`table-source.md`. No frozen contract changes: no WebSocket frame shape
(`docs/wiki/ws-protocol.md`; a second `subscribe` on one connection is already allowed), no
`specs/029-proposal-gate/contracts/` file, no `specs/030-play-route/contracts/proposal-seam.md`
rule. The `dm.seat` request already exists in 029.

## Frame (`apps/web/app/play/frames.ts`)

```ts
/** The default reason for a blank field. */
export function dmSeatReason(action: "seat" | "return"): string;
// "seat"   → "The operator seats a human DM."
// "return" → "The operator returns the seat to the AI DM."

/** A `dm.seat` request. Null when `reason` fails ReasonSchema or `after` fails DmSeatSchema. */
export function dmSeatFrame(input: DmSeatInput): EventFrame | null;
// eventType: "dm.seat", payloadVersion: GATE_REQUEST_VERSION
// payload: { reason, after }   // reason trimmed, 1..500; after parsed with DmSeatSchema
```

## Input and command (`apps/web/app/play/source.ts`)

```ts
export interface DmSeatInput {
  reason: string;           // trimmed; 1..500. The panel fills the default for a blank field.
  after: DmSeat;            // { kind: "ai" } | { kind: "human", userId }
}

export interface TableCommands {
  // …existing…
  /** Live operator sources only; absent on fixtures. Sends one `dm.seat` request. */
  seatDm?(input: DmSeatInput): boolean;
}
```

`useLiveTable` sets `seatDm` for every live source; the gate refuses a non-operator
`NOT_AUTHORIZED`. `useFixtureTable` leaves it absent.

## View (`apps/web/app/play/dm-seat.ts`)

```ts
export interface DmSeatCandidate { userId: string; label: string }

export interface DmSeatView {
  holder: { kind: "ai" } | { kind: "human"; userId: string; label: string };
  /** Null while presence is unknown. */
  candidates: DmSeatCandidate[] | null;
  canReturn: boolean;
  /** The viewer's pending proposal count when the viewer holds the seat; else null. */
  pendingCount: number | null;
}

export function dmSeatView(
  p: Pick<SessionProjections, "gate" | "party">,
  present: readonly PresenceEntry[] | null,
  self: string,            // the signed-in user id (a live source's `actor`)
  pending: number | null,  // `model.isDm ? proposals.length : null`
): DmSeatView;
```

Rules:

1. `holder` comes from `p.gate.seat`. A human holder's `label` is its presence `displayName`, else
   `"DM"`.
2. `candidates` keeps presence order. It drops the human holder and every user who is the
   `controller.userId` of a `party` member. A candidate whose `userId === self` is labelled
   `"<displayName> (you)"`.
3. `canReturn` is `holder.kind === "human"`.

## Resync (`apps/web/app/play/viewer.ts`, `apps/web/app/ws/useSession.ts`)

```ts
/** True once when the signed-in user gains the DM seat after replay (OQ-5 (a)). */
export function shouldResync(
  prev: { caughtUp: boolean; isDm: boolean },
  next: { caughtUp: boolean; isDm: boolean },
): boolean;  // prev.caughtUp && next.caughtUp && !prev.isDm && next.isDm
```

`useSession` gains `resync(): void`. It resets the frame state to `initialFrameState`, sets
`highestSeqRef` to 0, and sends `subscribe { sessionId, afterSeq: 0, presence: true }` on the open
socket. With no open socket it does nothing (the next reconnect replays from the kept seq, and the
server then filters under the new seat). `useLiveTable` calls it from an effect when
`shouldResync` holds for the previous and current `{ caughtUp, viewer.role === "dm" }`.

## Start scene issue (`apps/web/app/play/start-scene.ts`)

`seatMapIssues(humans, seats, dmUserId?: string | null)`. A seat whose user is `dmUserId` gets
`{ path: "seats.<characterId>", message: "The DM cannot hold a character seat." }`, checked before
the repeated-user rule. `StartScenePanel` gains `dmUserId: string | null`; `TableView` passes the
projected human seat's `userId`, else null. The server start route is unchanged.

## Surfaces

| Surface | Change |
|---|---|
| `TableHeader` | gains `seatOpen: boolean` and `onSeat?: () => void`. When `onSeat` is set, it renders a button named "DM seat" with `aria-controls="dm-seat-panel"` and `aria-expanded={seatOpen}`, beside "Start scene". |
| `DmSeatPanel` | `components/dm-seat-panel.tsx`; props `view: DmSeatView`, `onSeat(input: DmSeatInput): boolean`. `TableView` mounts it in the shared `Panel` (title "DM seat", description "Seat a human DM, or return the seat to the AI DM.", id `dm-seat-panel`) only when `canSeat`. |
| `TableView` | `canSeat` = `source.kind === "live" && source.role === "operator" && source.caughtUp && source.commands.seatDm !== undefined`. Closes the panel when the command returns true. |

Click helpers (exported, pure): `seatInput(userId, reason)` and `returnInput(reason)`, each
filling the default reason for a blank field.

Accessible names: text "AI DM holds the seat." or "<label> holds the seat."; field "Reason
(optional)"; select "Seat a human DM"; button "Seat as DM" (disabled until a user is picked);
button "Return the seat to the AI DM" (only when `canReturn`); texts "Waiting for the people at
the table." (candidates null), "No one else at the table can take the seat." (candidates empty),
and "Pending proposals stay pending under the AI DM: <n>. Decide them first." (`pendingCount` > 0,
with `canReturn`). No dialog.
