# Tasks: Operator seats a human DM from the web

**Input**: `specs/062-human-dm-seat/` (spec.md, plan.md, contracts/dm-seat-control.md,
quickstart.md)

**Board task**: TASK-0177. Card AC #1: a control that seats a human DM from a gate request, no modal,
with a test. Card AC #2: the same control returns the seat to the AI DM, with a test. Card AC #3:
`docs/ops/dev-vm-104.md` documents seating a human DM for an assisted table.

**Prerequisites**: the operator rules OQ-1 to OQ-6 (spec.md). The tasks below implement (a) for
each. A different ruling amends the contract and these tasks before Phase 1 dispatches.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0177`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green (DB
suites skip without a database) and one commit led by `TASK-0177:`. No modal: slide-out panels or
autocomplete dropdowns only. Browser automation uses Brave. Do not change the `ws-protocol` frames,
`specs/029-proposal-gate/contracts/` or `specs/030-play-route/contracts/proposal-seam.md`. No
server source change. Tests are written first and seen to fail.

## Phase 1: Frame, command and seat view (card AC #1, #2; OQ-2, OQ-3)

**Goal**: the play route can build and send a `dm.seat` request, and knows whom it may offer.

**Independent test**: `node --test apps/web/test/play/frames.test.mjs apps/web/test/play/dm-seat.test.mjs`
(or the vitest runner, as each file's existing cases run).

- [x] T001 [US1] In `apps/web/test/play/frames.test.mjs`, add `dmSeatFrame` cases: `after: { kind:
      "human", userId: <uuid> }` with a reason gives `eventType: "dm.seat"`, `payloadVersion:
      GATE_REQUEST_VERSION` and `payload: { reason, after }`; `after: { kind: "ai" }` passes; a
      reason is trimmed; an empty reason, a 501-character reason, a non-uuid `userId` and an unknown
      `kind` each give null. Add `dmSeatReason("seat")` and `dmSeatReason("return")` cases with the
      contract's strings. See them fail.
- [x] T002 [US1] In `apps/web/app/play/frames.ts`, add `dmSeatReason` and `dmSeatFrame`. Parse
      `after` with `DmSeatSchema` and `reason` with `ReasonSchema` (both from
      `@the-stacks/session-model`). T001 passes.
- [x] T003 [US1] In `apps/web/app/play/source.ts`, add `DmSeatInput` and the optional
      `TableCommands.seatDm?(input): boolean` per the contract.
- [x] T004 [US1] In `apps/web/app/play/use-live-table.ts`, add `seatDm: (input) =>
      send(dmSeatFrame(input))`. Leave `use-fixture-table.ts` without it.
- [x] T005 [P] [US1] Create `apps/web/test/play/dm-seat.test.mjs`. Build projections with
      `project` over hand-written rows (a `dm.seat.changed` row and `party.member.changed` rows, as
      `viewer.test.mjs` and `presence.test.mjs` do). Cases: AI seat with presence `[op, ana, bram]`,
      where `ana` controls a party member → `holder: { kind: "ai" }`, candidates `[op (you), bram]`,
      `canReturn: false`; human seat held by `op` → `holder` labelled with op's display name,
      candidates `[bram]`, `canReturn: true`; a human holder not in presence → label `"DM"`; presence
      null → `candidates: null`; `pendingCount` passes through. See it fail (no module).
- [x] T006 [US1] Create `apps/web/app/play/dm-seat.ts` with `DmSeatCandidate`, `DmSeatView` and
      `dmSeatView` per the contract rules 1 to 3. T005 passes.
- [x] T007 Run `pnpm ci:check`.

## Phase 2: The panel, the header and the Start scene check (card AC #1, #2; OQ-1, OQ-3, OQ-4, OQ-6)

**Goal**: an operator opens "DM seat", seats a present user or returns the seat; nobody else sees it.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/play/dm-seat-panel.test.tsx test/play/table-view.test.tsx test/play/start-scene-panel.test.tsx test/play/equivalence.test.tsx`,
`node --test apps/web/test/play/start-scene.test.mjs` and `node --test apps/web/test/no-dialog.test.mjs`.

- [x] T008 [US1] Create `apps/web/test/play/dm-seat-panel.test.tsx` (`renderToStaticMarkup`). Cases:
      an AI-seat view shows "AI DM holds the seat.", the select "Seat a human DM" with one option per
      candidate, a disabled "Seat as DM", and no "Return the seat to the AI DM"; a human-seat view
      shows "<label> holds the seat." and "Return the seat to the AI DM"; `candidates: null` shows
      "Waiting for the people at the table." and no select; `candidates: []` shows "No one else at
      the table can take the seat."; `pendingCount: 2` with a human seat shows "Pending proposals
      stay pending under the AI DM: 2. Decide them first."; `pendingCount: 0` or null shows no
      warning; the markup has no `role="dialog"`. Export and assert the pure click helpers:
      `seatInput("u1", "")` gives `{ reason: dmSeatReason("seat"), after: { kind: "human", userId:
      "u1" } }`; `returnInput("  x  ")` gives `{ reason: "x", after: { kind: "ai" } }`. See it fail.
