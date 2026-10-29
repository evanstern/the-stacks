# Implementation Plan: Operator seats a human DM from the web

**Branch**: `task-0177-human-dm-seat` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: `specs/062-human-dm-seat/spec.md`. Written against OQ-1 to OQ-6 (a). A ruling other than
(a) amends this plan, the contract and tasks.md before Phase 1 dispatches.

## Summary

The play route gains one gate request builder (`dmSeatFrame`, a `dm.seat` request), one optional
live-only command (`TableCommands.seatDm?`), a pure seat view (`dmSeatView`), and an operator-only
"DM seat" header button that opens a `Panel` slide-out. The panel names the seat holder, offers a
select of eligible present users with "Seat as DM", and, under a human seat, "Return the seat to the
AI DM". The Start scene slide-out refuses a character seat for the seated human DM. When the
signed-in user gains the seat after replay, the live source re-subscribes from `afterSeq: 0`, so the
new DM sees every earlier `dm` row. `docs/ops/dev-vm-104.md` gains a "Seat a human DM" section. The
gate, the event catalog, the WebSocket protocol and the server source are unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x (erasable syntax in `apps/web/app/play/`), Node 24.
**Primary Dependencies**: React Router 8, React, `@the-stacks/session-model` (`DmSeatSchema`,
`ReasonSchema`, `GATE_REQUEST_VERSION`, `project`). No new runtime dependency.
**Storage**: none new. No migration.
**Testing**: vitest and `node --test` in `apps/web` (Node, `renderToStaticMarkup`, no DOM library).
No new server test: the gate side is covered (spec.md "Assumptions").
**Target Platform**: the existing one-process server and the SSR web app; hosted dev on vm-104.
**Project Type**: web app (monorepo: `apps/web`, `apps/server`, `packages/session-model`).
**Performance Goals**: none beyond the existing table. One extra full replay per seat gain.
**Constraints**: no modals (slide-out `Panel` only). No frozen contract change. No provider spend:
the live check uses `DM_FAKE_SCRIPT`.
**Scale/Scope**: about 10 web modules touched or added, one ops doc section, no server source.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable** — the control sends the existing `dm.seat` gate request over the
      WebSocket `send` frame. An agent sends the same request (the 055 evidence script). No
      human-only path.
- [x] **II. Content contract** — no codex entity. N/A.
- [x] **III. Data planes** — the write is a session-plane gate request. New state is UI state (the
      draft, the picked user) and a client re-subscribe.
- [x] **IV. Event sourcing** — each press writes one gate-validated `dm.seat.changed` row. No
      optimistic append. The re-subscribe replays the log; it writes nothing.
- [x] **V. Citations** — no library claim. N/A.
- [x] **VI. 5e engine boundary** — no mechanics. N/A.
- [x] **VII. Structured first** — `after` is `DmSeatSchema`-checked and `reason`
      `ReasonSchema`-checked before sending.
- [x] **VIII. Operator-owned content** — no rulebook text.
- [x] **IX. Self-hostable** — no new container or service.

**Stack conformance**: TypeScript, React Router 8, Zod via session-model. No departure.

## Research (Phase 0)

- **R1 — The gate needs no change.** Decision: reuse `dm.seat` (029 `proposals.md`, `gate-api.md`
  step 5). Operator role only; any user id or the AI DM. Alternatives: a new "take the seat" kind
  (rejected: a frozen 029 change for no gain).
- **R2 — Who sees the control.** `TableView` already gates "Start scene" on `source.kind === "live"`
  and `source.role === "operator"`. The seat button uses the same test plus `caughtUp` and
  `commands.seatDm` present (OQ-6 (a)). Fixture sources carry no `seatDm`, so
  `equivalence.test.tsx` holds (its live-shaped source has no `role`).
