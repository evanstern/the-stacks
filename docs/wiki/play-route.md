---
name: play-route
description: The play route (TASK-0047, specs/030-play-route) - one shared TableView over live or fixture sources, the pure modules, gate-request writes, the DM approvals and ledger slide-outs, the presence strip, the one composer, send router, read ring and confirm row (TASK-0315), floor controls, turn-order strip and floor lines, the table margin and strips (TASK-0236), the Debug link, scene panels, the Table mode (TASK-0165) and DM seat (TASK-0177) slide-outs and fixture routes.
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
  - apps/web/app/play/send.ts
  - apps/web/app/play/read-ring.ts
  - apps/web/app/play/table-mode.ts
  - apps/web/app/play/dm-seat.ts
  - apps/web/app/play/components/action-card.tsx
  - apps/web/app/play/components/composer.tsx
  - apps/web/app/play/components/transcript.tsx
  - apps/web/app/play/components/confirm-row.tsx
  - apps/web/app/play/components/confirm-editor.tsx
  - apps/web/app/play/components/read-ring.tsx
  - apps/web/app/play/components/presence-strip.tsx
  - apps/web/app/play/components/table-header.tsx
  - apps/web/app/play/components/floor-controls.tsx
  - apps/web/app/play/components/turn-order.tsx
  - apps/web/app/play/components/margin.tsx
  - apps/web/app/play/components/mini-strip.tsx
  - apps/web/app/play/components/status-strip.tsx
  - apps/web/app/play/conditions.ts
  - apps/web/app/play/components/mode-badge.tsx
  - apps/web/app/play/components/commit-control.tsx
  - apps/web/app/play/components/table-mode-panel.tsx
  - apps/web/app/play/components/dm-seat-panel.tsx
verified_against: bd5a8086ffd87f883519b87e12dc3168853e3c94
size_budget_exempt: spec 105 (TASK-0315) replaces the sign-off paragraph with the composer, send router, read ring and confirm row in the one play-route note; the note sat 806 chars over budget already and the table view does not split without a TASK of its own
---

# Play route

TASK-0047 (specs/030-play-route) replaces the M0 echo page at `play/:sessionId` with the
table: a transcript, one composer, action cards with a DM commit control and a Withdraw control, a table-mode badge, a
ledger slide-out, and a DM approvals slide-out. Everything lives in `apps/web/app/play/`;
`routes/play.tsx` is a thin wrapper. Routes are client-only (`clientLoader`, `HydrateFallback`, no server `loader`; [[react-router-app]]).

## One view, two sources

