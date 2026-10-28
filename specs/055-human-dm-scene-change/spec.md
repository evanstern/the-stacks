# Feature Specification: Human DM carries out a scene change from the table

**Feature Branch**: `task-0159-human-dm-scene-change`

**Created**: 2026-10-28

**Status**: Draft. Open questions OQ-1 to OQ-7 await an operator ruling. `plan.md` and `tasks.md` are not written until they are ruled.

**Input**: TASK-0159. "A seated human DM can change scene from the play route. That includes acting on a dismissed or pending scene suggestion." Evidence: spec 047 OQ-1 (commit c53d50f) found that `apps/web/app/play/frames.ts` builds no `scene` request.

## Background: what exists today

### The gate already accepts a scene request

The `scene` gate request exists and needs no gate change.

- **Schema** (`specs/029-proposal-gate/contracts/proposals.md`): `{ kind: "scene", summary?, rationale?, reason: ReasonSchema, after: SceneSchema | null }`. `SceneSchema` (`packages/session-model/src/events/scene.ts`) is `{ sceneId: RefId, title: 1..200, summary: 0..4000, location: 0..200 | null }`. `reason` is 1 to 500 characters.
- **Plan** (`gate-api.md`, `packages/session-model/src/gate/plan.ts`): one `scene.changed` row. The gate fills `before` from `p.scene`. It refuses `INVALID_PROPOSAL` when `before` and `after` are both null. The row is always `public`.
- **Permission** (`proposals.md` matrix): a seated human DM's `scene` request is "applied directly". It skips the policy table. The AI DM's `scene` request routes by policy. No other proposer may send one (`NOT_AUTHORIZED`).
- **Policy** (`policy-and-authority.md`): `DEFAULT_POLICIES.scene` is `suggest`. A seated human DM may override it to `ask` or `auto` with `gate.policy`. An AI seat resolves every kind to `auto`.
- **Wire** (`ws-delivery.md`, `specs/030-play-route/contracts/live-frames.md`): a `send` frame with `eventType: "scene"`, the request without its `kind`, and `payloadVersion: GATE_REQUEST_VERSION`.

### The play route cannot send it

`apps/web/app/play/frames.ts` builds `talk`, `action.declare`, `action.comment`, `action.commit`, `action.withdraw`, `floor`, `proposal.approve` and `proposal.reject` frames. It builds no `scene` frame. `TableCommands` (`apps/web/app/play/source.ts`) has no scene command. No component edits a scene.

### How a scene suggestion reaches the play route

1. The AI DM's Director proposes a scene in two places (`apps/server/src/dm/nodes/resolve.ts`). A `scene-start` turn proposes `after = { sceneId: seed.seedId, title: seed.title, summary: seed.goal.statement, location: seed.location.name }`. A scene end proposes `after: null`.
2. With a human seat, the gate records the proposal as `proposal.created` with `policy: "suggest"`. The row is `dm`-visible. It is delivered only to the seated human DM.
3. `selectPendingProposals` (`apps/web/app/play/proposals.ts`) maps it to a `PendingProposalView` with `policy: "suggest"`. Its details show only Reason and the scene title ("Clear the scene" for `after: null`). The full `after` scene stays on the projection's `ProposalView.proposal`.
4. The approvals slide-out (`components/proposal-list.tsx`, TASK-0100) shows a "Suggestion" label and Dismiss. Dismiss sends `proposal.reject` with `reason: null`. The gate refuses Approve on a suggestion (`PROPOSAL_NOT_APPROVABLE`).
5. A dismissed suggestion is `rejected` on the projection. It leaves the pending list. Its `proposal` body stays on `p.proposals`.

### Why a human DM needs it: the AI DM reads the scene id

The AI DM loads its scene seed by `p.scene.sceneId` on every non-start turn (`apps/server/src/dm/worker.ts`, `currentSeed`). With no scene it returns `no-scene`. With an unknown id it returns `bad-seed`. With a human seat, the scene-start suggestion stays pending, so `p.scene` stays null. The AI DM therefore cannot run later turns until the human DM carries out a scene whose `sceneId` names a seed. This is what blocks the M3 demo's second run (TASK-0053, checkpoint C7: `ask` mode with a human DM).

A direct `scene.changed` row from the human DM enqueues no DM turn (`apps/server/src/dm/enqueue.ts`). A `proposal.rejected` row on an `ai:dm` proposal does enqueue one.

### Sibling work

