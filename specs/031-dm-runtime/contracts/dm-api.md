# Contract: operator HTTP routes for the DM runtime

Module: `apps/server/src/routes/dm.ts`, mounted at `/dm` in `app.ts`. Operator only, with
the same `requireOperator` rule as `/library` (401 no session, 403 not operator). Errors use
the standard `{ error: { kind, message, issues? } }` shape. Constitution I: these routes and
the WebSocket gate requests are the interface the harness (TASK-0048) drives.

## POST /dm/sessions/:sessionId/start

Body:

```json
{ "seedId": "greyhollow-ford", "seats": { "tamsin": "<userId>" } }
```

1. Validate `sessionId` (UUID) and the body (`seats` maps every `seat: "human"` character to
   a user id; no other keys). Failure: `400 validation`.
2. Load the seed (`loadSeed`). Failure: `400 validation` with the seed's issues.
3. Fold the DM projection. A non-null `scene`, or any queued or running turn job with
   trigger `scene-start` for the session: `409 conflict`.
4. Insert a turn job with trigger `scene-start` and `start: { seedId, seats }` (a plain
   insert; a unique violation on the queued-turn key is `409 conflict`). Nudge the worker.
5. Respond `202` with `{ jobId }`.

The scene-start turn sets the scene's `sceneId` to the seed id. Every later turn job loads the
seed named by `projections.scene.sceneId`, so the log alone says which seed a session plays.
A turn job for a session with no scene (never started, or ended) and no `scene-start`
trigger finishes as `empty-beat`.

> Amendment, 2026-10-28 (additive). The operator ruling of 2026-10-28 on TASK-0163 (Q5) accepted
> the `GET /dm/seeds` route. Spec 054 adds it and one start-route seat rule. Nothing above
> changes.

Start route, added seat rule (`specs/054-two-player-alpha-kit/contracts/scene-start-seats.md`,
rule 3): no user id holds two seats. A user id that already holds an earlier seat, in seed
character order, adds an issue at `seats.<id>`: `A user can hold only one seat.` The response
is `400 validation`, and no job is enqueued. `loadSeed` now accepts one or more human seats.

## GET /dm/seeds

Operator only. Lists the shipped seeds that load, with each seed's humans and companions.
The full contract is `specs/054-two-player-alpha-kit/contracts/dm-seeds.md`.

## POST /dm/sessions/:sessionId/turn

Enqueues a turn job with trigger `manual` (`ON CONFLICT DO NOTHING`). Responds `202` with
`{ jobId }` (the new or the already-queued job). Use: retry after a failed turn.

## GET /dm/sessions/:sessionId/turns?limit=20

Lists the session's DM jobs, newest first (`limit` 1..100). Each item:

```ts
{
  id: string; kind: "turn" | "companion" | "chronicle"; status: JobState;
  stage: string | null; attempts: number; trigger: TurnTrigger | null;
  createdAt: string; finishedAt: string | null;
  outcome: TurnOutcome["status"] | null;
  audit: AuditRecord | null;            // audit.md
  calls: { purpose: DmPurpose; promptVersion: string; outcome: string }[];
  error: string | null;                  // a fixed, safe message; never prompt text
}
```

The list never includes prompt text, model output, or retrieved passages. Hashes stand in
for prose (audit.md).

## Debug routes (TASK-0116)

Four read-only, operator-only `GET` routes sit beside the routes above: `events`, `jobs`,
`seed` and `calls`, all under `/dm/sessions/:sessionId/`. Their request and response shapes
live in [specs/037-debug-api/contracts/debug-api.md](../../037-debug-api/contracts/debug-api.md).
The `GET .../turns` response above does not change.
