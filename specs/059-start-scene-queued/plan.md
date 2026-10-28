# Implementation Plan: The header stops offering Start scene once a scene start is queued

**Branch**: `task-0167-start-scene-queued` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/059-start-scene-queued/spec.md`

## Summary

Move "may this session start a scene?" into one pure server function, `sceneStartState`. The start
route's 409 reads it, and gains a `pending` rule for the human-DM path (OQ-1). A new operator-only
`GET /dm/sessions/:sessionId/start` returns it. `useLiveTable` fetches it into
`TableSource.sceneStart`. `TableView` offers "Start scene" only on `none` and drops its local flag.
Contract: `contracts/scene-start-state.md`. This plan assumes OQ-1 to OQ-4 resolve (a); a different
ruling changes the tasks named under each OQ in `tasks.md`.

## Technical Context

**Language/Version**: TypeScript (Node 24); the server (Hono) and the web app (React Router 8 SSR).

**Primary Dependencies**: none new. `listDmJobs` (`apps/server/src/dm/jobs.ts`), `loadProjections`
(already a route dependency) and the web `fetch` cover everything.

**Storage**: none. No migration. The state is derived from the projection and the `jobs` table.

**Testing**: Vitest. Pure server tests and web tests run in `pnpm ci:check`. Route and human-DM
tests are DB suites (`routes.integration.test.ts`, `human-dm-scene.integration.test.ts`) and need
`TEST_DATABASE_URL` (orchestrator-run).

**Target Platform**: the server process and the play route.

**Constraints**: no frozen contract change; no WebSocket frame; no modal; no model call; the
browser never learns a pending proposal's content (operator-only route, one state word).

**Scale/Scope**: one GET per catch-up and per start result, plus at most one GET per 5 s per open
operator tab while a start is in flight (OQ-2 (a)).

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the read is an HTTP route beside the POST, usable by the harness.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: session plane only (projection and `jobs`). No library or codex read.
- [x] **IV. Event-sourced, server authority**: nothing is written. The server alone decides the
      state; the browser renders its answer. Pending proposals stay hidden: the route is
      operator-only and returns no proposal content.
- [x] **V. Citations**: untouched.
- [x] **VI. 5e engine boundary**: no number, no engine call.
- [x] **VII. Structured first**: the state is a closed string union, checked by tests.
- [x] **VIII. Operator-owned content**: no content shipped.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. No new runtime dependency.

## Research

- **R1 — The route's 409 today** (`apps/server/src/routes/dm.ts`, `POST /sessions/:sessionId/start`):
  `projections.scene !== null` → `The session already has a scene.`; a `queued` or `running` turn
  job with trigger `scene-start` (`listDmJobs(db, id, 100, "turn")`) → `A scene start is already
  queued.`; `enqueueTurn` not inserted → `A turn is already queued for this session.` The third
  rule stays where it is.
- **R2 — Human-DM path.** `directorOpening` (`apps/server/src/dm/nodes/resolve.ts`) submits the
  `scene` proposal; under a human seat it lands `suggested` (pending, policy `suggest`). The job
  then succeeds. `human-dm-scene.integration.test.ts` case (a) proves one pending `ai:dm` scene
  proposal and no scene. R1's rules then both fail, so a second start is accepted. T003 proves it
  red before T006 changes it.
- **R3 — Server projection holds proposals.** `SessionProjections.proposals: ProposalView[]`
  (`packages/session-model/src/projections/types.ts`) with `kind`, `status`, `proposer`,
  `proposal`. The route already folds the DM projection.
- **R4 — Browser visibility.** `proposal.*` rows are `dm-only`; `viewerFor` (`apps/web/app/play/viewer.ts`)
  grants the DM viewer only to the seated human DM. Jobs never reach `/play`. So a projection-only
  client predicate is impossible for an operator who sits as a player. Hence D1's route.
- **R5 — Current client.** `TableView` holds `startQueued` local state and computes `canStart`
  without it. 030 `table-source.md` rule 1 says `TableView` holds no play state; moving the state
  into the source fixes that drift too.
- **R6 — Existing tests to extend.** `apps/server/test/dm/routes.integration.test.ts` ("starts a
  scene: 202 and a scene-start job; a second start is 409"), `human-dm-scene.integration.test.ts`
  (`humanDmWorld`), `apps/web/test/play/table-view.test.tsx` (`sourceFor`),
  `apps/web/test/play/start-scene.test.mjs` (pure helpers and `postStart`).

## Files touched

**Server**

- `apps/server/src/dm/scene-start.ts` (new): `SceneStartState`, `sceneStartState`,
  `START_CONFLICT_MESSAGE`.
- `apps/server/src/routes/dm.ts`: the POST's step 3 reads `sceneStartState`; new
  `GET /sessions/:sessionId/start`.
- `apps/server/test/dm/scene-start.test.ts` (new): pure state cases.
- `apps/server/test/dm/routes.integration.test.ts`: GET states `none`, `queued`, `started`; GET
  401, 403 and 400; the POST 409 messages.
- `apps/server/test/dm/human-dm-scene.integration.test.ts`: `pending` GET, second start 409 with no
  new job, `started` after carry-out, `none` after Dismiss.

**Web**

- `apps/web/app/play/start-scene.ts`: `fetchStartState(sessionId)`, and the pure
  `nextStartView` and `shouldPollStart` helpers.
- `apps/web/app/play/source.ts`: `SceneStartView`, `TableSource.sceneStart?`.
- `apps/web/app/play/use-live-table.ts`: the operator-only fetch, the optimistic `queued` on 202,
  the re-fetch after each start result, the OQ-2 poll.
- `apps/web/app/play/table-view.tsx`: `canStart` adds `sceneStart === "none"`; the local
  `startQueued` state goes; `startNote` derives from `sceneStart`.
- `apps/web/app/play/components/table-header.tsx`: `startNote?: "queued" | "pending"` replaces
  `startQueued?` (OQ-4 (a)).
- `apps/web/test/play/start-scene.test.mjs`: `fetchStartState`, `nextStartView`, `shouldPollStart`.
- `apps/web/test/play/table-view.test.tsx`: header per `sceneStart` value.

**Contracts and docs**

- `specs/031-dm-runtime/contracts/dm-api.md`: additive amendment (step 3, the GET).
- `specs/030-play-route/contracts/table-source.md`: additive amendment (`sceneStart`).
- `specs/030-play-route/contracts/ui-surfaces.md`: additive note on the header's start note.
- `specs/054-two-player-alpha-kit/contracts/web-surfaces.md`: additive amendment to "Play route:
  Start scene slide-out".
- `docs/ops/dev-vm-104.md`: step 17 names the pending note for a human DM.
- `specs/059-start-scene-queued/evidence/live-run.md` (new, Phase 3).

**Wiki (Phase 4)**: `docs/wiki/scene-panels.md`, `docs/wiki/play-route.md`,
`docs/wiki/dm-runtime.md`; re-pin `docs/wiki/debug-view.md`, `docs/wiki/server-entrypoint-and-app.md`, `docs/wiki/react-router-app.md`
and `docs/wiki/hosted-dev.md` where they list a touched source; `docs/wiki/CAPSULES.md`,
`docs/wiki/INDEX.md`; `docs/design/m3-table-sweep-runbook.md` (execution-log row).

**Migrations**: none. **New runtime dependencies**: none.

## Design notes

- **Precedence.** `started` beats `queued` beats `pending` (contract rules 1 to 3). A queued job
  with a pending suggestion cannot occur in one session, but the order makes the answer total.
- **Rule 3's filter.** `kind === "scene"`, `status === "pending"`, `proposer === "ai:dm"`,
  `proposal.after !== null`. With no scene, the AI DM proposes a scene only at scene start (an AI
  turn with no scene ends `empty-beat`, 031 dm-api), so the filter needs no job lookup.
- **The hook.** Keep the logic pure in `start-scene.ts` so `start-scene.test.mjs` covers it
  without React: `nextStartView(prev, event)` over the events `fetched(state)`, `fetchFailed`,
  `started202`; `shouldPollStart(view)` is true for `queued` and `pending`. `useLiveTable` wires
  them with `useEffect` and one `setInterval` that it clears on change and unmount.
- **Refusal re-fetch.** `startScene` in `useLiveTable` wraps `postStart` and fetches after every
  result. A 409 then hides the button within one request.
- **Equivalence test.** `sceneStart` is absent unless the user's role is `operator`. Confirm the
  equivalence test builds no operator live source; if it does, give the fixture side the same
  field. Do not weaken the test.

## Risks

- **T003 might pass already** (a second human-DM start already 409s through a path R1 misses).
  Then record the actual message in the test, keep OQ-1's rule only if the GET still needs it, and
  report the finding; do not skip the GET.
- **Script consumption in DB tests.** A refused POST enqueues nothing, so the human-DM script's
  queue is not consumed by the 409 case.
