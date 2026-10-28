# Contract: scene-start state

TASK-0167. One predicate decides whether a session may start a scene. The start route's 409
and the play header both read it. Nothing else decides it.

Amends `specs/031-dm-runtime/contracts/dm-api.md` (start route, step 3, and a new read route),
`specs/030-play-route/contracts/table-source.md` (one optional field) and
`specs/054-two-player-alpha-kit/contracts/web-surfaces.md` ("Play route: Start scene
slide-out"). All three amendments are additive. No frozen contract changes: no WebSocket frame,
no `specs/029-proposal-gate/contracts/` file, no `specs/030-play-route/contracts/proposal-seam.md`
rule.

## The predicate (server)

Module: `apps/server/src/dm/scene-start.ts`. Pure. No I/O.

```ts
export type SceneStartState = "none" | "queued" | "pending" | "started";

export function sceneStartState(
  projections: SessionProjections, // the DM projection, as the start route folds it today
  turnJobs: readonly { status: string; input: unknown }[], // listDmJobs(db, id, 100, "turn")
): SceneStartState;
```

Rules, in order. The first rule that holds wins.

1. `started`: `projections.scene !== null`.
2. `queued`: a turn job has status `queued` or `running` and `input.trigger === "scene-start"`.
3. `pending`: `projections.proposals` holds a proposal with `kind === "scene"`,
   `status === "pending"`, `proposer === "ai:dm"` and a non-null `proposal.after`. (OQ-1.)
4. `none`: otherwise.

Rule 3 covers the human-DM path. There the scene-start job succeeds and leaves its `scene`
proposal pending under policy `suggest` (spec 055, `human-dm-scene.integration.test.ts` case
(a)). Under an AI DM the scene commits inside the job, so rule 1 holds as soon as the job ends.

A dismissed (rejected) suggestion is not pending. The state returns to `none`. (OQ-3.)

## POST /dm/sessions/:sessionId/start, step 3 (amended)

Step 3 now reads: compute `sceneStartState` from the DM projection and the session's turn jobs.
Any state but `none` is `409 conflict`, with this message:

| State | Message |
| --- | --- |
| `started` | `The session already has a scene.` (unchanged) |
| `queued` | `A scene start is already queued.` (unchanged) |
| `pending` | `A scene start is waiting for the DM.` (new) |

Validation (steps 1 and 2) still runs first. Step 4's unique-violation 409 is unchanged.

## GET /dm/sessions/:sessionId/start (new)

Operator only (`requireOperator`: 401 with no session, 403 when not operator). An invalid
`sessionId` is `400 validation`, as on the POST.

Response `200`:

```json
{ "state": "none" }
```

`state` is `sceneStartState` over the same two inputs the POST reads. An unknown session folds
to an empty projection and returns `none`. The body holds no other field.

## TableSource (amended)

```ts
// apps/web/app/play/source.ts (additive)
export type SceneStartView = "unknown" | "none" | "queued" | "pending" | "started";

export interface TableSource {
  // ... unchanged fields
  /** Live operator sources only. Absent for a fixture source and for a non-operator. */
  sceneStart?: SceneStartView;
}
```

`useLiveTable` fills it for a user whose role is `operator`:

- `unknown` until the first `GET` answers.
- The `GET` answer after that.
- `queued` at once when `startScene` returns `{ ok: true }`, then the next `GET` answer.
- `none` when a `GET` fails (network error or a status other than 200). The POST's 409 stays
  the backstop.

It sends a `GET` when replay catches up, after every `startScene` result (202 or refusal), and
every 5 s while the state is `queued` or `pending` (OQ-2). It stops polling at `none` or
`started`, and on unmount.

## Header (`TableView`)

- `canStart` adds `source.sceneStart === "none"`. Every other term is unchanged. So the
  "Start scene" button is absent while the state is `unknown`, `queued`, `pending` or
  `started`. The `StartScenePanel` mounts only under `canStart`, as today.
- `startQueued` becomes `model.scene === null && (sceneStart === "queued" || sceneStart ===
  "pending")`. `TableView`'s own `startQueued` state is removed; the source owns it.
- `TableHeader` gains `startNote?: "queued" | "pending"` in place of `startQueued?: boolean`
  (OQ-4). It renders, with `role="status"`:
  - `queued`: `Scene start queued.`
  - `pending`: `Scene start waiting for the DM.`
- No modal. No new panel.

## Not covered

- A second operator's start from another browser is still refused by the POST's 409. That
  browser's header catches up on its next `GET`.
- The fixture route never shows "Start scene" (unchanged: `canStart` needs a live source).
