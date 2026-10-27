# Contract: the presence marker (decision-0024)

## Event

`presence.recorded`, version 1, `current: true`, kind `marker`, catalog visibility `any`.

```ts
const PresenceRecordedV1 = z.object({
  present: z.array(z.uuid()).max(64),   // sorted ascending, unique (refined)
  purpose: z.enum(["director", "signoff", "floor"]),
  actionId: RefIdSchema.optional(),
});
```

Row: `actor: "system"`, `visibility: "public"`.

## Writer: `gate.recordPresence`

```ts
recordPresence(
  sessionId: string,
  input: { purpose: "director" | "signoff" | "floor"; actionId?: string },
): Promise<
  | { ok: true; event: StoredEvent }
  | { ok: false; refusal: GateRefusal }
>;
```

- Reads `presence.presentUsers(sessionId)` and maps it to sorted user ids.
- Appends one row through `appendSessionEvents` with `expectedLastSeq` from the DM projection's
  `throughSeq`; retries on `SeqConflictError` like every gate write (3 attempts, then
  `CONFLICT`).
- Calls every `onAppended` listener with the stored row.
- Never deduplicates against an earlier marker.
- `GateDeps.presence` defaults to a reader with no humans present.

## Caller in this task: the DM worker

- Before each claimed `turn` job's pipeline: `recordPresence(sessionId, { purpose: "director" })`.
- A refusal or throw finishes the job failed, as any pre-pipeline failure does, with
  `failure.node = "presence"`.
- The turn's `jobs.result` carries `presenceSeq`.
- Companion and chronicle jobs do not record.

## Readers

- `project()` folds the latest marker into `SessionProjections.presence`.
- The assemble node reads it into `AssembleOutput.presence`. No Director prompt text changes in
  this task; TASK-0050 decides how the Director uses it.
- The DM enqueuer enqueues nothing for the row.

## Reserved for later cards

TASK-0049 (`signoff`) and TASK-0050 (`floor`) build the marker row inside the gate and append it
in the same batch as the commit it fed, with `actionId` set.
