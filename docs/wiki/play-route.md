---
name: play-route
description: The play route (TASK-0047, specs/030-play-route) - one shared TableView over a TableSource (live via useLiveTable, fixture via useFixtureTable), the pure modules behind it (view-model, authority, frames, reduce-frame, proposals), live writes as gate requests, the DM approvals and ledger slide-outs, the presence strip, sign-off rows, floor controls, turn-order strip and floor lines, the Debug link, scene panels, the human DM's Table mode slide-out (TASK-0165, specs/060) and fixture routes.
kind: component
sources:
  - apps/web/app/routes/play.tsx
  - apps/web/app/routes/play-fixtures.tsx
  - apps/web/app/routes/play-fixture.tsx
  - apps/web/app/play/table-view.tsx
  - apps/web/app/play/source.ts
  - apps/web/app/play/use-live-table.ts
  - apps/web/app/play/viewer.ts
  - apps/web/app/play/use-fixture-table.ts
  - apps/web/app/play/view-model.ts
  - apps/web/app/play/authority.ts
  - apps/web/app/play/frames.ts
  - apps/web/app/play/reduce-frame.ts
  - apps/web/app/play/proposals.ts
  - apps/web/app/play/ledger-format.ts
  - apps/web/app/play/local-log.ts
  - apps/web/app/play/labels.ts
  - apps/web/app/play/presence.ts
  - apps/web/app/play/signoff.ts
  - apps/web/app/play/table-mode.ts
  - apps/web/app/play/components/action-card.tsx
  - apps/web/app/play/components/presence-strip.tsx
  - apps/web/app/play/components/table-header.tsx
  - apps/web/app/play/components/floor-controls.tsx
  - apps/web/app/play/components/turn-order.tsx
  - apps/web/app/play/components/mode-badge.tsx
  - apps/web/app/play/components/commit-control.tsx
  - apps/web/app/play/components/table-mode-panel.tsx
verified_against: 3b24274bbff5ba25bae133d7dc9bafeb9d427fdc
---

# Play route

TASK-0047 (specs/030-play-route) replaces the M0 echo page at `play/:sessionId` with the
table: a transcript, a composer, action cards with a commit control and a Withdraw control, a table-mode badge, a
ledger slide-out, and a DM approvals slide-out. Everything lives in `apps/web/app/play/`;
`routes/play.tsx` is a thin wrapper. All three routes are client-only (`clientLoader` plus
`HydrateFallback`, no server `loader`; [[react-router-app]]).

## One view, two sources