- [x] T009 [US1] Create `apps/web/app/play/components/dm-seat-panel.tsx`: `DM_SEAT_PANEL_ID =
      "dm-seat-panel"`, `DmSeatPanel({ view, onSeat })`, the helpers from T008, one "Reason
      (optional)" field, the accessible names in the contract. A command that returns false keeps
      the draft and the picked user. T008 passes.
- [x] T010 [US2] In `apps/web/test/play/dm-seat-panel.test.tsx`, add the return case: a human-seat
      view's return helper builds `after: { kind: "ai" }`; an AI-seat view renders no return button
      (card AC #2).
- [x] T011 [US1] In `apps/web/test/play/table-view.test.tsx`, add: a live caught-up source with
      `role: "operator"` and `commands.seatDm` renders a "DM seat" button with
      `aria-controls="dm-seat-panel"`, both with no scene and with a scene; a live player source, a
      live operator source before `caughtUp`, and a fixture source render none. See it fail.
- [x] T012 [US1] In `apps/web/app/play/components/table-header.tsx`, add `seatOpen` and `onSeat?`
      and the "DM seat" trigger (shown when `onSeat` is set), beside "Start scene". In
      `apps/web/app/play/table-view.tsx`, hold `seatOpen` state, compute `canSeat` per the contract,
      build the view with `dmSeatView(projected, source.presence, source.actor, model.isDm ?
      proposals.length : null)`, pass `onSeat` when `canSeat`, and mount `DmSeatPanel` in `Panel`
      (title "DM seat", description "Seat a human DM, or return the seat to the AI DM.", id
      `DM_SEAT_PANEL_ID`). Close the panel when the command returns true. T011 passes.
- [x] T013 [US1] In `apps/web/test/play/start-scene.test.mjs`, add: `seatMapIssues(humans, { tamsin:
      "dm" }, "dm")` gives the issue `{ path: "seats.tamsin", message: "The DM cannot hold a character
      seat." }`; with `dmUserId` null or omitted the existing cases are unchanged. See it fail.
- [x] T014 [US1] In `apps/web/app/play/start-scene.ts`, add the optional `dmUserId` argument to
      `seatMapIssues` (checked before the repeated-user rule). In
      `apps/web/app/play/components/start-scene-panel.tsx`, add the `dmUserId: string | null` prop
      to `StartScenePanel` and `StartSceneForm` and pass it to `seatMapIssues`. In
      `apps/web/app/play/table-view.tsx`, pass the projected human seat's `userId`, else null. Add a
      `start-scene-panel.test.tsx` case: a seat naming `dmUserId` renders the issue and a disabled
      Start. T013 passes.
- [x] T015 Confirm `apps/web/test/play/equivalence.test.tsx` and `apps/web/test/no-dialog.test.mjs`
      pass unchanged. If equivalence fails, fix the source, not the test (plan.md "Risks").
- [x] T016 Amend `specs/030-play-route/contracts/ui-surfaces.md` (`TableHeader` props, the
      `DmSeatPanel` row, `StartScenePanel.dmUserId`, accessible names), `live-frames.md` (the
      `seatDm` row) and `table-source.md` (`TableCommands.seatDm?`, live only). Each is a dated
      "Amendment, TASK-0177 (additive, <date>)" block citing
      `specs/062-human-dm-seat/contracts/dm-seat-control.md` and the operator's ruling words from
      the card. Do not rewrite earlier text.
- [x] T017 Run `pnpm ci:check`.
- [x] T019a [US1] Render the client DM-seat issue in Start scene (live-check defect, step 7).

## Phase 3: The newly seated DM's resync (card AC #1; OQ-5)

**Goal**: a user seated mid-session sees every earlier `dm` row without a reload.

**Independent test**: `node --test apps/web/test/play/viewer.test.mjs`.

- [x] T018 [US1] In `apps/web/test/play/viewer.test.mjs`, add `shouldResync` cases: player →
      DM with both caught up → true; player → DM with `prev.caughtUp` false (the seat arrived during
      replay) → false; DM → player → false; player → player (someone else seated) → false; DM → DM →
      false. See them fail.
- [x] T019 [US1] In `apps/web/app/play/viewer.ts`, add `shouldResync` per the contract. T018 passes.
- [x] T020 [US1] In `apps/web/app/ws/useSession.ts`, add `resync()`: when the socket is open, set
      the frame state to `initialFrameState`, set `highestSeqRef.current` to 0, and send
      `subscribe { sessionId, afterSeq: 0, presence: true }`; otherwise do nothing. Return it from
      the hook.
- [x] T021 [US1] In `apps/web/app/play/use-live-table.ts`, keep the previous `{ caughtUp, isDm }` in
      a ref and call `resync()` from an effect when `shouldResync(prev, next)` holds. Amend
      `specs/030-play-route/contracts/live-frames.md`'s `useSession` section with an additive
      TASK-0177 line: `resync()` re-subscribes from 0 on a seat gain, per the 029 `ws-delivery.md`
      rule "its next subscribe replays them".
- [x] T022 Run `pnpm ci:check`.

## Phase 4: The hosted-dev runbook (card AC #3)

**Goal**: an operator seats a human DM on vm-104 from the runbook alone.

**Independent test**: the section reads as one instruction per sentence and names every control by
its accessible name from the contract.

- [x] T023 [US3] In `docs/ops/dev-vm-104.md`, add a "Seat a human DM" section after "Seat three
      players". Use the existing procedural style (one imperative instruction per sentence, numbered
      steps). Cover: (1) every person opens the table link first; (2) seat before a scene: open "DM
      seat", pick the DM in "Seat a human DM", press "Seat as DM", then press "Start scene" without
      putting the DM on a character seat, and expect "Scene start waiting for the DM."; (3) seat
      during a scene, including handing the seat from one account to another; (4) return the seat
      with "Return the seat to the AI DM", and decide pending proposals first; (5) the assisted
      table: three players on `greyhollow-ford-trio` plus a fourth account as the human DM. Name the
      refusals: a player sees no "DM seat" button; the DM on a character seat shows "The DM cannot
      hold a character seat.".
