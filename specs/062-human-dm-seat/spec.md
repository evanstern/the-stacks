# Feature Specification: Operator seats a human DM from the web

**Feature Branch**: `task-0177-human-dm-seat`

**Created**: 2026-10-29

**Status**: Draft. OQ-1 to OQ-6 await the operator's ruling.

**Input**: TASK-0177. "On hosted dev the operator can seat a human DM (themself or another account)
and return the seat to the AI DM from the web app, with no modal, before or during a scene."
Evidence: the TASK-0176 spec author (spec 061, commit 8f8a6808, finding F-1) found that nothing in
`apps/web` sends `dm.seat`. Only the local evidence script
`specs/055-human-dm-scene-change/evidence/start-human-dm.mjs` sends it, and an agent may not sign
in on vm-104. Why: the TASK-0053 demo's second run (policy `ask`, a human DM beside three players)
needs a human DM on hosted dev. Operator ruling 2026-10-28: "Card it in m-3".

`speckit-clarify` was skipped. The gate settles what is possible. The open calls change who may act
or what a user sees, so they are operator rulings, listed as OQ-1 to OQ-6.

## Background: what exists today

### The gate already accepts the request

No gate, schema or catalog change is needed. The request exists in the frozen 029 contracts.

- **Request**: `{ kind: "dm.seat", reason: ReasonSchema, after: DmSeatSchema }`
  (`packages/session-model/src/gate/proposals.ts`). `DmSeatSchema` is `{ kind: "ai" }` or
  `{ kind: "human", userId: <uuid> }` (`gate/seat.ts`).
- **Permission**: operator role only (`gate/permissions.ts`, `case "dm.seat"`;
  `specs/029-proposal-gate/contracts/proposals.md` matrix). An operator "may seat any user id or the
  AI DM". A player, a companion and the AI DM are refused `NOT_AUTHORIZED`. A seated human DM who is
  not an operator cannot change the seat.
- **Write**: `apps/server/src/gate/gate.ts` appends one public `dm.seat.changed` row with `before` =
  the projected seat. The gate checks nothing else: not that the user exists, is at the table, or
  controls a character.
- **Wire**: a `send` frame with `eventType: "dm.seat"`, the request without its `kind`, and
  `payloadVersion: GATE_REQUEST_VERSION` (`specs/029-proposal-gate/contracts/ws-delivery.md`).

### What a seat change does

- **Viewer.** `apps/web/app/play/viewer.ts` gives the DM viewer only to the user holding the human
  seat (TASK-0118). It re-derives on every event, so the seat holder switches view on the seat row.
- **Delivery.** `apps/server/src/ws/registry.ts` delivers the seat row under the old seat, then
  filters later rows under the new one. 029 `ws-delivery.md`: "A seat change does not re-send
  earlier `dm` events to a newly seated DM's open connection; its next subscribe replays them." A
  newly seated DM therefore lacks earlier `dm` rows (hidden rolls, secret trackers, `dm`-visibility
  scene presence, earlier `proposal.created` rows) until the page reconnects (OQ-5).
- **Policy.** `effectivePolicy` is `auto` under an AI seat and the policy table under a human seat.
  AI DM proposals made after the change follow the new seat.
- **Pending proposals.** `proposal.approve` and `proposal.reject` need the seated human DM. A
  pending `ai:dm` proposal left when the seat returns to the AI has no one to decide it. The AI DM's
  beat skips an action that a pending `ai:dm` proposal names (`apps/server/src/dm/resume.ts`,
  `awaitingActionIds`), and a pending scene start keeps `sceneStartState` at `pending` (OQ-4).

### The play route cannot send it

`git grep "dm.seat" apps/web` is empty. `apps/web/app/play/frames.ts` builds no `dm.seat` frame.
`TableCommands` (`apps/web/app/play/source.ts`) has no seat command. `docs/ops/dev-vm-104.md` has no
step for it.

