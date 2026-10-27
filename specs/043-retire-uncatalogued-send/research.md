# Research: Retire the uncatalogued WebSocket send path

Every point the spec left open was settled by the operator rulings of 2026-10-27
(spec.md "Operator rulings"). The decisions below fix the remaining implementation choices.

## R1. The refusal sits in the gateway classifier

**Decision.** `handleSend` in `apps/server/src/ws/gateway.ts` keeps its two existing rows.
Its third row becomes a refusal: `sendError(conn, "validation", "<message>", "UNKNOWN_EVENT_TYPE")`,
then `return`. The type check runs before any payload check, as the catalogued row does.

**Why.** Ruling OQ1 = A. The classifier is the only place that sees `eventType` after
parsing. `parseInboundFrame` stays unchanged, so the frame shape stays unchanged (FR-007).

**Rejected.** Refusing in `parseInboundFrame`: it would need the catalog in the protocol
module and would turn a classifier decision into a parse error. Throwing from the session
seam: the seam function is being deleted.

## R2. The function is deleted, not stubbed

**Decision.** Delete `appendUncataloguedEvent` from `apps/server/src/session/events.ts`.
Delete its import from `gateway.ts`. Delete its writer binding, its allowed-importer entry,
and the `ws/gateway.ts` branch of `isWriterModule` in `apps/server/test/helpers/import-graph.ts`.

**Why.** Card AC #2 and ruling OQ3. A stub would keep a dormant writer that a later change
could reconnect. With the binding gone from `WRITER_BINDINGS`, a future re-addition is not
a listed writer; the existing `append`/`appendBatch` rule still catches any direct use of
the log from `ws/gateway.ts`.

**Note.** `gateway.ts` still imports `currentVersion` from `@the-stacks/session-model` for the
catalogued row. Check whether `session/events.ts` keeps any import used only by the deleted
function (`append` stays: `appendSessionEvent` uses it; `AppendInput` may become unused).

## R3. The load bench sends `talk`

**Decision.** In `apps/server/src/bench/load/users.ts` the send becomes:

```json
{ "type": "send", "sessionId": "<wsSessionId>", "eventType": "talk",
  "payload": { "talk": { "text": "load-bench <nonce>", "channel": "ooc", "characterId": null } },
  "payloadVersion": 1 }
```

The nonce is `randomUUID()` per send. The wait resolves on an `event` frame whose
`event.type === "talk"` and whose `event.payload.text` equals the sent text. It rejects on an
`error` frame. A rejection by `error` frame records `ws_refused`; a timeout records `timeout`
as today.

**Why.** An out-of-character `talk` with no character passes the permission matrix for any
human and routes `direct` (`packages/session-model/src/gate/permissions.ts`, `policy.ts`). A
human `talk` enqueues no DM job (`apps/server/src/dm/enqueue.ts`). The `errorKinds` keys are
fixed by `specs/021-load-bench/data-model.md`; `ws_refused` is the existing key for "the
server refused". Matching the nonce makes the timing measure the sender's own round trip, as
021 research R8 describes, instead of the first event from any user.

**Gate request shape.** Confirm the request body against `GateRequestSchema`'s `talk` member
in `packages/session-model/src/gate/proposals.ts` before writing the frame (the gateway adds
`kind`; the payload is the request without it). Visibility defaults to `public`.

**Rejected.** Retiring `wsSend`: it would change the profile schema and the results format,
and lose the only WebSocket write measurement. A new catalogued `bench.ping` type: it would
add a catalog entry whose only reader is a benchmark.

## R4. The M0 integration tests send `talk`

**Decision.** In `apps/server/test/ws.integration.test.ts`, every raw send of `chat`,
`ambient`, `tick` or `whisper` (T009–T034) becomes a `talk` gate request in the R3 shape, with
a distinguishing `text`. Restricted cases (`whisper`) send the frame-level `visibility` set to
the recipient's user id; the gateway copies it onto the request (029 `ws-delivery.md`).
Assertions on `event.type` change from the old type to `talk`. Assertions on payload change
to `payload.text`. Each test keeps the property it proved (fan-out, isolation, durability,
ordering, actor/seq/ts authority, refusal leaves no trace, replay/live boundary, visibility,
abrupt disconnect).

**Why.** Card AC #3. `talk` is the smallest gate request that writes exactly one row.

**Care points.** T022's concurrent sender and T012's several senders append through the
gate, which loads projections and appends with `expectedLastSeq`. The gate retries on
`SeqConflictError` (`apps/server/src/gate/gate.ts`). Keep each test's sender count. If a
`CONFLICT` refusal appears under the test's concurrency, report it; do not widen the retry.

## R5. One new refusal test

**Decision.** Add to the spec 029 block of `ws.integration.test.ts`: two subscribers on one
session; one sends `eventType: "chat"`; the sender receives `error` with `kind: "validation"`
and `code: "UNKNOWN_EVENT_TYPE"`; the other receives nothing within a short window; the log
for the session has no row; the sender's connection still works (a following `talk` arrives).

## R6. The protocol parse tests stay

**Decision.** `apps/server/test/ws.protocol.test.ts` keeps `eventType: "chat"`. It tests that
`parseInboundFrame` accepts any non-empty `eventType`, which is still true.

## R7. Contract amendments are text edits in this PR

**Decision.** Apply `contracts/frozen-amendments.md` verbatim to
`specs/029-proposal-gate/contracts/ws-delivery.md`, `specs/029-proposal-gate/contracts/write-boundary.md`
and `specs/006-ws-gateway/contracts/ws-protocol.md`, in the implementation phase, so the
contract and the code change in one commit range.

**Why.** Rulings OQ2–OQ4 and FR-009.

## R8. No client change

**Decision.** `apps/web` is untouched. The play route already sends only gate request kinds,
and the error-frame handling already shows any `code`.
