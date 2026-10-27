---
description: "Task list for presence (TASK-0051)"
---

# Tasks: Presence — who is at the table

**Input**: `specs/035-presence/` — spec.md, plan.md, research.md, data-model.md, quickstart.md,
contracts/ws-presence.md, contracts/presence-reader.md, contracts/presence-marker.md.
Carriage: decision-0024 (D16, option D).

**Tests**: required (spec FR-017). Every card AC is proven by a named test or the Brave run.

**Dispatch unit**: each phase is one Sonnet implementer dispatch. Run phases in order 1, 2, 3,
4, 5. Phase 3 needs Phases 1 and 2. Phase 4 needs Phases 1 and 2.

**Before each phase**: merge `origin/main` into the branch. Re-read this spec dir and the
branch's commits.

**Gate for every phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm check:boundaries`, plus the phase's package tests below.
Phase 4 and Phase 5 run `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Migrate both databases
by hand. Restart the app. Run the suites with `REQUIRE_DATABASE=1`. Leave the stack up.

**Known flake**: WebSocket gateway integration tests flake. Re-run once on a failure in a WS
test the phase did not change. Record each re-run in the phase's commit message.

**Commits**: one or more per phase, each message led by `TASK-0051:`.

**Product rules**: no modals; slide-out panels or autocomplete dropdowns only. Browser
automation uses Brave. No "for now" without a card.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 decision record on carriage | decision-0024 (merges in this PR); T001 cites it |
| #2 every client sees present players and the DM | T013, T014, T030–T036, T037 (Brave) |
| #3 disconnect updates presence within a stated timeout | T008, T011, T013, T014 |
| #4 gate and Director read presence through one interface | T008, T018–T026 |
| #5 tests cover join, leave and reconnect | T013, T014, T026, T029 |

---

## Phase 1: Session model — the marker event (Foundational; FR-018, FR-021)

**Goal**: `presence.recorded` v1 is catalogued and folds into a `presence` view.

**Independent test**: `pnpm --filter @the-stacks/session-model test` passes with the new suite.

- [x] T001 Create `packages/session-model/src/events/presence.ts`: `PRESENCE_PURPOSES`
  (`director`, `signoff`, `floor`) and `PresenceRecordedV1` per contracts/presence-marker.md.
  Refine `present` to sorted ascending and unique. Cite decision-0024 in the file comment.
- [x] T002 Add `presence.recorded` to `sessionEntries` in `packages/session-model/src/catalog.ts`:
  kind `marker`, visibility `any`. Add its payload to `SessionPayloads`.
- [x] T003 Add `PresenceView` and `SessionProjections.presence` in
  `packages/session-model/src/projections/types.ts` per data-model.md.
- [x] T004 In `packages/session-model/src/projections/apply.ts`, start `presence` at `null`.
  Replace it on each `presence.recorded` row. Do not add a transcript entry.
- [x] T005 [P] Export the schema, purposes and view type from
  `packages/session-model/src/index.ts`. Update `packages/session-model/test/exports.test.ts`.
- [x] T006 [P] Add a `presenceMarker` stream to `packages/session-model/src/fixtures/index.ts`
  (two `director` markers with different sets, plus talk rows). Update `fixtureIds` and
  `packages/session-model/test/fixtures.test.ts`.
- [x] T007 Write `packages/session-model/test/presence.test.ts`: the catalog entry's kind and
  visibility; schema rejects unsorted, duplicate and over-64 `present`; the fold keeps the
  latest marker with its `seq`; the transcript is unchanged; a player viewer sees the view;
  `project()` replays deterministically. Update `packages/session-model/test/catalog.test.ts`.

**Phase gate**: `pnpm --filter @the-stacks/session-model test`.

---

## Phase 2: Live presence and the protocol amendment (US1, US2; FR-002–FR-005, FR-008–FR-013)

**Goal**: the server tracks presence, sends opted-in clients snapshots, and detects silent loss.

**Independent test**: two WebSocket clients on one table see each other join and leave in
`apps/server/test/ws.presence.integration.test.ts`.

- [x] T008 [US2] Create `apps/server/src/presence/constants.ts`, `tracker.ts` and `index.ts` per
  contracts/presence-reader.md and the tracker table in data-model.md. Accept `graceMs`,
  `setTimer` and `clearTimer` options. `isPresent` returns true for actors starting `ai:`.
- [x] T009 [US1] In `apps/server/src/ws/protocol.ts`, add optional `presence: z.boolean()` to
  `SubscribeFrame`. Add `PresenceFrame` to `OutboundFrame` per contracts/ws-presence.md. Update
  the frozen-contract comment to cite decision-0024.
- [x] T010 [US1] In `apps/server/src/ws/registry.ts`, add `connId`, `displayName`,
  `wantsPresence` and `alive` to `Connection`. Add `sendPresence(sessionId, frame)`: send to
  subscribers with `wantsPresence` and `pendingQueue === null` only.
