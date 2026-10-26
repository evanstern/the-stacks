# Data Model: First Scene — session model

No table, column or migration changes. Every entity below is either a payload stored in the
M0 `events` table (JSONB `payload`, versioned by `payload_version`, hidden by `visibility`)
or an in-memory projection folded from those rows. Exact schemas are in
[contracts/session-events.md](contracts/session-events.md) and
[contracts/projections.md](contracts/projections.md); this file names the entities, their
relationships, validation rules and state transitions.

## Stored entities (event payloads)

| Entity | Event type(s) | Identity | Relationships |
|---|---|---|---|
| Talk message | `talk` | the row's `(session_id, seq)` | optional speaking character (`characterId`) |
| Narration | `narration` | row position | the actions it narrates (`actionIds`) |
| Action | `action.declared` (+ commented, committed, resolved) | `actionId` | declaring actor; character (or party scope); mechanics batches (`batchIds`) |
| Comment | `action.commented` | row position | one action |
| Table mode | `table-mode.changed` | one per session (latest `after`) | active actor; active character |
| Scene | `scene.changed` | `sceneId` | one current scene per session |
| Party member | `party.member.changed` | `characterId` | controller (player user id or AI companion actor); engine combatant (`combatantId`) |
| Secret tracker | `tracker.changed` | `trackerId` | none; DM-only |
| Journal entry | `journal.entry.added` | `entryId` | source actions (`sourceActionIds`) |
| Mechanics event | 18 engine types | `(batchId, index)` | one engine `execute` result (`batchId`); optional action and proposal |

## Validation rules

- Every payload validates against the catalog schema for its `(type, payload_version)`
  before append; a failure writes nothing (FR-004).
- `tracker.changed` rows carry visibility `dm` (FR-015).
- Mechanics rows: `type` equals `payload.event.type`; `index < count`; the engine event
  passes `EngineEventSchema` (FR-003).
- State-change payloads carry `reason`, `before` and `after`; `before` and `after` are not
  both `null`; their ids match the payload's subject id (FR-017).
- `action.declared` with scope `character` names a character; `action.resolved` outcome
  agrees with `batchIds` and `refusalCode` (session-events.md).
- `TrackerSchema.filled` is at most `segments`.

## State transitions

### Action lifecycle (decision-0016)

```
          action.declared
 (none) ─────────────────▶ declared ──action.commented──▶ discussed ─┐
                              │                            ▲  │       │ action.commented
                              │                            └──┘◀──────┘
                              │ action.committed               │ action.committed
                              ▼                                ▼
                           committed ◀─────────────────────────┘
                              │ action.resolved
                              ▼
                           resolved
```

Any other event for an action is an ignored transition (counted, kept in the transcript).

### Table mode

```
 free ──table-mode.changed──▶ turn(activeActor = A)
 turn(A) ──table-mode.changed──▶ turn(activeActor = B)
 turn(·) ──table-mode.changed──▶ free
```

Initial state: free. Each change records `before` and `after`.

### Party member, scene, tracker

Created (`before: null`), replaced (both set), removed (`after: null`). The projection takes
`after`.

## Projection entities (derived, never stored)

`SessionProjections` per viewer: scene, table mode, party (members joined to engine
combatants), encounter (engine encounter joined to names and states), journal, transcript,
actions, ledger, trackers (DM only), the engine state, plus `throughSeq` and diagnostics.
Rebuilt from sequence 0 on demand (`loadProjections`) or incrementally (`applyEvent`).

## Viewers

| Viewer | Sees |
|---|---|
| DM (`{ role: "dm" }`) | every event |
| Player (`{ role: "player", userId }`) | `public` events and events whose visibility is its own `userId`; never `dm` events; never `tracker.changed` |
