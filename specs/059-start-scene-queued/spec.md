# Feature Specification: The header stops offering Start scene once a scene start is queued

**Feature Branch**: `task-0167-start-scene-queued`

**Created**: 2026-10-28

**Status**: Draft. The operator ruled OQ-1 to OQ-4 (a) on 2026-10-28.

**Input**: TASK-0167. "After the operator starts a scene, the table header stops offering 'Start
scene' while the scene-start suggestion is pending." Evidence: the TASK-0159 spec author found that
TASK-0163's `canStart` checks `model.scene === null`. With a human DM the scene-start suggestion
stays pending, so the header shows "Start scene" and "Scene start queued." together.

`speckit-clarify` was skipped. The code settles where the truth lives (Background). The open
questions below are player-facing and contract calls, not ambiguities.

## Background: what happens today

1. The operator presses "Start scene" (TASK-0163, spec 054). `POST /dm/sessions/:id/start`
   (`apps/server/src/routes/dm.ts`) refuses with 409 when the DM projection has a scene
   (`The session already has a scene.`) or when a turn job with trigger `scene-start` is `queued`
   or `running` (`A scene start is already queued.`). Otherwise it enqueues the job and answers
   202.
2. On 202, `TableView` (`apps/web/app/play/table-view.tsx`) sets a local `startQueued` flag. The
   header shows "Scene start queued." while `model.scene === null`.
3. `canStart` is `live && role === "operator" && caughtUp && model.scene === null && startScene`.
   It does not read the flag. **So the "Start scene" button stays beside "Scene start queued."**
   on both DM paths, until the scene arrives.
4. **AI DM.** The job commits the scene itself. Between 202 and the `scene.changed` row, a second
   press gets `409 A scene start is already queued.`
5. **Human DM.** The job succeeds and leaves its `scene` proposal pending under policy `suggest`
   (`apps/server/test/dm/human-dm-scene.integration.test.ts`, case (a)). The scene stays null and
   no `scene-start` job is queued or running. **Neither 409 rule holds.** A reading of the route
   says a second start is accepted (202) and re-runs the opening moves: a second set of combatant,
   party and tracker proposals. The card says a second start gets 409. Phase 1 settles this with a
   red-first DB test (T003) before changing the route.
6. Proposal rows are `dm-only` (`packages/session-model/src/catalog.ts`). `viewerFor` gives the DM
   viewer only to the seated human DM. An operator who sits as a player cannot see the pending
   suggestion on `/play`. The client cannot see turn jobs at all. **So the browser alone cannot
   compute "a scene start is queued or pending".** Only the server can.
7. The local flag is lost on reload. After a reload during the queued or pending window, the header
   shows only "Start scene".

## Decisions

### D1 — One predicate, on the server

`sceneStartState(projections, turnJobs)` (`apps/server/src/dm/scene-start.ts`, pure) returns
`none`, `queued`, `pending` or `started` (`contracts/scene-start-state.md`). The start route's 409
reads it. A new operator-only `GET /dm/sessions/:sessionId/start` returns it. The header reads only
that answer. So the header offers "Start scene" exactly when the route would accept a start.

### D2 — The browser asks; it does not guess

`useLiveTable` fetches the state for an operator and exposes it as `TableSource.sceneStart`.
`TableView` drops its local flag. Until the first answer the state is `unknown` and the button is
hidden, so a reload never flashes a button the route would refuse. A failed fetch reads as `none`:
the operator is never locked out, and the route's 409 stays the backstop.

### D3 — No frozen contract moves