### Sibling work this spec follows

- Spec 054 (TASK-0163): the operator's Start scene slide-out. A live-only, operator-only command
  (`startScene?`), a header button, a `Panel`, and a select over the presence list.
- Spec 060 (TASK-0165): the human DM's Table mode slide-out. A schema-checked frame builder, a
  `TableCommands` method, an optional reason field with defaults, and additive 030 amendments.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The operator seats a human DM (Priority: P1)

The operator opens a table. Before the scene starts, or during it, the operator opens the "DM seat"
slide-out from the header. The panel reads "AI DM holds the seat." The operator picks a person from
the "Seat a human DM" list (themself, or another account at the table) and presses "Seat as DM". The
presence strip marks that person DM. That person's table switches to the DM view, with "Pending
proposals", "Change scene" and "Table mode".

**Why this priority**: card AC #1. The demo's second run needs a human DM on hosted dev.

**Independent Test**: render the panel for an operator live source with an AI seat and a presence
list. Assert the list and "Seat as DM". Run the seat command. Assert one `dm.seat` frame with
`after: { kind: "human", userId }`.

**Acceptance Scenarios**:

1. **Given** an AI seat and a present user, **When** the operator picks that user and presses "Seat
   as DM", **Then** the client sends one `dm.seat` request with `after: { kind: "human", userId }`.
2. **Given** no scene yet, **When** the operator seats a human DM and then starts a scene, **Then**
   the header shows "Scene start waiting for the DM." until the DM carries out the suggestion
   (spec 059, unchanged).
3. **Given** a scene in progress, **When** the operator seats a human DM, **Then** later AI DM
   proposals follow the policy table and reach the DM's "Pending proposals".
4. **Given** the newly seated user's open table, **When** the seat row arrives, **Then** that table
   shows the DM view with every earlier `dm` row (OQ-5 (a)).
5. **Given** a human seat, **When** the operator opens the panel, **Then** it names the seat holder
   and still offers "Seat as DM" for another present user (a direct hand-over).

### User Story 2 - The operator returns the seat to the AI DM (Priority: P1)

A human DM holds the seat. The operator opens "DM seat" and presses "Return the seat to the AI DM".
The presence strip shows the AI DM again. The former DM's table switches to the player view.

**Why this priority**: card AC #2.

**Independent Test**: render the panel with a human seat. Assert "Return the seat to the AI DM".
Run the command. Assert one `dm.seat` frame with `after: { kind: "ai" }`.

**Acceptance Scenarios**:

1. **Given** a human seat, **When** the operator presses "Return the seat to the AI DM", **Then** the
   client sends one `dm.seat` request with `after: { kind: "ai" }`.
2. **Given** an AI seat, **When** the operator opens the panel, **Then** no return button shows.
3. **Given** the operator holds the seat and has pending proposals, **When** the panel opens,
   **Then** it says "Pending proposals stay pending under the AI DM: <n>. Decide them first." The
   button still works (OQ-4 (a)).

### User Story 3 - The operator follows a runbook on hosted dev (Priority: P2)

The operator reads the "Seat a human DM" section of `docs/ops/dev-vm-104.md` and runs the assisted
table: three players and a human DM, before or during a scene.

**Why this priority**: card AC #3. The demo runs on hosted dev from that runbook.

**Independent Test**: the section exists, names every control by its accessible name, and the live
check follows it on the worktree stack.

### Edge Cases

- A non-operator viewer, or a fixture route: no "DM seat" button and no panel (OQ-6 (a)).
- Presence unknown (connecting): the panel shows "Waiting for the people at the table." and no
  select.
- No eligible user present: the panel says "No one else at the table can take the seat." and no
  select.
- The picked user leaves before the press: the gate accepts the seat anyway (it checks no presence).
  The presence strip shows the DM absent. The operator may return the seat.
