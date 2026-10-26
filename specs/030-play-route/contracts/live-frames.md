# Contract: frames the live table sends (before TASK-0045)

The session protocol is unchanged (`specs/006-ws-gateway/contracts/ws-protocol.md`). The live table
sends only `subscribe` (unchanged, from `useSession`) and `send` frames built by `play/frames.ts`.
Every payload is parsed with its session-model schema before sending; a failing payload is not sent
and the command returns `false`. `actor`, `seq` and `ts` are never sent.

| Command | `eventType` | `payloadVersion` | `payload` (schema) | `visibility` |
|---|---|---|---|---|
| `sendTalk` | `talk` | `currentVersion("talk")` | `{ text, channel, characterId }` (`TalkV1`) | omitted (`public`) |
| `declareAction` | `action.declared` | current | `{ actionId: "act-" + crypto.randomUUID(), characterId, scope, text }` (`ActionDeclaredV1`) | omitted |
| `comment` | `action.commented` | current | `{ actionId, stance, text }` (`ActionCommentedV1`) | omitted |
| `commit` | `action.committed` | current | `{ actionId, authority }` (`ActionCommittedV1`) | omitted |

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

## After TASK-0045 merges

The gated phase changes this table if TASK-0045 binds a different write path for player actions
(contracts/proposal-seam.md). It adds rows for approve and reject.
