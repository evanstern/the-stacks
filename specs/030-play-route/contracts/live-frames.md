# Contract: frames the live table sends (gate requests, after TASK-0045)

The session protocol is unchanged (`specs/006-ws-gateway/contracts/ws-protocol.md`). The live table
sends only `subscribe` (unchanged, from `useSession`) and `send` frames built by `play/frames.ts`.
Every payload is parsed with its session-model schema before sending; a failing payload is not sent
and the command returns `false`. `actor`, `seq` and `ts` are never sent.

Each frame is a gate request (`specs/029-proposal-gate/contracts/ws-delivery.md`): `eventType` is
the request kind, `payload` is the request without its `kind`, and `payloadVersion` is
`GATE_REQUEST_VERSION` (1). The gate derives actor, authority and visibility.

| Command | `eventType` | `payload` (schema) |
|---|---|---|
| `sendTalk` | `talk` | `{ talk: { text, channel, characterId } }` (`TalkV1`) |
| `declareAction` | `action.declare` | `{ action: { actionId: "act-" + crypto.randomUUID(), characterId, scope, text } }` (`ActionDeclaredV1`) |
| `comment` | `action.comment` | `{ comment: { actionId, stance, text } }` (`ActionCommentedV1`) |
| `commit` | `action.commit` | `{ actionId }` (authority is derived by the gate, never sent) |
| `approve` | `proposal.approve` | `{ proposalId }` |
| `reject` | `proposal.reject` | `{ proposalId, reason }` (`reason` is `null` when blank, else 1 to 500 characters) |

A refusal returns an `error` frame; its optional `code` (a gate, engine or append refusal code)
is shown with the `message` in the table's notice. A catalog event type sent directly is
refused with `CATALOG_TYPE_REQUIRES_GATE`.

`text` is trimmed before parsing. In-character talk sets `characterId` to the viewer's selected
character; out-of-character talk sets `null`.

## `useSession` change

`send(text)` is replaced by:

```ts
sendEvent(frame: { eventType: string; payload: unknown; payloadVersion: number; visibility?: string }): boolean
```

It returns `false` unless the socket is open. Everything else in `useSession` (the `/auth/me`
preflight, `Math.max` seq tracking, one path for replayed and live events, no optimistic append) is
unchanged. An `error` frame sets the source's `notice` to its `message` instead of only logging it.

Amendment (TASK-0177, additive): `useSession` also returns `resync()`. On a seat gain it
re-subscribes from `afterSeq` 0, per the 029 `ws-delivery.md` rule "its next subscribe replays
them". Detail: `specs/062-human-dm-seat/contracts/dm-seat-control.md`.

Amendment (TASK-0159, operator ruling 2026-10-28, D-1): the `changeScene` command. Additive.

| Command | Frame |
|---|---|
| `changeScene(input)` | `eventType: "scene"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { reason, after, summary, rationale: null }`. When the frame was sent and `input.closeProposalId` is set, a second frame `proposal.reject` closes that pending seed. Detail: `specs/055-human-dm-scene-change/contracts/scene-change.md`. |

Amendment, TASK-0165 (additive, 2026-10-28): the `endEncounter` and `setTableMode` commands.

Operator ruling (card, 2026-10-28), answering "Do you accept the recommended defaults (a) for TASK-0165's OQ-1 to OQ-6?": "Accept all (a)".

| Command | Frame |
|---|---|
| `endEncounter(input)` | `eventType: "mechanics"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { command: { type: "encounter.end", reason }, actionId: null, visibility: "public", summary: "End the encounter", rationale: null }`. When the frame was sent and `input.thenFree` is set, a second `table-mode` frame with `after: { mode: "free" }` follows. |
| `setTableMode(input)` | `eventType: "table-mode"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { reason, after, summary, rationale: null }`. |

Detail: `specs/060-human-dm-encounter-mode/contracts/table-mode-control.md`.

Amendment, TASK-0177 (additive, 2026-10-29): the `seatDm` command. Operator ruling 2026-10-29: OQ-1 to OQ-6 all (a). See `specs/062-human-dm-seat/contracts/dm-seat-control.md`.
`frames.ts` gains `dmSeatReason` and `dmSeatFrame`; `useLiveTable` sets `seatDm: (input) => send(dmSeatFrame(input))`. The frame is the existing 029 `dm.seat` request; no frame shape changes.

Amendment (TASK-0188, decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). Spec `specs/066-one-chat-stream`, D20 §1 and §5.

| Command | Frame |
|---|---|
| `accept(input)` | `eventType: "action.accept"`, `payload: { suggestionId, itemId }` |
| `suggest(input)` | `eventType: "action.suggest"`, `payload: { suggestion: { suggestionId: "sug-" + crypto.randomUUID(), readSeq, items } }` (`ActionSuggestedV1`) |

The `declareAction` and `comment` rows leave the web client; the gate still accepts both requests.
The `send` frame shape is unchanged.

**Amendment (TASK-0199).** Amended 2026-11-11 (spec `specs/066-one-chat-stream`, plan.md "Frozen-contract amendments", row C-7; P-04, decision-0030).

> "Approve all" (operator, C-GATE ruling, 2026-11-11: approves C-1 to C-9 as written in spec 066 plan.md)

The `intent` request frame carries an `IntentSchema` value. `accept` and `suggest` frames keep their
shape; the `suggest` payload items are `{ itemId, text, intent }` per C-1.

**Amendment (TASK-0298).** Amended 2026-11-12 (spec `specs/108-narration-stream`, plan.md "C-GATE: frozen contract amendments"). Additive.

> "Approve all" (operator, C-GATE ruling, 2026-11-12)

`useSession` also returns `stream`: the in-flight narration, or `null`. No sent frame changes.
