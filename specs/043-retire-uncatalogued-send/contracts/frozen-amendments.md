# Contract: the frozen-contract amendments (rulings OQ2, OQ3, OQ4)

The operator ruled on 2026-10-27 (TASK-0099): "I accept the defaults on the TASK-0099 and
TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006."

Apply exactly these edits. Change no other text in these files.

## 1. `specs/029-proposal-gate/contracts/ws-delivery.md` (OQ2)

In the "The send path" table, replace the row:

```
| anything else | `appendUncataloguedEvent`, then broadcast, exactly as M0 (inert: every projection skips unknown types) |
```

with:

```
| anything else | `validation` error, code `UNKNOWN_EVENT_TYPE`; nothing written, nothing broadcast |
```

Directly below the table, add the line:

```
> Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): the uncatalogued append is retired; an uncatalogued `eventType` is refused.
```

## 2. `specs/029-proposal-gate/contracts/write-boundary.md` (OQ3)

1. Rule 3, the `session/events.ts` binding list: change
   "`appendSessionEvent`, `appendSessionEvents`, `appendMechanicsBatch`, `appendUncataloguedEvent`."
   to "`appendSessionEvent`, `appendSessionEvents`, `appendMechanicsBatch`."
2. Rule 3, the allowed-importers table: delete the row
   `| `appendUncataloguedEvent` | `ws/gateway.ts` |`.
3. Rule 4: change "For every allowed writer (`session/**`, `gate/**`, `ws/gateway.ts`)" to
   "For every allowed writer (`session/**`, `gate/**`)".
4. After rule 5, add the line:

```
> Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): the legacy writer `appendUncataloguedEvent` and its allow-list entry are removed; `ws/gateway.ts` is no longer an allowed writer.
```

## 3. `specs/006-ws-gateway/contracts/ws-protocol.md` (OQ4)

Directly beneath the blockquote that begins "Extended by
`specs/029-proposal-gate/contracts/ws-delivery.md`", add:

```
> Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): an uncatalogued `eventType` is refused with `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }`; no frame shape changes.
```

The `send` example keeps `"eventType": "chat"`.

## What does not change

- No frame type, frame field or `ErrorFrame` member changes.
- `CATALOG_TYPE_REQUIRES_GATE` keeps its meaning: a catalogued type that is not a gate
  request kind.
- `docs/wiki/ws-protocol.md` changes in prose only (the wiki phase).