`play/table-view.tsx`'s `TableView({ source })` is the only view. A `TableSource`
(`play/source.ts`) carries the `viewer`, the `actor` id writes are recorded as, `events`,
`status`, `caughtUp`, `notice`, pending `proposals`, `presence` (the humans at the table, or
`null` when unknown) and `commands` (`sendTalk`,
`declareAction`, `sendIntent`, `accept`, `suggest`, `commit`, `withdraw`, `floor`, `changeScene`, `endEncounter`, `setTableMode`, `approve`, `reject`, `seatDm?` (TASK-0177, live operator sources only) and live-only `startScene`), `role` (the account role; absent on fixtures) and `sceneStart` (TASK-0167, specs/059: the operator's scene start state, fetched by `useLiveTable`; absent for a fixture or a non-operator). The view runs
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

The operator's Start scene slide-out (TASK-0163, TASK-0167): the button gate, the poll and the notes are in [[scene-panels]].

## Scene panels

The Start scene and Change scene slide-outs are in [[scene-panels]]. `toTableViewModel` sets `sceneChange` only when `isDm`.

Table margin (TASK-0236, specs/090-table-margin). `table-view.tsx` puts the stream and `Margin` (`components/margin.tsx`, an `aside` named "Table state", hidden at the `narrow:` breakpoint) in one flex row: party vitals (`vitals` from `party.ts`, [[party-panel]]), the "Turn order" list in turn mode (otherwise "Not in combat.") and conditions (`conditions.ts`). The turn-order strip no longer sits under the header ([[turn-floor]]). Between the stream and the composer, `MiniStrip` (only at `narrow:`: other members' HP and the first three in order) and `StatusStrip` (the viewer's character, HP, AC, conditions and whose turn it is) carry the same facts. All three hold no state and use only `text-muted-foreground` on `bg-card`.

With a human DM, a check's roll approval re-proposes the same roll instead of narrating
(TASK-0168, found in the TASK-0159 live check).

The composer, ledger
  and proposal lists, `hiddenCount`, `isDm`. An action card carries `canWithdraw` (open, and the
  viewer is its declarer or the DM); a `withdrawn` card is closed and shows "Withdrawn". Floor controls, the turn-order strip and floor lines: [[turn-floor]].
  The composer view carries `speakers` (the viewer's characters, or "DM", then "You (out of character)"; no "The party" entry, contract C-7), `mentions`, `mode`, `active`, `dm`, `canSend` and `hint`. Transcript items add `aside`, `confirm` and `intent` kinds (below).
- `authority.ts` - `commitAuthorityFor` decides what the commit control shows. A DM viewer
  can always commit; a player goes through `commitAuthority` ([[proposal-gate]]), but `view-model.ts` shows the Commit control to a DM viewer only. The gate enforces; this only decides the display.
- Sign-off and comment UI is removed (spec 105): no `signoff.ts`, no Comment, Approve or Object controls. Only the DM keeps the Commit control; a player's commit goes through Enter (below).
- `frames.ts` - builds gate requests (`talkFrame`, `declareFrame`, `intentFrame`, `acceptFrame`, `suggestFrame`,
  `commitFrame`, `withdrawFrame`, `floorFrame`, `sceneFrame`, `encounterEndFrame` (a `mechanics` request), `tableModeFrame`, `dmSeatFrame`, `approveFrame`, `rejectFrame`), schema-validated,
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
  `suggest`) from the `proposal.created` row. An `intent` proposal shows its kind and `toText` text ([[intent-contract]]).
- `ledger-format.ts` formats roll, outcome and change rows (`Reaction: `); `labels.ts` names, with `KIND_LABEL` and `kindLabel` for intent kinds. `detailsOf` in `proposals.ts` renders real rows for each proposal kind.

## The one composer

`components/composer.tsx` is one composer with one Send (TASK-0315, specs/105-one-composer-web). A Speaker listbox and a Mention listbox are inline, not modals. `send.ts`'s `routeSend` parses each line with the intent grammar (every slash verb) and sends an `intent` request through `intentFrame`: `commit` is `declared` in free mode and `confirmed` in turn mode. In turn mode the active player's plain prose sends `action.declare` then `action.commit` back to back, under the hint "Enter commits your turn". A parse refusal sends nothing. Fixture mode appends carrier rows only (`local-log.ts`: `localIntentEvents`, `localAcceptEvents`).

`read-ring.ts`'s `readIndicator` is hidden for 2 s, then an 8-segment ring, then "The DM is reading the table…" from the `read` marker, capped at 30 s from the marker's `ts` (`markerTs`). It is hidden in turn mode, under a human seat and for a DM viewer. While Thinking, Send becomes an interrupt strip in a `<fieldset>` (`components/read-ring.tsx`).

`components/transcript.tsx` adds the chips "Asks the DM" (an `ask_dm` line), "DM aside" and "Table talk". The `confirm` item renders `components/confirm-row.tsx`: each line has "👍 Yes" and "Not quite" (focuses the composer) or one of "Waiting on ...", "Confirmed" and "Superseded". The human DM gets "Confirm as action..." (`components/confirm-editor.tsx`, sends `action.suggest`) on a player's say line, and a Confirm control on a declared deed (kind `intent`).

## DM seat

TASK-0177 (specs/062). An operator-only "DM seat" header button opens `components/dm-seat-panel.tsx`'s
`DmSeatPanel` slide-out. `dm-seat.ts`'s `dmSeatView` gives the holder, the candidates (present users with
no party member), `canReturn` and `pendingCount`. `commands.seatDm` sends `dmSeatFrame` ([[proposal-gate]]).
`viewer.ts`'s `shouldResync` fires once when this user gains the seat; `useLiveTable` then calls `resync()`
([[client-session-hook]]).

## Presence strip

`TableView` derives rows with `presenceRows` and passes them to `TableHeader`, which renders
`components/presence-strip.tsx`: a list labelled "At the table" with one chip per row, role text
(DM, Player or Observer) and a dimmed "absent" mark. It renders nothing with no rows.
`useLiveTable` takes `presence` from `useSession`; `useFixtureTable` uses `fixturePresence`. The
strip is inline, not a panel.

## Live writes and refusals

Live writes are [[proposal-gate]] requests sent over [[ws-protocol]]'s `send` frame:
`eventType` is the request kind (`talk`, `action.declare`, `intent`, `action.accept`, `action.suggest`, `action.commit`,
`action.withdraw`, `floor`, `scene`, `mechanics`, `table-mode`, `dm.seat`, `proposal.approve`, `proposal.reject`) and `payload` is the request without its `kind`.
`useSession.sendEvent` adds only permitted fields (never actor, seq or ts). A refusal arrives
as the error frame; `reduceFrame` stores `message (code)` in `notice`, which the composer shows
inline. `refusalLabel` in `labels.ts` words the floor codes and `CONFLICT` ("Send it again.");
any other code shows the server message. A refusal does not close the socket.

## Surfaces

Proposals made by the AI DM ([[dm-runtime]]) appear in the same approvals list for the human DM. The ledger, [[party-panel]] and DM approvals open in `components/panel.tsx`'s `Panel` ([[chat-ui]]);
the project uses no modals. The approvals panel mounts only for the DM. A `suggest` row
(TASK-0100, specs/047) shows a Suggestion label and a Dismiss button, never Approve: Dismiss sends
`proposal.reject`, because the gate refuses Approve on a suggestion. An `ask` row keeps Approve and Reject; that includes `scene-presence` (policy `ask`), whose details are Actor, Reason, New value (from `REASON_TO_PRESENCE`) and Visibility `Everyone`.

## Fixture routes

`play/fixtures` (`play-fixtures.tsx`) lists fixtures; `play/fixtures/:fixtureName`
(`play-fixture.tsx`) renders one through `TableView` with a viewer and step toolbar. Both render
`OperatorOnly` for non-operators; `routes/table.tsx` links to them for operators only. The landing lists your tables (TASK-0175).

## Tests

Markup tests in `apps/web/test/play/` cover the pure modules and `TableView`.