- [x] T024 [US3] Run `pnpm ci:check` (markdown lint, if any).

## Phase 5: Mutation guard, DB suites and live check **[orchestrator]**

- [x] T025 **[orchestrator]** Mutation guard: (1) make `dmSeatView` keep party controllers; confirm
      `dm-seat.test.mjs` fails. (2) Make the header show "DM seat" for any live source; confirm
      `table-view.test.tsx` fails. (3) Make `shouldResync` ignore `prev.caughtUp`; confirm
      `viewer.test.mjs` fails. (4) Make `returnInput` send a human seat; confirm
      `dm-seat-panel.test.tsx` fails. Restore; `git diff` is empty. Record in
      `specs/062-human-dm-seat/evidence/mutation-guard.md`.
- [x] T026 **[orchestrator]** On the worktree stack (`pnpm env:up`, migrate both databases, restart
      the app), with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported from the worktree
      `.env`, run `REQUIRE_DATABASE=1 pnpm ci:check`. Re-run a failing WS gateway test once and
      report. Record counts in `specs/062-human-dm-seat/evidence/db-run.md`.
- [ ] T027 **[orchestrator]** Live check in Brave, script mode, per `quickstart.md` steps 1 to 14.
      Shots at 1280 px and 390 px, light and dark, in `specs/062-human-dm-seat/evidence/shots/`. No
      shot shows a modal. Record everything in `specs/062-human-dm-seat/evidence/live-run.md`,
      including any step of the new runbook section that did not match. Remove the
      `DM_FAKE_SCRIPT` line and recreate the app container. Leave the stack up.

## Phase 6: Wiki re-ground

- [ ] T028 Re-verify and re-pin `docs/wiki/play-route.md`: `TableCommands` gains `seatDm?` (live
      only); `frames.ts` builds `dm.seat`; the operator's "DM seat" slide-out; the resync on a seat
      gain (the "One view, two sources" viewer paragraph); add `dm-seat.ts` and
      `components/dm-seat-panel.tsx` to `sources:`.
- [ ] T029 Re-verify and re-pin `docs/wiki/scene-panels.md` (Start scene's "The DM cannot hold a
      character seat." issue and the `dmUserId` prop), `docs/wiki/client-session-hook.md`
      (`resync()`), and `docs/wiki/hosted-dev.md` (the "Seat a human DM" runbook section).
- [ ] T030 Re-read `docs/wiki/proposal-gate.md` and `docs/wiki/session-model.md`. Their claims about
      `dm.seat` must still hold (the gate is unchanged). Edit and re-pin only if the freshness gate
      flags them or a claim is wrong. Re-pin every other note the gate flags for a touched source
      (likely `test-suite`, `chat-ui`); re-verify each claim that names a touched file.
- [ ] T031 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Add one sentence on
      spec 062 to `docs/wiki/INDEX.md`'s state paragraph, and name the slide-out in its
      `[[play-route]]` line.
- [ ] T032 Add a TASK-0177 "(this PR)" row to the execution log in
      `docs/design/m3-table-sweep-runbook.md`, in the TASK-0165 row's shape: date, task, PR, —,
      dispatches (`spec (opus ×1), impl ×N (sonnet)`), then the outcome, the amended contracts, the
      mutation result and the live check with its shots.
- [ ] T033 Run the wiki freshness gate
      (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      prints `OK`) and the spec-bridge check
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` exits 0).
      Run `pnpm ci:check`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6. Phase 3 needs only `viewer.ts`, `useSession.ts`
and `use-live-table.ts`; it may run beside Phase 2 if the orchestrator serializes the
`use-live-table.ts` edit. Phase 4 needs the accessible names from the contract only; it may run
beside Phases 1 to 3. Phase 5 needs Phases 1 to 4.

## Story map

- US1 (seat, P1): T001 to T009, T011 to T014, T018 to T021.
- US2 (return, P1): T010, plus the shared T001 to T009.
- US3 (runbook, P2): T023, T024.
- MVP: Phases 1 and 2 (seat and return from the panel). Phase 3 closes the stale-view gap; Phase 4
  closes card AC #3.