- [x] T011 [US1] [US2] In `apps/server/src/ws/gateway.ts`: take a `presence` tracker and an
  optional `heartbeatIntervalMs` in `CreateGatewayOptions`. Read `users.display_name` at
  upgrade. On subscribe, `leave` the previous table and `join` the new one, for every
  connection whether or not it opted in. On close, `leave`. Subscribe to `onChange` and call
  `registry.sendPresence` with a sorted snapshot. Run the heartbeat: ping every interval,
  `terminate()` a connection whose `alive` is still false, set `alive` on `pong`. Clear the
  interval when the server closes.
- [x] T012 [US1] In `apps/server/src/ws/subscribe.ts`, after `replay-complete`, send the
  connection its snapshot when `wantsPresence` is set.
- [x] T013 [US1] [US2] Wire `createPresence()` in `apps/server/src/index.ts` before
  `createGate`, and pass it to `createGateway`. Write
  `apps/server/test/presence.tracker.test.ts` with injected timers: join emits; second tab
  does not; one tab closing keeps the user; last close emits after grace only; rejoin inside
  grace emits nothing; restart (new tracker) is empty; `isPresent` for AI actors.
- [x] T014 [US1] [US2] Write `apps/server/test/ws.presence.integration.test.ts` with short
  grace and heartbeat: a second subscriber's arrival reaches the first; snapshot arrives after
  `replay-complete`; a close reaches the other within the bound; a reconnect inside grace sends
  no absent snapshot; a client that stops answering pings is terminated and goes absent;
  multi-tab; a subscribe without `presence` receives no `presence` frame (SC-005); a
  re-subscribe to another table leaves the first. Update
  `apps/server/test/ws.protocol.test.ts` for the new field.
- [x] T015 [P] [US1] Amend `specs/006-ws-gateway/contracts/ws-protocol.md`: add the `presence`
  field and frame, the heartbeat line, and "Amended by decision-0024 and
  specs/035-presence/contracts/ws-presence.md."

**Phase gate**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test`.

---

## Phase 3: The marker writer and the Director (US3; FR-012–FR-016, FR-019–FR-023)

**Goal**: each DM turn appends one marker through the gate, and assemble reads it.

**Independent test**: a DB test runs one fake-gateway turn with one of two players present and
finds one public `presence.recorded` row naming only the present player, and `presenceSeq` in
`jobs.result` (SC-006).

- [x] T016 [US3] In `apps/server/src/gate/gate.ts`, add `GateDeps.presence?: PresenceReader`
  (default: no humans present). Export the type through `apps/server/src/gate/index.ts`.
- [x] T017 [US3] Add `Gate.recordPresence(sessionId, { purpose, actionId? })` per
  contracts/presence-marker.md: actor `system`, visibility `public`, `expectedLastSeq`, the
  existing bounded retry, `onAppended` notification, no deduplication. Leave `submit` and
  `handle` unchanged.
- [x] T018 [US3] Pass the tracker's reader to `createGate` in `apps/server/src/index.ts`.
- [x] T019 [US3] In `apps/server/src/dm/worker.ts`, widen `gate` to
  `Pick<Gate, "submit" | "recordPresence">`. Call `recordPresence(sessionId, { purpose:
  "director" })` once per claimed `turn` job, before `runTurn`. On a refusal or throw, finish
  the job failed with `failure.node = "presence"`. Add `presenceSeq` to every `turn` job result.
  Companion and chronicle jobs do not record. Keep the "never calls gate.submit" comment true.
- [x] T020 [US3] In `apps/server/src/dm/nodes/assemble.ts`, add `AssembleOutput.presence`
  (`present`, `absent`, `seq`) from `projections.presence` and the party's human controllers.
  Do not change any Director prompt text.
- [x] T021 [US3] In `apps/server/src/playtest/harness.ts`, inject a static reader that names
  the scripted seat's user present (CR-001).
- [x] T022 [P] [US3] Add `recordPresence` to the gate fakes in `apps/server/test/dm/world.ts`
  and `apps/server/test/dm/worker-world.ts`.
- [x] T023 [P] [US3] Write `apps/server/test/gate.presence.integration.test.ts`: the row's
  type, version, actor, visibility and sorted payload; one row per call with an unchanged set;
  retry on a seq conflict; listeners receive the row; an AI-only table records `present: []`.
- [x] T024 [US3] Extend `apps/server/test/dm/assemble.test.ts`: present and absent split from a
  folded marker; `null` view gives `null`.
- [x] T025 [US3] Extend `apps/server/test/dm/worker.integration.test.ts`: one marker per turn
  job, two turns give two markers, `presenceSeq` matches, companion jobs record nothing, a
  failed record fails the turn.
- [x] T026 [US3] Add a test that the DM enqueuer enqueues nothing for a `presence.recorded` row
  (in `apps/server/test/dm/jobs.integration.test.ts` or beside the enqueuer's existing test).
  Confirm `apps/server/test/write-boundary.test.ts` passes unchanged.

**Phase gate**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test` and
`pnpm playtest run` in scripted mode.

---

## Phase 4: The presence strip (US1; FR-005–FR-007, FR-024; merge condition)

