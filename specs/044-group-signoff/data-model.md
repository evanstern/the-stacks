# Data model: group sign-off

No new table, event type or migration. Everything below is existing catalog types, used by
a new rule. See [contracts/signoff.md](contracts/signoff.md).

## Events used

| Event | Role in sign-off | New? |
|---|---|---|
| `action.declared` v1 (`scope: "party"`) | Classifies the action (ruling Q1 A). Its actor's stance defaults to approve (Q2 A). | no |
| `action.commented` v1 (`stance`) | A human's latest `approve`/`object` is their stance. `comment` changes nothing. | no |
| `presence.recorded` v1 (`purpose: "signoff"`, `actionId`) | The present set the decision read, in the commit batch. | first writer of this purpose |
| `action.committed` v1 (`authority: "group"`) | The commit. | no |
| `action.withdrawn` v1 | DM override by withdrawal (existing). | no |

## Derived entities

- **Party human**: a distinct `userId` among party members with a `player` controller.
- **Quorum**: party humans in the present set, plus the acting human.
- **SignoffRow / SignoffState**: see the contract.

## State transitions of a party action

```
declared ──comment──▶ discussed
   │                      │
   ├── approve completes quorum (>1 human) ──▶ committed (group) + signoff marker
   ├── explicit commit, quorum met ─────────▶ committed (group) + signoff marker
   ├── DM commit (any time) ────────────────▶ committed (dm)
   └── withdraw (declarer or seated DM) ────▶ withdrawn
```

An `object` keeps the action open. Batches are atomic; a refusal writes nothing.