- **R3 — Candidates.** `source.presence` (`PresenceEntry { userId, displayName }`) is the only user
  list the client has. `dmSeatView` filters out the seat holder and every `party` member whose
  `controller` is that user (OQ-2 (a), OQ-3 (a)). The operator's own entry is labelled "(you)" by
  comparing to `source.actor` (a live source's `actor` is `user.id`).
- **R4 — The Start scene check.** `seatMapIssues(humans, seats)` gains an optional third argument
  `dmUserId: string | null`. A seat naming it yields `{ path: "seats.<id>", message: "The DM cannot
  hold a character seat." }`. `TableView` passes `project(...).gate.seat` to `StartScenePanel` as
  `dmUserId`. The server start route is unchanged; the check is client-side (OQ-3 (a)).
- **R5 — The newly seated DM's view.** The registry filters live rows under the new seat, but the
  replay that ran under the old seat filtered out `dm` rows (029 `ws-delivery.md`). Decision: on a
  seat gain after replay, `useSession` re-subscribes on the open socket from `afterSeq: 0` with its
  frame state reset. The server already handles a second `subscribe` on one connection
  (`registry.subscribe` unsubscribes first; `presence.leave` then `join`; `ws-protocol.md`: "the
  server reads it again on every `subscribe`"). Resetting the frame state first means no event
  duplicates. The trigger is a pure rule, `shouldResync(prev, next)`: true only when both are
  caught up, `prev.isDm` is false and `next.isDm` is true. A resync sets `caughtUp` false, so the
  rule cannot fire twice for one gain. Alternatives: reconnect the socket (heavier; drops presence
  for a beat), reload the page (OQ-5 (b)).
- **R6 — A former DM.** Losing the seat needs no re-read: the player view simply stops receiving
  `dm` rows, and `project` with a player viewer hides the ones already held (`canSee` in the fold).
- **R7 — Pending proposals on return.** `source.proposals` is non-empty only for a DM viewer. So
  `pendingCount` is `model.isDm ? proposals.length : null`, and the warning shows only to a seated
  operator (OQ-4 (a)). No server change; DC-1 names the server-side fix.
- **R8 — The live check needs no new DM script.** `greyhollow-human-dm` (spec 055) runs a human-DM
  scene start. The seat requests make no model call. The quickstart seats from the panel instead of
  `start-human-dm.mjs`, then starts the scene from Start scene.

## Data model (Phase 1)

Web-local types only. Full shapes: [contracts/dm-seat-control.md](contracts/dm-seat-control.md).

- `DmSeatInput { reason; after: DmSeat }` (`source.ts`).
- `DmSeatView { holder; candidates; canReturn; pendingCount }` (`dm-seat.ts`, new).

Rules:

- `holder` is `{ kind: "ai" }` or `{ kind: "human", userId, label }`. `label` is the holder's
  presence `displayName`, else "DM".
- `candidates` is null when presence is null. Otherwise each present user who is not the holder
  and controls no party member, in presence order, labelled `displayName` or `displayName (you)`.
- `canReturn` = `holder.kind === "human"`.
- A blank reason becomes `dmSeatReason("seat")` or `dmSeatReason("return")`.

## Contracts (Phase 1)

- New: [contracts/dm-seat-control.md](contracts/dm-seat-control.md) — the frame, the command, the
  view, the resync rule, the Start scene issue, the panel's accessible names.
- Amended, additive, each a dated "Amendment, TASK-0177 (additive)" block:
  - `specs/030-play-route/contracts/ui-surfaces.md` — `TableHeader` gains `seatOpen` and `onSeat`;
    a `DmSeatPanel` row; `StartScenePanel` gains `dmUserId`; accessible names (OQ-1 (a)).
  - `specs/030-play-route/contracts/live-frames.md` — the `seatDm` row (`eventType` `dm.seat`) and
    the `useSession` `resync()` addition.
  - `specs/030-play-route/contracts/table-source.md` — `TableCommands.seatDm?` (live only).
- Not amended: `specs/054-two-player-alpha-kit/contracts/scene-start-seats.md` governs the server
  start route, which is unchanged. The client-only issue "The DM cannot hold a character seat."
  lives in `contracts/dm-seat-control.md`.
- **Frozen contracts: unchanged.** `docs/wiki/ws-protocol.md` frame shapes (a second `subscribe`
  on one connection is already allowed), every `specs/029-proposal-gate/contracts/` file,
  `specs/030-play-route/contracts/proposal-seam.md`. OQ-6 (b) and DC-1 would amend 029; neither is
  in scope under the (a) defaults.

## Quickstart (Phase 1)

[quickstart.md](quickstart.md): the live check on the worktree stack in script mode.

## Project Structure

### Documentation (this feature)

```text
specs/062-human-dm-seat/
├── spec.md
├── plan.md                         # this file (research and data model inline)
├── quickstart.md                   # the live check
├── contracts/dm-seat-control.md
├── checklists/requirements.md
├── tasks.md
└── evidence/                       # created by Phase 5: mutation-guard.md, db-run.md, live-run.md, shots/
```

### Source code touched

| File | Change | Phase |
|---|---|---|
| `apps/web/app/play/frames.ts` | add `dmSeatFrame`, `dmSeatReason` | 1 |
| `apps/web/app/play/source.ts` | add `DmSeatInput`; `TableCommands.seatDm?` | 1 |
| `apps/web/app/play/dm-seat.ts` | new: `DmSeatView`, `dmSeatView` | 1 |
| `apps/web/app/play/use-live-table.ts` | `seatDm` sends `dmSeatFrame` | 1 |
| `apps/web/app/play/start-scene.ts` | `seatMapIssues` gains `dmUserId` | 2 |
| `apps/web/app/play/components/start-scene-panel.tsx` | `dmUserId` prop, passed to `seatMapIssues` | 2 |
| `apps/web/app/play/components/dm-seat-panel.tsx` | new: `DmSeatPanel`, `DM_SEAT_PANEL_ID`, click helpers | 2 |
| `apps/web/app/play/components/table-header.tsx` | `seatOpen`, `onSeat`; "DM seat" trigger | 2 |
| `apps/web/app/play/table-view.tsx` | `seatOpen` state; `canSeat`; mount `DmSeatPanel` in `Panel`; `dmUserId` to Start scene | 2 |
| `specs/030-play-route/contracts/{ui-surfaces,live-frames,table-source}.md` | additive TASK-0177 blocks | 2 |
| `apps/web/app/ws/useSession.ts` | `resync()`: reset frame state and `highestSeqRef`, re-send `subscribe` from 0 | 3 |
| `apps/web/app/play/viewer.ts` | new pure `shouldResync(prev, next)` | 3 |
| `apps/web/app/play/use-live-table.ts` | call `resync()` when `shouldResync` holds | 3 |
| `docs/ops/dev-vm-104.md` | new "Seat a human DM" section | 4 |
| `apps/web/test/play/frames.test.mjs`, `dm-seat.test.mjs` (new) | new cases | 1 |
| `apps/web/test/play/dm-seat-panel.test.tsx` (new), `table-view.test.tsx`, `start-scene.test.mjs`, `start-scene-panel.test.tsx` | new cases | 2 |
| `apps/web/test/play/viewer.test.mjs` | `shouldResync` cases | 3 |
| every test file that builds a `TableCommands` literal | none needed (`seatDm` is optional) | — |
| `specs/062-human-dm-seat/evidence/*` | mutation guard, live check, shots | 5 |
| `docs/wiki/play-route.md`, `scene-panels.md`, `client-session-hook.md`, `hosted-dev.md`, `INDEX.md`, `CAPSULES.md` (+ notes the gate flags) | re-ground | 6 |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0177 execution-log row | 6 |

No migration. No new runtime dependency. No server source file changes.

**Structure Decision**: the existing monorepo layout and the play route's
pure-module-plus-component pattern (`frames.ts`, a pure view module, a component, `TableView`
state), as specs 054 and 060 used.

## Wiki notes this task touches

`play-route`, `scene-panels`, `client-session-hook`, `hosted-dev`. `proposal-gate` and
`session-model` list no touched source and their claims do not change (the gate is unchanged); the
wiki phase re-reads them and edits only if the freshness gate flags them. `ws-protocol` is
unchanged.

## Risks

- **Re-subscribe on one socket.** `subscribe.ts` resets `pendingQueue` and `replayedThroughSeq`
  for the connection. A broadcast between `registry.subscribe` and replay end is queued, as on
  first subscribe. The live check proves it end to end; `ws.subscribe.test.ts` already covers the
  replay/live boundary.
- **`equivalence.test.tsx`** renders both sources for each fixture. Neither carries `role`
  `operator` nor `seatDm`, so no seat button renders in either.
- **`no-dialog.test.mjs`** scans the web app for dialog roles. The panel uses `Panel` only.
- **Pending proposals stranded by a return** (OQ-4): named, warned for a seated operator, carded as
  DC-1.

## Test and run notes for the orchestrator

- Implementers run `pnpm --filter @the-stacks/web test` and `pnpm ci:check` without
  `REQUIRE_DATABASE`.
- No new DB test. Phase 5 runs `REQUIRE_DATABASE=1 pnpm ci:check` once on the worktree stack
  (export only `TEST_DATABASE_URL` from the worktree `.env`). WS gateway tests are known-flaky:
  re-run once and report.

## Complexity Tracking

No constitution violations. Nothing to justify.
