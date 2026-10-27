# Contract: WebSocket delivery and the send path

Amends `specs/006-ws-gateway/contracts/ws-protocol.md` and the subscriber-registry
behaviour. Frame shapes are unchanged except the optional `code` on `error` (Open Question 1;
default applied). Update the 006 contract in the same PR with a pointer here.

## Visibility: `canSee` replaces `isVisible` (AC #4)

```ts
// apps/server/src/ws/registry.ts
export function viewerFor(conn: Connection, seat: DmSeat): Viewer {
  return seat.kind === "human" && seat.userId === conn.userId
    ? { role: "dm" }
    : { role: "player", userId: conn.userId };
}
```

- `broadcast` and `subscribe`'s replay both decide with
  `canSee(viewerFor(conn, seatOf(sessionId)), event.visibility)` — one function for both
  paths, as before.
- The registry keeps one seat per subscribed session (`seatBySession`). `subscribe` loads it
  with `loadDmSeat` when the session has none cached; the entry is deleted when the session's
  last subscriber leaves.
- `broadcast` of a `dm.seat.changed` event delivers that event (it is public), then sets the
  cached seat to its `after`. Later events filter with the new seat.
- Effect: the seated human DM's connection receives `dm` events (proposal events, secret
  trackers, hidden rolls), live and on replay. With an AI seat, no connection receives them.
  The connection's `role` (operator or player) does not by itself grant the DM view.
- A seat change does not re-send earlier `dm` events to a newly seated DM's open connection;
  its next subscribe replays them.

## The send path

`handleSend` classifies `frame.eventType`:

| `eventType` | Handling |
|---|---|
| a `GATE_REQUEST_KINDS` member | `payloadVersion` must equal `GATE_REQUEST_VERSION` (1), else a `validation` error. Build the request `{ ...payload, kind: eventType }`; when the frame carries `visibility`, it overrides the request's `visibility`. Call `gate.handle(sessionId, { kind: "human", userId, role }, request)`. |
| any other catalogued type (`currentVersion(type) !== undefined`) | `forbidden` error, code `CATALOG_TYPE_REQUIRES_GATE`; nothing written |
| anything else | `validation` error, code `UNKNOWN_EVENT_TYPE`; nothing written, nothing broadcast |

> Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): the uncatalogued append is retired; an uncatalogued `eventType` is refused.

`talk` is both a request kind and a catalog type; the first row wins, so `talk` goes to the
gate. A `payload` that is not a JSON object is a `validation` error.

On a gate refusal the sender gets an `error` frame:

| Refusal | `kind` |
|---|---|
| source `gate`: `NOT_AUTHORIZED`, `NOT_DM`, `COMMIT_NOT_ALLOWED`, `GROUP_SIGNOFF_REQUIRED` | `forbidden` |
| source `gate`: `CONFLICT` | `internal` |
| every other gate code, every `engine` and `append` code | `validation` |

```ts
export interface ErrorFrame {
  type: "error";
  kind: "validation" | "forbidden" | "internal";
  message: string;
  code?: string;            // new, optional: the refusal code
}
```

On success nothing is sent to the sender directly: the gate's `onAppended` publishes the rows
and every entitled subscriber, the sender included, receives them as `event` frames (no
acknowledgements, as in M0). A pending `ask` therefore reaches only the DM.

## Publishing

```ts
// on the object createGateway returns
publish(sessionId: string, events: readonly StoredEvent[]): void;   // broadcast each, in order
```

`publish` converts a `StoredEvent` (ISO `ts`) to the `event` frame shape directly.
