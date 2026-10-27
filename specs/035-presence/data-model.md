# Data Model: Presence

## Presence entry (wire, in-memory)

| Field | Type | Rule |
|---|---|---|
| `userId` | uuid | an authenticated human |
| `displayName` | string | from `users.display_name`, read at upgrade |

## Tracker state (server memory, `apps/server/src/presence/tracker.ts`)

`sessionId → userId → { displayName, connIds: Set<string>, leaveTimer: Timer | null }`

| Transition | Effect | Emits change |
|---|---|---|
| join, user absent | add user with one conn | yes |
| join, user in grace | add conn, clear timer | no |
| join, user present | add conn | no |
| leave, other conns remain | remove conn | no |
| leave, last conn | remove conn, start grace timer | no |
| grace timer fires | delete user (and the table entry when empty) | yes |

A process restart empties the state. Nothing is persisted.

## Presence marker (event log)

`presence.recorded` v1 — kind `marker`, catalog visibility `any`, row visibility `public`,
actor `system`.

| Field | Type | Rule |
|---|---|---|
| `present` | uuid[] | sorted ascending, unique, at most 64 |
| `purpose` | `"director" \| "signoff" \| "floor"` | this task writes only `director` |
| `actionId` | RefId, optional | set by TASK-0049 / TASK-0050 for the action decided |

## Presence view (projection)

`SessionProjections.presence: PresenceView | null`, initially `null`.

```ts
interface PresenceView {
  present: string[];      // the latest marker's present set
  purpose: "director" | "signoff" | "floor";
  actionId: string | null;
  seq: number;            // the marker's seq
}
```

The fold replaces the view on each `presence.recorded` row. The transcript does not change.

## Assemble output (DM turn context)

`AssembleOutput.presence: { present: string[]; absent: string[]; seq: number } | null`.
`present` is the view's set; `absent` is every human party controller not in it. `null` only
when the view is `null` (a turn whose record failed never reaches assemble).

## Turn record (`jobs.result`)

Every `turn` job result gains `presenceSeq: number | null` — the seq of the marker the worker
appended for that turn.