**Goal**: the play route shows who is at the table, and stale tabs survive new frames.

**Independent test**: the runbook merge condition — two Brave sessions on one table each see
the other join and leave. Screenshots in the PR.

- [ ] T027 [US1] In `apps/web/app/ws/types.ts`, add `presence?: boolean` to the subscribe shape
  and `PresenceFrame` to `ServerFrame`, matching contracts/ws-presence.md.
- [ ] T028 [US1] In `apps/web/app/play/reduce-frame.ts`, add `present: PresenceEntry[] | null`
  to `FrameState` (initially `null`). Add a `presence` branch that replaces it. Add a `default`
  branch that returns `state` unchanged.
- [ ] T029 [US1] Extend `apps/web/test/play/reduce-frame.test.mjs`: the `presence` branch, an
  unknown frame type leaves state unchanged, events still accumulate.
- [ ] T030 [US1] In `apps/web/app/ws/useSession.ts`, send `presence: true` on subscribe, expose
  `present`, and reset it to `null` on disconnect.
- [ ] T031 [US1] Add `presence: PresenceEntry[] | null` to `TableSource` in
  `apps/web/app/play/source.ts`. Supply it from `apps/web/app/play/use-live-table.ts`. Supply a
  static list from `apps/web/app/play/use-fixture-table.ts`.
- [ ] T032 [P] [US1] Create `apps/web/app/play/presence.ts`: pure `presenceRows(present,
  projections)` returning rows marked `dm`, `player` or `observer`. The AI DM is present
  whenever the seat is AI. A human DM seat whose holder is absent shows absent. One row per
  user.
- [ ] T033 [P] [US1] Write `apps/web/test/play/presence.test.mjs` for `presenceRows`: AI seat,
  human seat present and absent, observer, party player, dedup.
- [ ] T034 [US1] Create `apps/web/app/play/components/presence-strip.tsx` and render it in
  `apps/web/app/play/components/table-header.tsx`. No modal; a detail view, if any, is a
  slide-out panel.
- [ ] T035 [US1] Write `apps/web/test/play/presence-strip.test.tsx`. Confirm
  `apps/web/test/no-dialog.test.mjs` passes.
- [ ] T036 [US1] Run `pnpm ci:check`.
- [ ] T037 [US1] Run quickstart.md "Manual — the merge condition" in Brave on the worktree's
  stack. Save the screenshots under `specs/035-presence/evidence/` and list them in the commit
  message.

**Phase gate**: `pnpm ci:check` and `pnpm --filter @the-stacks/web test`.

---

## Phase 5: Wiki (re-ground)

**Goal**: the grounding wiki describes presence at the branch's head, re-pinned honestly.

- [ ] T038 Review and update `docs/wiki/ws-protocol.md`: the `subscribe.presence` field, the
  `presence` frame, the heartbeat, and presence removed from "deliberately does not provide".
  Re-pin only after verifying each source.
- [ ] T039 [P] Review and update `docs/wiki/websocket-gateway.md`: display name at upgrade,
  join/leave, heartbeat, snapshot send.
- [ ] T040 [P] Review and update `docs/wiki/play-route.md`: the presence strip, the
  `reduceFrame` `default` branch, `TableSource.presence`.
- [ ] T041 [P] Review and update `docs/wiki/session-model.md`: `presence.recorded` in the marker
  row of the kind table, the `presence` projection view.
- [ ] T042 Create `docs/wiki/presence.md`: tracker, `PresenceReader`, the constants and bounds,
  the marker and its writer, the Director's read path, decision-0024, TASK-0136. List its
  sources and pin it.
- [ ] T043 Update `docs/wiki/proposal-gate.md` and `docs/wiki/dm-turn-jobs.md` only if their
  sources changed (`gate.ts`, `worker.ts`); otherwise leave them.
- [ ] T044 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Update the
  state paragraph and the Realtime list in `docs/wiki/INDEX.md`.
- [ ] T045 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs
  freshness . docs/wiki` (prints `OK`) and
  `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (exits 0).

**Phase gate**: both gates in T045 and `pnpm ci:check`.

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Phase 3 needs Phase 1 (the event) and
Phase 2 (the reader). Phase 4 needs Phase 1 (the fold) and Phase 2 (the frame). No phase
overlaps. Within a phase, `[P]` tasks touch separate files.

## Parallel examples

- Phase 1: T005 and T006 after T004.
- Phase 3: T022 and T023 after T017.
- Phase 4: T032 and T033 beside T027–T031.
- Phase 5: T039, T040 and T041 after T038.

## Implementation strategy

The MVP is Phases 1–2: the server knows who is present and tells opted-in clients. Phase 3
satisfies Constitution IV for the Director. Phase 4 is the visible strip and the merge
condition. Phase 5 re-grounds.

## Notes

- No migration. No new runtime dependency.
- Only `apps/server/src/gate/` appends the marker (write boundary).
- `signoff` and `floor` purposes are reserved for TASK-0049 and TASK-0050.
- The multi-process revisit is TASK-0136.
