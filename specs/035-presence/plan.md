# Implementation Plan: Presence — who is at the table

**Branch**: `task-0051-presence` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/035-presence/spec.md`; carriage ruled in
decision-0024 (D16, option D) at checkpoint C2.

## Summary

The server tracks which humans are connected to each table, in memory, behind one
`PresenceReader`. Clients that opt in on `subscribe` receive a full-snapshot `presence` frame
after replay and on every change; the play route renders a presence strip from it. A
protocol-level heartbeat closes silently lost sockets. When a decision reads presence, the gate
appends a public `presence.recorded` marker; the DM worker records one per `turn` job, and the
assemble node reads the Director's present set from the folded marker, so agent context stays a
projection of the log (Constitution IV). The web client's `reduceFrame` gains a `default`
branch so future additive frames cannot break a stale tab.

## Technical Context

**Language/Version**: TypeScript 5 (Node 24 server, React Router 8 SSR client)

**Primary Dependencies**: `ws` (installed; its `ping()`/`pong` covers the heartbeat), Zod,
Drizzle, Hono. **No new runtime dependency.**

**Storage**: Postgres event log (one new catalogued event type; no table change). Live presence
is in memory. **No migration.**

**Testing**: Vitest (server and `packages/session-model`), node test runner `.mjs`/`.tsx` tests
in `apps/web/test`, DB suites with `REQUIRE_DATABASE=1` on the worktree's own stack, Brave
screenshots for the merge condition.

**Target Platform**: the one Node process from `docker compose up`; browsers.

**Project Type**: web service + web app (monorepo).

**Performance Goals**: join visible to other viewers within 2 s; clean leave within 10 s;
silent loss within 30 s.

**Constraints**: frozen ws-protocol contract amended only as decision-0024 states; write
boundary (only `apps/server/src/gate/` appends catalogued events); no modals; one process.

**Scale/Scope**: single-digit humans per table; one marker row per DM turn.

## Constitution Check

*Gate against `.specify/memory/constitution.md` 2.0.0. Re-checked after Phase 1 design: unchanged.*

- [x] **I. Agent-operable** — an agent reads presence through the same `subscribe.presence`
      opt-in a browser uses. The playtest harness injects a `PresenceReader` naming its
      scripted seat, so harness turns record a real marker (CR-001).
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — live presence is session-plane connection state in server memory;
      the marker is a session-plane event. No cross-plane access.
- [x] **IV. Event sourcing** — the marker is a typed, versioned (`presence.recorded` v1),
      catalogued event appended only by the gate, visibility `public`. The Director reads
      presence only from the projection of that marker, so agent context is a projection of the
      log. Client game state stays a projection of the log; the live strip shows connection
      state, which decision-0024 rules is not game state. Roles beside it derive from the log.
- [x] **V. Citations** — N/A: no library-derived claim.
- [x] **VI. 5e engine boundary** — presence never reaches mechanics (CR-004).
- [x] **VII. Structured first** — frame and marker are Zod-validated data before render.
- [x] **VIII. Operator-owned content** — N/A: ships no rulebook content.
- [x] **IX. Self-hostable** — no new container, no new dependency, no external service.

**Stack conformance**: stays inside TypeScript, one Node process, Hono, React Router 8 SSR,
Postgres, Drizzle, Zod. The in-memory tracker relies on the one-process constraint; TASK-0136
revisits it when a second process is planned.

## Project Structure

### Documentation (this feature)

```text
specs/035-presence/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R7
├── data-model.md         # presence entry, tracker state, marker, projection view
├── quickstart.md         # validation run, incl. the Brave merge condition
├── contracts/
│   ├── ws-presence.md        # the ws-protocol amendment (subscribe.presence, presence frame)
│   ├── presence-reader.md    # PresenceReader / tracker API, timings
│   └── presence-marker.md    # presence.recorded v1, gate.recordPresence, worker call
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks output
```

### Source Code — every file this plan touches

**Phase 1 — session model (`packages/session-model`)**

- `src/events/presence.ts` (new) — `PresenceRecordedV1` schema, `PRESENCE_PURPOSES`.
- `src/catalog.ts` — `presence.recorded` v1 entry, kind `marker`; `SessionPayloads` entry.
- `src/projections/types.ts` — `PresenceView`; `SessionProjections.presence`.
- `src/projections/apply.ts` — empty `presence: null`; fold the latest marker.
- `src/index.ts` — export the schema, purposes and view type.
- `src/fixtures/index.ts` — a `presenceMarker` fixture stream (`fixtureIds` updated).
- `test/presence.test.ts` (new); `test/catalog.test.ts`, `test/fixtures.test.ts`,
  `test/exports.test.ts` updated.

**Phase 2 — live presence and the protocol amendment (`apps/server/src/ws`, new `presence/`)**

- `apps/server/src/presence/tracker.ts` (new) — `createPresence({ graceMs, setTimer? })`:
  `join`, `leave`, and the `PresenceReader` (`presentUsers`, `isPresent`, `onChange`).
- `apps/server/src/presence/constants.ts` (new) — `PRESENCE_GRACE_MS = 5000`,
  `HEARTBEAT_INTERVAL_MS = 10000`, `CLEAN_LEAVE_BOUND_MS = 10000`,
  `SILENT_LOSS_BOUND_MS = 30000`.
- `apps/server/src/presence/index.ts` (new) — public exports.
- `apps/server/src/ws/protocol.ts` — `SubscribeFrame.presence` optional boolean;
  `PresenceFrame` in `OutboundFrame`.
- `apps/server/src/ws/registry.ts` — `Connection` gains `connId`, `displayName`,
  `wantsPresence`, `alive`; `sendPresence(sessionId, frame)` to opted-in, caught-up
  subscribers.
- `apps/server/src/ws/subscribe.ts` — after `replay-complete`, send the opted-in connection its
  snapshot.
- `apps/server/src/ws/gateway.ts` — `presence` dep; display name read at upgrade
  (`users.display_name`); join on subscribe, leave on re-subscribe and close; heartbeat
  interval with `terminate()` on a missed pong; `onChange` → `sendPresence`; `close()` clears
  the interval.
- `apps/server/src/index.ts` — `createPresence` before the gate; pass to the gateway.
- `specs/006-ws-gateway/contracts/ws-protocol.md` — the amendment, citing decision-0024.
- Tests (new): `apps/server/test/presence.tracker.test.ts`,
  `apps/server/test/ws.presence.integration.test.ts`; `ws.protocol.test.ts` updated.

**Phase 3 — the marker writer and the Director (`apps/server/src/gate`, `dm`, `playtest`)**

- `apps/server/src/gate/gate.ts` — `GateDeps.presence?: PresenceReader` (default: no humans);
  `Gate.recordPresence(sessionId, { purpose, actionId? })`.
- `apps/server/src/gate/index.ts` — export the new types.
- `apps/server/src/dm/worker.ts` — `gate: Pick<Gate, "submit" | "recordPresence">`; record
  before each `turn` pipeline; `presenceSeq` in every turn `jobs.result`.
- `apps/server/src/dm/nodes/assemble.ts` — `AssembleOutput.presence`
  (`{ present, absent, seq } | null`) from `projections.presence` and the party.
- `apps/server/src/dm/pipeline/context.ts` — only if the turn context type needs the field.
- `apps/server/src/dm/enqueue.ts` — no code change expected; a test pins that a marker
  enqueues nothing.
- `apps/server/src/playtest/harness.ts` — inject a static reader naming the scripted seat.
- `apps/server/src/index.ts` — pass `presence` to `createGate`.
- Tests: `apps/server/test/gate.presence.integration.test.ts` (new);
  `apps/server/test/dm/worker-world.ts`, `apps/server/test/dm/world.ts` fakes gain
  `recordPresence`; `apps/server/test/dm/assemble.test.ts`,
  `apps/server/test/dm/worker.integration.test.ts` extended;
  `apps/server/test/write-boundary.test.ts` must stay green unchanged.

**Phase 4 — the presence strip (`apps/web`)**

- `apps/web/app/ws/types.ts` — `subscribe.presence`, `PresenceFrame` in `ServerFrame`.
- `apps/web/app/ws/useSession.ts` — send `presence: true`; expose `present`.
- `apps/web/app/play/reduce-frame.ts` — `present` in `FrameState`; `presence` branch; `default`
  branch returns `state` unchanged.
- `apps/web/app/play/source.ts` — `TableSource.presence: PresenceEntry[] | null`.
- `apps/web/app/play/use-live-table.ts`, `apps/web/app/play/use-fixture-table.ts` — supply it.
- `apps/web/app/play/presence.ts` (new) — pure `presenceRows(present, projections)`: DM /
  player / observer, AI DM always present, absent human DM seat.
- `apps/web/app/play/components/presence-strip.tsx` (new);
  `apps/web/app/play/components/table-header.tsx` renders it.
- Tests: `apps/web/test/play/reduce-frame.test.mjs` extended;
  `apps/web/test/play/presence.test.mjs`, `apps/web/test/play/presence-strip.test.tsx` (new);
  `apps/web/test/no-dialog.test.mjs` stays green.

**Phase 5 — wiki**: `docs/wiki/ws-protocol.md`, `websocket-gateway.md`, `play-route.md`,
`session-model.md` (NEEDS-REVIEW), new `docs/wiki/presence.md`, `CAPSULES.md`, `INDEX.md`.

**Structure Decision**: presence gets its own server module (`apps/server/src/presence/`) so the
gateway feeds it and the gate reads it without either importing the other's internals. The
marker lives in the session-model catalog like every other event type.

## Migrations and dependencies

- **Migrations**: none. The marker is a new row type in the existing `events` table.
- **New runtime dependencies**: none. `ws` already provides protocol-level ping/pong; Node
  timers cover the grace period.

## Risks

- **Hotspots** (runbook concurrency doctrine): `apps/server/src/ws/` (shared with TASK-0099),
  `packages/session-model` (TASK-0049, TASK-0050), `apps/web/app/play/` (many). Merge
  `origin/main` before each phase dispatch.
- **Flaky WS gateway tests**: a failure in a WS test this task did not change gets one re-run.
- **Timer tests**: tracker and heartbeat accept injected intervals so tests run in
  milliseconds, not seconds.

## Complexity Tracking

No constitution gate fails. No entry.