`play/table-view.tsx`'s `TableView({ source })` is the only view. A `TableSource`
(`play/source.ts`) carries the `viewer`, the `actor` id writes are recorded as, `events`,
`status`, `caughtUp`, `notice`, pending `proposals`, `presence` (the humans at the table, or
`null` when unknown) and `commands` (`sendTalk`,
`declareAction`, `comment`, `commit`, `withdraw`, `floor`, `changeScene`, `endEncounter`, `setTableMode`, `approve`, `reject`, and live-only `startScene`), `role` (the account role; absent on fixtures) and `sceneStart` (TASK-0167, specs/059: the operator's scene start state, fetched by `useLiveTable`; absent for a fixture or a non-operator). The view runs
`project(events, viewer)` from [[session-model]] and `toTableViewModel` (`view-model.ts`);
it holds only UI state (which panel is open). Two hooks build a source:

- **`useLiveTable(sessionId, user)`** (`use-live-table.ts`, used by `play.tsx`) wraps
  [[client-session-hook]]'s `useSession`. The viewer comes from `viewer.ts`'s
  `viewerFor(user, projections)`, re-derived as seat events arrive: a user holding the human DM
  seat views as `{ role: "dm" }`; every other user, operator included, views as a player with
  their own id. This matches the server's rule in `ws/registry.ts` (TASK-0045, TASK-0118). An
  operator reads DM-only data on the debug page ([[debug-view]], TASK-0117), not on `/play`.
  Nothing renders until the server sends the event back (no optimistic append).
- **`useFixtureTable(fixture, viewerKey, through, dmActor)`** (`use-fixture-table.ts`)
  replays a committed session-model fixture up to a step. Commands append to a page-local copy
  via `local-log.ts`'s `appendLocal` (seq = last + 1); the copy resets when the fixture, viewer
  or step changes.

## The Debug link

`play.tsx`'s `LiveTable` passes `TableView` a `debugHref` of `/play/<sessionId>/debug` only when
`user.role === "operator"`. `TableHeader` (`components/table-header.tsx`) then renders a "Debug"
anchor (new tab); the fixture routes pass none. The page is `play/:sessionId/debug` ([[debug-view]]).

## Start scene

TASK-0163 (specs/054), amended by TASK-0167 (specs/059). `TableView` sets `canStart` only for a
live operator source, once caught up, with no scene and `sceneStart === "none"`. A start in
flight shows a header note instead of the button. The state, the poll and the notes are in
[[scene-panels]].

## Scene panels

Two slide-outs change the scene; both live in [[scene-panels]]: the operator's Start scene
(TASK-0163) and the human DM's Change scene (TASK-0159, specs/055). `toTableViewModel` sets
`sceneChange` only when `isDm`.

With a human DM, a check's roll approval re-proposes the same roll instead of narrating
(TASK-0168, found in the TASK-0159 live check).

 composer, ledger
  and proposal lists, `hiddenCount`, `isDm`. An action card carries `canWithdraw` (open, and the
  viewer is its declarer or the DM); a `withdrawn` card is closed and shows "Withdrawn". Floor controls, the turn-order strip and floor lines: [[turn-floor]].
- `authority.ts` - `commitAuthorityFor` decides what the commit control shows. A DM viewer
  can always commit; a player goes through `commitAuthority` ([[proposal-gate]]) with the live
  present set (`null` keeps the pre-sign-off behaviour), so the control shows once the sign-off
  quorum is met. The gate enforces; this only decides the display.
- `signoff.ts` - `signoffRows` builds the per-player sign-off rows (Approved, Objects, Waiting,
  Away) for an open party-scope action from the gate's `signoffState`; null for a character
  action, a closed action or fewer than two humans. They ride `ActionCardView.signoff`;
  `ActionCard` renders them, with Approve and Object on the viewer's own row (`commentFrame`).
- `frames.ts` - builds gate requests (`talkFrame`, `declareFrame`, `commentFrame`,
  `commitFrame`, `withdrawFrame`, `floorFrame`, `sceneFrame`, `encounterEndFrame` (a `mechanics` request), `tableModeFrame`, `approveFrame`, `rejectFrame`), schema-validated,
  each with `GATE_REQUEST_VERSION`. `localEventOf` maps a frame to its catalog event for fixtures.
- `reduce-frame.ts` - `reduceFrame` folds each inbound frame into `FrameState` (`events`,
  `highestSeq` as a max, `caughtUp`, `notice`, `present`); a `presence` frame replaces `present`,
  and an unknown frame type is ignored.
- `presence.ts` - `presenceRows(present, projections)`: one row per user, marked `dm`, `player`
  or `observer`. The AI DM row shows whenever the seat is AI; a human DM seat holder is always
  listed, absent when not in `present`. A user who controls a party member is `player`, any other
  `observer`. A `null` list yields only the DM row. See [[presence]].
- `proposals.ts` - `selectPendingProposals` lists pending `proposal.*` rows for a DM viewer,
  oldest first; a player always gets `[]`. Each `PendingProposalView` carries `policy` (`ask` or
  `suggest`) from the `proposal.created` row.
- `ledger-format.ts` formats roll, outcome and change rows; `labels.ts` resolves display names.

## Presence strip

`TableView` derives rows with `presenceRows` and passes them to `TableHeader`, which renders
`components/presence-strip.tsx`: a list labelled "At the table" with one chip per row, role text
(DM, Player or Observer) and a dimmed "absent" mark. It renders nothing with no rows.
`useLiveTable` takes `presence` from `useSession`; `useFixtureTable` uses `fixturePresence`. The
strip is inline, not a panel.

## Live writes and refusals

Live writes are [[proposal-gate]] requests sent over [[ws-protocol]]'s `send` frame:
`eventType` is the request kind (`talk`, `action.declare`, `action.comment`, `action.commit`,
`action.withdraw`, `floor`, `scene`, `mechanics`, `table-mode`, `proposal.approve`, `proposal.reject`) and `payload` is the request without its `kind`.
`useSession.sendEvent` adds only permitted fields (never actor, seq or ts). A refusal arrives
as the error frame; `reduceFrame` stores `message (code)` in `notice`, which the composer shows
inline. `refusalLabel` in `labels.ts` words the floor codes and `CONFLICT` ("Send it again.");
any other code shows the server message. A refusal does not close the socket.

## Surfaces

Proposals made by the AI DM ([[dm-runtime]]) appear in the same approvals list for the human DM. The ledger and the DM approvals list open in `components/panel.tsx`'s `Panel` ([[chat-ui]]);
the project uses no modals. The approvals panel mounts only for the DM. A `suggest` row
(TASK-0100, specs/047) shows a Suggestion label and a Dismiss button, never Approve: Dismiss sends
`proposal.reject`, because the gate refuses Approve on a suggestion. An `ask` row keeps Approve and Reject; that includes `scene-presence` (policy `ask`), whose details are Actor, Reason, New value (from `REASON_TO_PRESENCE`) and Visibility `Everyone`.

## Fixture routes

`play/fixtures` (`play-fixtures.tsx`) lists fixtures; `play/fixtures/:fixtureName`
(`play-fixture.tsx`) renders one through `TableView` with a viewer and step toolbar. Both render
`OperatorOnly` for non-operators; `routes/table.tsx` links to them for operators only.

## Tests

Markup tests under `apps/web/test/play/` (vitest) cover each pure module and render
`TableView`; `equivalence.test.tsx` checks both sources render the same view.