- TASK-0163 (PR #79, open): an operator-only "Start scene" slide-out (`apps/web/app/play/components/start-scene-panel.tsx`) and `GET /dm/seeds`. It is a pattern for a slide-out. This spec does not depend on its code.
- TASK-0141 (spec 048) and TASK-0050 (spec 049) show the amendment pattern for a new request on the play route: `floorFrame`, `TableCommands.floor`, `onFloor` on `TableHeader`, ruled into `ui-surfaces.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The DM carries out a scene suggestion (Priority: P1)

A human DM holds the seat. The AI DM suggests "Inside the vault". The DM opens the scene-change control from the suggestion. The control holds the suggested title, summary, location and reason. The DM edits the summary and applies it. The table's header shows the new scene. The AI DM's next turn loads the same seed.

**Why this priority**: it is card AC #1 and AC #2, and it unblocks the C7 demo run.

**Independent Test**: render the table for the `dm-approvals` fixture's DM viewer. Open the control seeded from P3. Assert it holds P3's `after`. Apply it. Assert one `scene` frame (live) or one `scene.changed` row (fixture) with `sceneId: "vault-interior"` and the edited summary.

**Acceptance Scenarios**:

1. **Given** a pending scene suggestion, **When** the DM seeds the control from it, **Then** the control shows the suggestion's title, summary, location and reason.
2. **Given** a seeded control, **When** the DM applies it, **Then** the client sends one `scene` request whose `after.sceneId` equals the suggestion's `sceneId`.
3. **Given** a live table, **When** the `scene.changed` row arrives, **Then** the header shows the new title and location.
4. **Given** a suggestion with `after: null` ("Clear the scene"), **When** the DM carries it out, **Then** the client sends `after: null`.
5. **Given** a dismissed scene suggestion, **When** the DM seeds the control from it, **Then** the control shows that suggestion's content (OQ-1 decides where the DM finds it).

### User Story 2 - The DM edits the current scene (Priority: P2)

A scene is set. No suggestion is pending. The DM opens the control. It holds the current scene. The DM changes the location and applies it.

**Why this priority**: card AC #1 says "a scene-change control". It does not limit the control to suggestions.

**Independent Test**: render the control for a DM viewer with a current scene and no pending suggestion. Assert it holds the current scene. Apply an edit. Assert one `scene` request with the current `sceneId`.

**Acceptance Scenarios**:

1. **Given** a current scene, **When** the DM opens the control unseeded, **Then** it holds the current scene's fields.
2. **Given** an edited control, **When** the DM applies it, **Then** the request keeps the current `sceneId`.
3. **Given** a refused request, **When** the error frame arrives, **Then** the composer notice shows the refusal and the control keeps its draft.

### Edge Cases

- No current scene and no scene proposal: the control has nothing to seed from. OQ-7 decides what it shows.
- A player viewer, or an operator who is not seated: the control does not render (FR-009).
- The DM loses the seat while the control is open: the gate refuses `NOT_AUTHORIZED`, and the notice shows it.
- A title over 200 characters, a summary over 4000, a location over 200, or an empty reason: the frame fails its schema and is not sent. The command returns `false` and the draft stays.
- Clearing the scene when no scene is set: the client does not offer it, because the gate would refuse `INVALID_PROPOSAL`.
- Two scene suggestions are pending: each one can seed the control. OQ-3 decides which one is closed.
- Turn mode with an active encounter: OQ-5 decides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The play route MUST build a `scene` gate request frame (`eventType: "scene"`, `payloadVersion: GATE_REQUEST_VERSION`, `{ reason, after, summary?, rationale? }`). It MUST parse `after` with `SceneSchema` and `reason` with `ReasonSchema` before sending. A failing payload MUST NOT be sent. *(Card AC #1.)*
- **FR-002**: `TableCommands` MUST gain one scene command that sends the frame (live) or appends one `scene.changed` row with `before` from the projection (fixture). It returns `false` when the request did not leave. *(Card AC #1.)*
- **FR-003**: The play route MUST give a seated human DM a scene-change control. The control holds the scene fields OQ-2 names and a reason. One Apply click sends one request. *(Card AC #1.)*
- **FR-004**: The control MUST be a slide-out panel or an inline control. It MUST use no modal and no confirmation dialog. *(Card AC #1.)*
- **FR-005**: The control MUST be seedable from a scene proposal's content: `after.sceneId`, `after.title`, `after.summary`, `after.location`, `reason`, or the clear-scene choice when `after` is null. Seeding MUST read the proposal body from the projection's `ProposalView.proposal`, never from the display strings in `PendingProposalView.details`. *(Card AC #2.)*
- **FR-006**: A seeded control MUST keep the seed's `sceneId` unchanged in the request, so the AI DM can load the same seed. *(Card AC #2.)*
- **FR-007**: An unseeded control MUST start from the current scene, and keep its `sceneId`. *(Card AC #1.)*
- **FR-008**: A refusal MUST show in the existing notice. The control MUST keep its draft when the command returns `false`.
- **FR-009**: The control MUST render only when the viewer is the seated human DM (`model.isDm`). It MUST NOT render for a player or an unseated operator.
- **FR-010**: The change MUST add no gate request kind, proposal kind, event type, policy entry or server code path. It reuses the existing `scene` request.
- **FR-011**: A test MUST render the control for the `dm-approvals` DM viewer, seed it from P3, apply it, and assert the request carries P3's `sceneId` and the edited fields. *(Card AC #1, AC #2.)*
- **FR-012**: A test MUST assert `sceneFrame` refuses an over-long title and an empty reason, and builds `after: null` for a clear.
- **FR-013**: A test MUST assert the control does not render for a player viewer.
- **FR-014**: The fixture and live sources MUST stay equivalent (`specs/030-play-route/contracts/table-source.md` rule 5) for a table with the control closed.

### Card acceptance criteria mapping

| Card AC | Requirement | Proof |
|---|---|---|
| #1 The play route offers a human DM a scene-change control built from a gate scene request, with no modal, and a test | FR-001 to FR-004, FR-007 to FR-011, FR-013, FR-014 | `frames.test.mjs`, the control's component test, `table-view.test.tsx`, a live Brave check |
| #2 A scene suggestion's content can seed that control | FR-005, FR-006, FR-011 | the seed module's test, the control's component test |

### Key Entities

- **Scene request** (029, unchanged): `{ kind: "scene", reason, after: Scene | null }`.
- **Scene seed** (new, web-local): the content a control starts from. Fields: `sceneId`, `title`, `summary`, `location`, `reason`, `clear` (true when `after` is null), and the source `proposalId` or null for the current scene.
- **ProposalView** (028/029 projection, unchanged): carries the full proposal body the seed reads.
- **PendingProposalView** (030 frozen seam): unchanged under the recommended defaults.

## Open questions

Each question changes a frozen contract or behaviour a DM sees. The recommended default is marked. The operator rules each one. `speckit-clarify` was not run: these are operator rulings, not ambiguities a clarification round settles.

### OQ-1 — Where the control lives, and how a suggestion seeds it

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | A "Scene" slide-out (`Panel`), opened from a DM-only "Change scene" header button. The panel lists scene proposals as seeds: each pending one, then each dismissed one from the last ten scene proposals. One click on a seed fills the form. `TableHeader` gains `sceneOpen` and `onScene` props. `ProposalList` props are unchanged. | One frozen-surface amendment: `TableHeader` props (`specs/030-play-route/contracts/ui-surfaces.md`), the same shape as TASK-0050's `onFloor`. Dismissed suggestions are reachable (card text: "a dismissed or pending scene suggestion"). The suggestion row itself has no new button. |
| B | Option A, plus a "Carry out" button on each scene suggestion row in the approvals list. It opens the Scene panel seeded from that row. | Most direct from the suggestion. Amends `ProposalList` props as well (frozen by `specs/030-play-route/contracts/proposal-seam.md`, "every component's props"). Two panels in one flow. |
| C | No new panel. A "Carry out" row button applies the suggestion as is, and an inline edit form expands in the row. | No header change. Amends `ProposalList` props. Dismissed suggestions are not reachable, because they leave the list. Fails "dismissed" in the card text. No unseeded control (User Story 2). |

### OQ-2 — Which scene fields the DM edits

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | The DM edits title, summary, location and reason. `sceneId` comes from the seed (a proposal or the current scene) and is shown read-only. A "Clear the scene" choice sends `after: null`. | The AI DM can always load its seed (`currentSeed` reads `p.scene.sceneId`). The DM cannot author a brand-new scene. |
| B | Option A, plus "New scene": the DM types a title, and the client derives a `sceneId` slug. | The DM can author freely. The AI DM's next turn fails `bad-seed` on an unseeded id, so an `ask`-mode table stalls. Needs a server rule for unseeded scenes, which is out of this card's scope. |
| C | No edits. The control carries out a seed exactly as proposed. | Smallest UI. Fails User Story 2 and the card's "change scene" outcome. |

### OQ-3 — What happens to the source suggestion after the DM carries it out

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | When the control was seeded from a pending proposal, Apply sends the `scene` request and then `proposal.reject` (`reason: null`) on that proposal, back to back. It sends the reject only when the scene frame left. | The suggestion leaves the list in one click. The `proposal.rejected` row re-queues an AI DM turn ([[dm-turn-jobs]]), so the AI DM continues in the new scene. The gate orders a session's writes in arrival order (TASK-0157), and both requests share the same authority checks, so a refused scene with an accepted reject needs an `INVALID_PROPOSAL` the client already prevents. |
| B | Apply sends only the `scene` request. The suggestion stays pending until the DM clicks Dismiss. | One request per click. The AI DM gets no turn until the DM dismisses. The DM must remember a second step. |
| C | Apply sends the `scene` request. The client sends the reject after the `scene.changed` row arrives. | Never closes the suggestion on a refused scene. Needs pending-send state in the live source and a different path in the fixture source. |

### OQ-4 — Which scene proposals may seed the control

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | Any `scene` proposal from `ai:dm`, whatever its recorded policy (`suggest` or `ask`). | A DM who set `scene` to `ask` can edit the proposal before applying it, instead of Approve as is. Under OQ-3 A, an `ask` source is rejected after the edit lands. |
| B | Only `suggest` proposals. | Matches the card's wording exactly. An `ask` scene proposal can only be approved as is or rejected. |

### OQ-5 — A scene change in turn mode

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | The control works in free and turn mode. It changes only the scene. The panel shows "The table stays in turn mode" when the mode is turn. | Matches the gate, which does not check table mode for `scene`. The play route has no human-DM control to end an encounter or set free mode, so the encounter continues. That gap is a deferral candidate for a card. |
| B | The control is disabled in turn mode. | Avoids a scene change mid-encounter. Blocks the DM until the AI DM ends the encounter. |
| C | In turn mode, Apply also ends the encounter and sets free mode, as the AI DM's scene end does. | Needs `mechanics` and `table-mode` frames the play route does not build. Larger scope than the card. |

### OQ-6 — Who besides a seated human DM may use the control

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | Only the seated human DM. The control renders when `model.isDm`. | Matches the gate matrix. No gate change. An operator seats themself first (`dm.seat`). |
| B | Also an unseated operator. | Amends the frozen 029 permission matrix and `viewerFor` (an operator views as a player on `/play`). |

### OQ-7 — No scene and no scene proposal

| Option | Change | Implications |
|---|---|---|
| **A (recommended)** | The panel says "No scene to change yet. Start a scene, or wait for the AI DM's suggestion." and shows no form. | No new route. The operator starts a scene through `POST /dm/sessions/:id/start` (TASK-0163's slide-out once PR #79 merges), and its suggestion then seeds the control. |
| B | The panel offers a seed picker from `GET /dm/seeds`. | Depends on PR #79. `GET /dm/seeds` is operator-only, so a non-operator human DM gets 403. Applying a seed's scene skips the scene-start turn (combatants, party), so the table is half set up. |

### Deferral candidates (need a card from the orchestrator, not rulings on this card)

- **DC-1**: the play route gives a human DM no control to end an encounter or change table mode (OQ-5 A).
- **DC-2**: a human DM cannot author a scene with no seed, because the AI DM cannot run one (OQ-2 A). This is a maybe: card it only with a revisit trigger.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seated human DM carries out a pending scene suggestion in at most three clicks from the table.
- **SC-002**: After the DM carries out a seed-start suggestion, the AI DM's next turn loads the same seed (no `no-scene` or `bad-seed` failure).
- **SC-003**: Zero modals or confirmation dialogs appear in the flow.
- **SC-004**: The change adds zero gate request kinds, proposal kinds, event types or server code paths.
- **SC-005**: No existing play-route test regresses.

## Assumptions

- The recommended defaults OQ-1 to OQ-7 (A) hold unless the operator rules otherwise. The FRs above are written against them.
- `rationale` is left null on the DM's own request. `summary` is set to "Scene: <title>" or "Clear the scene".
- A suggestion's content is read from the projection, which already carries rejected proposals.
- The web tests run in Node with no DOM library (TASK-0163 note). Clicks are proven by a live Brave check, not unit tests.
- No database test is needed: no server code changes. If the plan adds one, the orchestrator runs it.
