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

Amendment (TASK-0159, operator ruling 2026-10-28, D-1): the `changeScene` command. Additive.

| Command | Frame |
|---|---|
| `changeScene(input)` | `eventType: "scene"`, `payloadVersion: GATE_REQUEST_VERSION`, `payload: { reason, after, summary, rationale: null }`. When the frame was sent and `input.closeProposalId` is set, a second frame `proposal.reject` closes that pending seed. Detail: `specs/055-human-dm-scene-change/contracts/scene-change.md`. |