- A user who controls a party character: not offered (OQ-3 (a)).
- The Start scene slide-out names the seated human DM on a character seat: the inline issue "The DM
  cannot hold a character seat." blocks Start (OQ-3 (a)).
- The operator loses the operator role mid-session: the gate refuses `NOT_AUTHORIZED`; the notice
  shows it.
- An empty reason sends the default. A reason over 500 characters fails `ReasonSchema`; nothing is
  sent, the command returns `false`, and the draft stays.
- A no-op seat change (AI to AI, or the same human again): never offered. The current holder is not
  in the select, and the return button needs a human seat.
- An AI DM turn in flight during the change: each later proposal routes under the seat projected
  when it is submitted. That is the gate working; no fix here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The play route MUST build a `dm.seat` gate request frame: `eventType: "dm.seat"`,
  `payloadVersion: GATE_REQUEST_VERSION`, `payload: { reason, after }`. It MUST parse `after` with
  `DmSeatSchema` and `reason` with `ReasonSchema`. A failing payload MUST NOT be sent.
  *(Card AC #1, #2.)*
- **FR-002**: `TableCommands` MUST gain an optional, live-only `seatDm(input)` command, as
  `startScene?` is. A fixture source MUST NOT carry it. It returns `false` when the frame did not
  leave. *(Card AC #1, #2.)*
- **FR-003**: The play route MUST give an operator a "DM seat" slide-out (`Panel`), opened from an
  operator-only header button (OQ-1 (a), OQ-6 (a)). It MUST use no modal and no confirmation
  dialog. *(Card AC #1, #2.)*
- **FR-004**: The panel MUST show who holds the seat ("AI DM holds the seat." or "<name> holds the
  seat."), one optional reason field, a "Seat a human DM" select, a "Seat as DM" button, and, under
  a human seat only, a "Return the seat to the AI DM" button.
- **FR-005**: The select MUST list the present users other than the current seat holder and other
  than any user who controls a party member (OQ-2 (a), OQ-3 (a)). The operator MUST appear in it
  when eligible, labelled "<name> (you)".
- **FR-006**: The Start scene slide-out MUST show the inline issue "The DM cannot hold a character
  seat." on a human seat assigned to the seated human DM, and block Start (OQ-3 (a)).
- **FR-007**: When the signed-in user gains the human seat on a live table after replay, the live
  source MUST re-read the session from the start, so the DM view holds every earlier `dm` row
  (OQ-5 (a)). Events MUST NOT duplicate across the re-read, and the re-read MUST NOT repeat.
- **FR-008**: When the viewer holds the seat and has pending proposals, the panel MUST show "Pending
  proposals stay pending under the AI DM: <n>. Decide them first." beside the return button
  (OQ-4 (a)). It MUST NOT block the button.
- **FR-009**: A refusal MUST show in the existing notice. The panel MUST keep its draft when the
  command returns `false`, and close when it returns `true`.
- **FR-010**: The change MUST add no gate request kind, proposal kind, event type, policy entry,
  server route or server source change. It reuses `dm.seat`.
- **FR-011**: A test MUST render the panel for an operator with an AI seat, assert the select and
  "Seat as DM", and assert the seat command sends `after: { kind: "human", userId }`.
  *(Card AC #1.)*
- **FR-012**: A test MUST render the panel with a human seat, assert "Return the seat to the AI DM",
  and assert it sends `after: { kind: "ai" }`. *(Card AC #2.)*
- **FR-013**: A test MUST assert the frame builder refuses an empty and an over-long reason and a
  malformed `after` (a non-uuid `userId`, an unknown `kind`).
- **FR-014**: A test MUST assert a player viewer and a fixture source show no "DM seat" button, and
  the panel markup holds no `role="dialog"`.
- **FR-015**: A test MUST assert the select excludes the seat holder and party controllers.
- **FR-016**: A test MUST assert the re-read rule: it fires once when the user gains the seat after
  replay, not when the seat was gained before the replay ended, not when the user loses the seat,
  and not on a seat change for someone else.
- **FR-017**: The fixture and live sources MUST stay equivalent
  (`specs/030-play-route/contracts/table-source.md` rule 5).
- **FR-018**: `docs/ops/dev-vm-104.md` MUST gain a "Seat a human DM" section: seat before a scene,
  seat during a scene, return the seat, and the assisted table (three players and a human DM).
  *(Card AC #3.)*

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the control sends the same `dm.seat` gate request an agent sends
  over `/ws` (the 055 evidence script). No human-only path.
- **CR-004** (VI. 5e engine boundary): no mechanics. The seat request computes no number.
- **CR-005** (VIII. Operator-owned content): no rulebook text.

### Card acceptance criteria map

| Card AC | Requirements | Proof |
|---|---|---|
| #1 The play route offers the operator a control that seats a human DM from a gate request, with no modal, and a test | FR-001 to FR-007, FR-009 to FR-011, FR-013 to FR-017 | `frames.test.mjs`, `dm-seat.test.mjs`, `dm-seat-panel.test.tsx`, `table-view.test.tsx`, `start-scene.test.mjs`, `no-dialog.test.mjs`, the Brave live check |
| #2 The same control returns the DM seat to the AI DM, with a test | FR-001 to FR-004, FR-008, FR-009, FR-012 | the same files |
| #3 `docs/ops/dev-vm-104.md` documents seating a human DM for an assisted table | FR-018 | the doc section; the live check follows it |

### Key Entities

- **Seat request** (029, unchanged): `{ kind: "dm.seat", reason, after: DmSeat }`.
- **Seat view** (new, web-local): `holder` (`{ kind: "ai" }` or `{ kind: "human", userId, label }`),
  `candidates` (`{ userId, label }[]`, or null when presence is unknown), `canReturn`,
  `pendingCount` (null unless the viewer holds the seat).

## Open questions

Each question changes who may act or what a user sees. The recommended option is (a). The operator
may rule "accept the recommended defaults".

### OQ-1 — Where the control lives

- **(a) Recommended.** One "DM seat" slide-out (`Panel`), opened from an operator-only "DM seat"
  header button beside "Start scene" and "Debug". It works before and during a scene.
  Consequences: one additive 030 `ui-surfaces.md` amendment, the same shape as the Table mode one.
  The header gains one more button for operators.
- **(b)** A "Human DM" select inside the Start scene slide-out.
  Consequences: no new header button. Works only before a scene (the button hides once a scene
  starts), so card AC #2 and "during a scene" are not met.
- **(c)** A per-session control on the Settings page.
  Consequences: the operator leaves the table to change the seat. Settings has no session context.

Ruling: _pending_

### OQ-2 — Whom the operator may seat

- **(a) Recommended.** Any user in the presence list (people at the table now), the operator
  included.
  Consequences: no server change. The person must open the table link first.
- **(b)** Any account, from a new operator-only account-list route.
  Consequences: a new server route and a test. The operator can seat someone not yet at the table.
- **(c)** The operator only ("Take the seat").
  Consequences: smallest. The card's "or another account" is not met; the demo's DM must be the
  operator.

Ruling: _pending_

### OQ-3 — A DM who also holds a character

- **(a) Recommended.** The select leaves out users who control a party member. The Start scene
  slide-out shows "The DM cannot hold a character seat." when a human seat names the seated human
  DM.
  Consequences: one person never holds both views. The demo's four people are four accounts (spec
  061 F-1). A client-side check joins `seatMapIssues`; the server start route is unchanged.
- **(b)** Allow it.
  Consequences: the DM viewer replaces their player view, so their composer speaks as the DM, not
  as their character. Their character sees `dm`-hidden rows.
- **(c)** Leave party controllers out of the select only; no Start scene check.
  Consequences: seating the DM first and then starting a scene can still put the DM on a character.

Ruling: _pending_

### OQ-4 — Returning the seat with pending AI DM proposals

- **(a) Recommended.** Return sends only `dm.seat`. When the viewer holds the seat and has pending
  proposals, the panel warns "Pending proposals stay pending under the AI DM: <n>. Decide
  them first." and does not block. Card the server-side fix as DC-1.
  Consequences: no server change. An operator returning another account's seat cannot see that
  account's pending proposals (`dm` rows), so gets no warning. A proposal left pending stalls its
  action: the AI DM's beat skips it, and a pending scene start keeps "Scene start waiting for the
  DM.".
- **(b)** The panel rejects each pending `ai:dm` proposal it can see, then returns the seat.
  Consequences: only works when the seat holder presses it. Each reject queues an `approval` turn
  and counts toward `REJECTION_LIMIT` (2), so a twice-rejected action is dropped.
- **(c)** Block the return while the viewer has pending proposals.
  Consequences: the seated operator must decide everything first. No help when another account
  holds the seat.

Ruling: _pending_

### OQ-5 — The newly seated DM's earlier `dm` rows

- **(a) Recommended.** When the signed-in user gains the seat after replay, the live source
  re-reads the session from the start (a fresh subscribe from `afterSeq: 0`), as 029
  `ws-delivery.md` already describes.
  Consequences: a client change in `useSession` and `useLiveTable`; no frame shape change. One full
  replay per seat gain.
- **(b)** Show a notice "Reload the page to see the DM view."
  Consequences: no hook change. The DM may act on an incomplete view until they reload.
- **(c)** Nothing.
  Consequences: hidden rolls and secret trackers before the change stay missing until a reconnect.

Ruling: _pending_

### OQ-6 — Who sees the control

- **(a) Recommended.** A live source whose account role is `operator`, seated or not.
  Consequences: matches the 029 matrix. A seated DM who is not an operator cannot hand the seat
  back; the operator does it.
- **(b)** Also the seated human DM, to hand the seat back.
  Consequences: amends the frozen 029 permission matrix (`dm.seat` becomes "operator, or the seated
  human DM to `{ kind: "ai" }`"), `permissions.ts` and its tests.

Ruling: _pending_

### Deferral candidates (cards for the orchestrator, not rulings on this card)

- **DC-1** (with OQ-4 (a)): returning the seat to the AI DM settles pending `ai:dm` proposals on the
  server (for example, the AI DM re-plans them under `auto`). A gate change; amends 029
  `gate-api.md` step 5.
- **DC-2** (only if OQ-2 (a) is ruled and seating an absent account is later wanted): an
  operator-only account list for the seat select.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator seats a human DM in at most three actions from the table (open, pick,
  press), before or during a scene.
- **SC-002**: An operator returns the seat to the AI DM in at most two actions.
- **SC-003**: Zero modals or confirmation dialogs appear in either flow.
- **SC-004**: The change adds zero gate request kinds, event types, server routes or server source
  changes.
- **SC-005**: An operator seats a human DM on hosted dev from the runbook alone.
- **SC-006**: No existing play-route or server test regresses.

## Assumptions

- Default reasons, sent when the reason field is blank: "The operator seats a human DM." and "The
  operator returns the seat to the AI DM."
- The seat holder's label is the presence display name, else "DM" (as `presenceRows` labels an
  absent seat holder).
- The web tests run in Node with no DOM library. Clicks are proven by the Brave live check.
- The live check runs on the worktree stack in script mode (`DM_FAKE_SCRIPT=greyhollow-human-dm`,
  spec 053). No provider key is used.
- Existing server tests cover the gate side of `dm.seat` (`apps/server/test/gate.integration.test.ts`
  permission case; `apps/server/test/ws.integration.test.ts` "with a human DM seated, an ask proposal
  reaches the DM and not a player, live and on replay"). This card adds no server test.
