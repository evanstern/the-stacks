---
name: play-route
description: The play route (TASK-0047, specs/030-play-route) - one shared TableView over a TableSource (live via useLiveTable, fixture via useFixtureTable), the pure modules behind it (view-model, authority, frames, reduce-frame, proposals, ledger-format, local-log, labels), live writes as gate requests with refusal codes, the DM approvals and ledger slide-outs, the presence strip, the operator-only Debug link, and the operator-only fixture routes.
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
  - apps/web/app/play/components/presence-strip.tsx
  - apps/web/app/play/components/table-header.tsx
verified_against: 796789aff1155daf0baf77c66ba90f272100035a
---

# Play route

TASK-0047 (specs/030-play-route) replaces the M0 echo page at `play/:sessionId` with the
table: a transcript, a composer, action cards with a commit control and a Withdraw control, a table-mode badge, a
ledger slide-out, and a DM approvals slide-out. Everything lives in `apps/web/app/play/`;
`routes/play.tsx` is a thin wrapper. All three routes are client-only (`clientLoader` plus
`HydrateFallback`, no server `loader`), like the route it replaced ([[react-router-app]]).

## One view, two sources

`play/table-view.tsx`'s `TableView({ source })` is the only view. A `TableSource`
(`play/source.ts`) carries the `viewer`, the `actor` id writes are recorded as, `events`,
`status`, `caughtUp`, `notice`, pending `proposals`, `presence` (the humans at the table, or
`null` when unknown) and `commands` (`sendTalk`,
`declareAction`, `comment`, `commit`, `approve`, `reject`). The view runs
`project(events, viewer)` from [[session-model]] and `toTableViewModel` (`view-model.ts`);
it holds only UI state (which panel is open). Two hooks build a source:

- **`useLiveTable(sessionId, user)`** (`use-live-table.ts`, used by `play.tsx`) wraps
  [[client-session-hook]]'s `useSession`. The viewer comes from `viewer.ts`'s
  `viewerFor(user, projections)`, re-derived as seat events arrive: a user holding the human DM
  seat views as `{ role: "dm" }`; every other user, operator included, views as a player with
  their own id. This matches the server's rule in `ws/registry.ts` (TASK-0045, TASK-0118). An
  operator reads DM-only data on the debug page ([[debug-view]], TASK-0117), not on `/play`.
  Nothing renders
  until the server sends the event
  back (no optimistic append).
- **`useFixtureTable(fixture, viewerKey, through, dmActor)`** (`use-fixture-table.ts`)
  replays a committed `@the-stacks/session-model/fixtures` fixture up to a step. Commands
  append to a page-local copy via `local-log.ts`'s `appendLocal` (seq = last + 1, no clock
  read); the copy resets when the fixture, viewer or step changes.

## The Debug link

`play.tsx`'s `LiveTable` passes `TableView` a `debugHref` of `/play/<sessionId>/debug` when
`user.role === "operator"`, else `undefined`. `TableView` forwards it to `TableHeader`
(`components/table-header.tsx`), which renders a "Debug" anchor after the ledger and approvals
triggers only when the prop is set. The anchor opens in a new tab (`target="_blank"`,
`rel="noopener"`). The fixture routes pass no `debugHref`. The page behind the link is a separate
route, `play/:sessionId/debug` (`routes/play-debug.tsx`), described in [[debug-view]].

## Pure modules

- `view-model.ts` - `toTableViewModel`: transcript items, action cards, `ModeView`
  (free, or turn with the active actor and whether it is the viewer's turn), composer, ledger
  and proposal lists, `hiddenCount`, `isDm`. An action card carries `canWithdraw` (open, and the
  viewer is its declarer or the DM). A `withdrawn` card is closed: no commit control, no
  "Waiting for ... to commit" line, and a "Withdrawn" status.
- `authority.ts` - `commitAuthorityFor` decides what the commit control shows. A DM viewer
  can always commit; a player goes through `commitAuthority` from [[proposal-gate]]'s pure
  core. The gate enforces; this only decides the display.
- `frames.ts` - builds gate requests (`talkFrame`, `declareFrame`, `commentFrame`,
  `commitFrame`, `withdrawFrame`, `approveFrame`, `rejectFrame`) validated by `session-model` schemas, each with
  `GATE_REQUEST_VERSION`. `localEventOf` maps a frame to its catalog event for fixture mode.
- `reduce-frame.ts` - `reduceFrame` folds every inbound WebSocket frame into `FrameState`
  (`events`, `highestSeq` as a max, `caughtUp`, `notice`, `present`). A `presence` frame replaces
  `present`; a `default` branch returns the state unchanged, so a frame type the client does not
  know is ignored.
- `presence.ts` - `presenceRows(present, projections)`: one row per user, marked `dm`, `player`
  or `observer`. The AI DM row is present whenever the seat is AI. A human DM seat holder is
  always listed and shown absent when not in `present`. A present user who holds the seat is
  `dm`, one who controls a party member is `player`, any other is `observer`. A `null` list yields
  only the DM row. See [[presence]].
- `proposals.ts` - `selectPendingProposals` lists pending `proposal.*` rows for a DM viewer,
  oldest first; a player always gets `[]`.
- `ledger-format.ts` formats roll, outcome and change rows; `labels.ts` resolves actor and
  character display names from the party.

## Presence strip

`TableView` projects the events once, derives the rows with `presenceRows`, and passes them to
`TableHeader`, which renders `components/presence-strip.tsx`: a list labelled "At the table"
with one chip per row, role text (DM, Player or Observer) and an "absent" mark with a dimmed,
dashed chip. It renders nothing when there are no rows. `useLiveTable` supplies `presence` from
`useSession`; `useFixtureTable` supplies a static list from `fixturePresence` (the human DM seat
holder and each party controller). The strip is inline, not a panel, and opens nothing.

## Live writes and refusals

Live writes are [[proposal-gate]] requests sent over [[ws-protocol]]'s `send` frame:
`eventType` is the request kind (`talk`, `action.declare`, `action.comment`, `action.commit`,
`action.withdraw`, `proposal.approve`, `proposal.reject`) and `payload` is the request without its `kind`.
`useSession.sendEvent` adds only permitted fields (never actor, seq or ts). A refusal arrives
as the error frame; `reduceFrame` stores `message (code)` from the frame's `code` in `notice`,
which the composer shows inline. A refusal does not close the socket.

## Surfaces

Proposals made by the AI DM ([[dm-runtime]]) appear in the same approvals list for the human DM. The ledger and the DM approvals list open in `components/panel.tsx`'s `Panel` ([[chat-ui]]);
the project uses no modals. The approvals panel mounts only for the DM. Known gap: suggest-policy
proposals still show an Approve control (TASK-0100).

## Fixture routes

`play/fixtures` (`play-fixtures.tsx`) lists fixtures; `play/fixtures/:fixtureName`
(`play-fixture.tsx`) renders one through `TableView` with a toolbar to pick viewer and step.
Both render `OperatorOnly` for non-operators; `routes/table.tsx` shows a "Preview fixtures"
link to operators only.

## Tests

Markup tests under `apps/web/test/play/` (vitest) cover each pure module and render
`TableView`; `equivalence.test.tsx` checks both sources render the same view. Evidence:
`specs/030-play-route/ci-evidence.txt` and `evidence/live-check.md`.
