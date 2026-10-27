# Data model: Actor snapshot (TASK-0140)

The data model is the contract: [`contracts/actor-snapshot.md`](contracts/actor-snapshot.md).

- §2 defines `ActorSnapshot`, `SnapshotActor`, `SnapshotStage` and their fields.
- §3 defines how each field is filled from the projections and the seed.
- §5 defines `SnapshotDiff`, `ActorChange` and `StageChange`.
- §6 defines `RenderOptions` and `SnapshotOverflowError`.

Nothing is persisted. There is no schema migration and no new event type.