No WebSocket frame changes (`docs/wiki/ws-protocol.md`). No gate rule changes
(`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). The
amendments are additive: `specs/031-dm-runtime/contracts/dm-api.md`,
`specs/030-play-route/contracts/table-source.md`, and
`specs/054-two-player-alpha-kit/contracts/web-surfaces.md`.

### D4 — No modal

The change adds no surface. The header button hides, and a `role="status"` note shows. The Start
scene slide-out (`Panel`) is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Human DM: no second start while the suggestion waits (Priority: P1)

A human DM holds the seat. The operator starts a scene. The job succeeds and leaves the scene
suggestion pending. The operator's header shows no "Start scene" button and shows a note that the
start waits for the DM. A second `POST` gets 409.

**Why this priority**: card AC #1, on the path the card names.

**Independent Test**: the DB test over `human-dm-scene` world (T003 to T005), and the `TableView`
render test for `sceneStart: "pending"`.

**Acceptance Scenarios**:

1. **Given** a human-DM session after the scene-start job, **When** the operator sends a second
   start, **Then** the route answers `409 A scene start is waiting for the DM.` and enqueues no
   job.
2. **Given** the same session, **When** the operator sends `GET .../start`, **Then** it answers
   `{ "state": "pending" }`.
3. **Given** a live operator source with `sceneStart: "pending"` and no scene, **When** the table
   renders, **Then** no "Start scene" button renders and the OQ-4 pending note renders.
4. **Given** the DM carries out the suggestion, **When** the `scene.changed` row arrives, **Then**
   the header shows the scene title and neither the button nor the note.

### User Story 2 — AI DM: no second start while the job runs (Priority: P1)

An AI DM holds the seat. The operator starts a scene. From the 202 until the scene arrives, the
header shows "Scene start queued." and no "Start scene" button.

**Why this priority**: card AC #1 on the TASK-0163 alpha path.

**Independent Test**: the route DB test (queued state) and the `TableView` render test for
`sceneStart: "queued"`.

**Acceptance Scenarios**:

1. **Given** a queued `scene-start` job, **When** the operator sends `GET .../start`, **Then** it
   answers `{ "state": "queued" }`, and a second `POST` answers `409 A scene start is already
   queued.` (unchanged).
2. **Given** `startScene` returns `{ ok: true }`, **When** the header re-renders, **Then** it shows
   "Scene start queued." and no button, before any `GET` answers.
3. **Given** the scene committed, **When** the operator sends `GET .../start`, **Then** it answers
   `{ "state": "started" }`.

### User Story 3 — A reload keeps the header honest (Priority: P2)

The operator reloads during the queued or pending window. The header shows the note and no button,
because the state comes from the server.

**Independent Test**: the `TableView` render test for `sceneStart: "unknown"` (no button, no note)
and the hook helper tests (T012).

### Edge Cases

- **Fetch fails.** The state reads `none`; the button shows; a press that the route refuses shows
  its 409 message inline in the slide-out, as today. The 409 also triggers a fresh `GET`.
- **The DM dismisses the suggestion.** No scene, nothing pending: the state returns to `none`, and
  the button returns on the next poll (OQ-2, OQ-3).
- **Non-operator viewers.** `sceneStart` is absent; nothing changes for them (the button was never
  theirs).
- **Fixture route.** `sceneStart` is absent and `canStart` already needs a live source.
- **Equivalence (030 table-source rule 5).** The field is absent on fixture sources and on the
  non-operator live sources the equivalence test builds. The test stays green unchanged.
- **Scene later cleared.** The state returns to `none` and the button returns, as today.
- **Two operator tabs.** The second tab's button hides on its next `GET`; its press before that
  gets 409.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST compute the scene-start state with one pure function, by the rules in
  `contracts/scene-start-state.md`.
- **FR-002**: `POST /dm/sessions/:sessionId/start` MUST refuse with 409 for every state but `none`,
  with the contract's message per state, and MUST enqueue no job then.
- **FR-003**: `GET /dm/sessions/:sessionId/start` MUST return `{ state }` from the same function
  and inputs, to the operator only.
- **FR-004**: The play header MUST NOT offer "Start scene" unless the server's last answer is
  `none` (or the fetch failed).
- **FR-005**: The header MUST show a `role="status"` note while the state is `queued` or `pending`
  and no scene exists.
- **FR-006**: The live source MUST refresh the state when replay catches up, after every start
  result, and on the OQ-2 schedule.
- **FR-007**: No modal, no new WebSocket frame, no change to a frozen contract.

### Constitution Requirements

- **CR-001 (I)**: the new read is an HTTP route an agent can call, beside the POST it mirrors.
- **CR-002 (IV)**: the state is derived from the event log projection and the job table. Nothing
  is written. Pending proposals stay hidden from players: the route is operator-only and returns
  only the state word.

### Key Entities

- **SceneStartState**: `none | queued | pending | started`. Derived, never stored.
- **SceneStartView**: the browser's copy, plus `unknown` before the first answer.

## Card acceptance criteria map

| Card AC | Where it is met | Test |
| --- | --- | --- |
| #1 The header hides or disables Start scene once the session has a queued or pending scene start, with a test | D1, D2; FR-001 to FR-006; US1, US2, US3 | `scene-start.test.ts` (pure states), `routes.integration.test.ts` and `human-dm-scene.integration.test.ts` (route states and 409s), `table-view.test.tsx` (header per state), the Phase 3 live check |

## Success Criteria *(mandatory)*

- **SC-001**: On a human-DM session after the scene-start job, the operator's header shows no
  "Start scene" button, and a second start is 409 with no new job.
- **SC-002**: On an AI-DM session, from 202 to the scene, the header shows "Scene start queued."
  and no button.
- **SC-003**: The header and the route never disagree: the render tests cover every state, and the
  route tests cover every state's 409.

## Open questions

Operator ruling, 2026-10-28, answering "Do you accept the recommended defaults (a) for TASK-0167's OQ-1 to OQ-4?": "Accept all (a)".

### OQ-1 — Does the start route refuse a start while the scene suggestion is pending?

Today the route does not see the pending suggestion (Background 5). The brief requires the header
to use the route's own predicate.

- **(a) Recommended.** Add rule 3 (`pending`) to the predicate. The route answers `409 A scene
  start is waiting for the DM.` Amend `specs/031-dm-runtime/contracts/dm-api.md` step 3. This
  closes the duplicate opening moves and keeps header and route in step.
- (b) Leave the route alone; hide the button on the client only. The header and the route then
  disagree, and a second start through the API or the playtest harness still re-runs the opening
  moves.
- (c) Mark the session "started" when the scene-start job succeeds, whatever the DM does later
  (read the last succeeded `scene-start` job). A dismissed suggestion then never re-enables a
  start (see OQ-3).

Ruling: (a)

### OQ-2 — How does the operator's header learn that the state changed?

The operator often sits as a player, so the dm-only proposal rows that move the state
(`pending` to `none` on Dismiss) never reach their browser. No frame may change.

- **(a) Recommended.** Poll `GET .../start` every 5 s while the state is `queued` or `pending`, and
  stop at `none` or `started`. Also fetch on catch-up and after every start result. Operator only;
  at most one request per 5 s per open tab.
- (b) Fetch on catch-up, after every start result, and whenever a new visible event arrives. No
  timer. A dismissed suggestion leaves the button hidden until some public event or a reload.
- (c) Fetch only on catch-up and after a start result. Simplest; the header goes stale until reload.

Ruling: (a)

### OQ-3 — After the DM dismisses the scene-start suggestion, may the operator start again?

- **(a) Recommended.** Yes. Nothing is pending and no scene exists, so the state is `none` and the
  button returns. This matches the route's narrow rules and the spec 055 note that Dismiss alone
  leaves no scene. The second start re-proposes the opening moves; the DM decides them again.
- (b) No. Once a scene-start job has succeeded, the session needs a scene before another start
  (this is OQ-1 (c)). The operator then has no way out from the table if the DM dismissed by
  mistake; the DM must carry out an earlier suggestion from "Change scene".

Ruling: (a)

### OQ-4 — What does the header say while the suggestion waits for the DM?

- **(a) Recommended.** Two texts. `queued`: "Scene start queued." (unchanged). `pending`: "Scene
  start waiting for the DM." `TableHeader` takes `startNote?: "queued" | "pending"` in place of
  `startQueued?: boolean`; `ui-surfaces.md` gets an additive note.
- (b) One text, "Scene start queued.", for both. `TableHeader` is unchanged. The operator cannot
  tell a slow job from a DM who has not acted.

Ruling: (a)
