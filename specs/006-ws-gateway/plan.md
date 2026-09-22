# Implementation Plan: WebSocket gateway with event-log append and cursor replay

**Branch**: `task-0015-ws-gateway` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ws-gateway/spec.md`

## Summary

A WebSocket gateway in the same Node process as the HTTP API: connections authenticate at
upgrade through spec 005's `validateSession`, client messages are schema-validated and
appended through spec 004's `append` **before** any broadcast, and subscribers receive their
session's events in position order, filtered per viewer, with reconnect replaying from a
cursor.

Technical approach per [research.md](./research.md). The load-bearing decision is **D1, the
replay/live boundary**: a subscriber joins the fan-out set immediately but with its outbound
delivery **queued**, replay then reads the log in bounded batches, and the queue drains with
a position-based skip. Both naive orderings are wrong — replay-then-subscribe silently loses
events appended in the window, subscribe-then-replay delivers them out of order — and SC-003
names this case for exactly that reason.

The other four: visibility filtered **once, at send time** for live and replay alike (D2);
the **envelope** validated, the payload left opaque (D3); authentication at **upgrade**, so
every open socket has an identity (D4); and fan-out that **tolerates one dead socket** rather
than failing the broadcast (D5).

## Technical Context

**Language/Version**: TypeScript 5.x on Node 22

**Primary Dependencies**: **`ws`** — the one addition, and it is the constraints table's own
Server row ("Node 22, Hono, `ws`"), not a departure. Zod and Hono are present. Both consumed
seams are already merged.

**Storage**: No new tables, no migration (see [data-model.md](./data-model.md)). Events and
identity already exist.

**Testing**: Vitest, integration against a real Postgres via `TEST_DATABASE_URL`, plus real
WebSocket clients against a real listening server — the fan-out and boundary behavior are not
observable through a mocked socket.

**Target Platform**: Linux server container, self-hosted

**Project Type**: Web service — one Node process (A2)

**Performance Goals**: Fan-out is a map lookup plus one send per subscriber. Replay is
`readFrom` in bounded batches, which is an indexed range scan on `(session_id, seq)`. No
throughput target for M0; the bar is correctness at the boundary.

**Constraints**: Nothing delivered that is not appended (FR-004). One order for every
subscriber (FR-007). No gap or duplicate across reconnect, including during replay (SC-003).
A filtered event is never sent, not hidden client-side (FR-011).

**Scale/Scope**: One process, subscribers in memory. The gateway, its protocol handlers, the
subscriber registry, and tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — the protocol ([contracts/ws-protocol.md](./contracts/ws-protocol.md))
      is JSON frames over a standard WebSocket. An agent connects, subscribes, sends, and
      replays through exactly what a browser uses. A4's "the AI DM is just another actor" is
      literal here: the auto-DM will use this gateway unchanged (CR-001).
- [x] **II. Content contract** — no codex entity. Not applicable.
- [x] **III. Data planes** — session plane only. No library or codex access (CR-002).
- [x] **IV. Event sourcing, server authority** — the core of this feature. Every mutation
      passes through the server, which validates before appending; clients hold projections
      and never write; `visibility` is filtered per viewer at projection time; unknown event
      types are delivered, not dropped (CR-003). `actor`, `seq`, and `ts` are the server's.
- [x] **V. Citations** — no library-derived claim. Not applicable.
- [x] **VI. System-agnostic** — the gateway validates the envelope and never interprets a
      payload (research D3). No 5e concept appears; a Fate session uses it unchanged.
- [x] **VII. Structured first** — no generated artifact or asset. Not applicable.
- [x] **VIII. Operator-owned content** — ships no rulebook content. Test fixtures are
      synthetic.
- [x] **IX. Self-hostable** — runs in the process `docker compose up` already starts. **No
      broker, no queue, no realtime service.** `ws` is a library in the existing process
      (CR-006).

**Stack conformance** — TypeScript, one Node process, Hono, `ws`, Postgres, Drizzle, Zod.
`ws` is the constraints table's Server row; nothing outside it is added.

**Post-Phase-1 re-check**: re-evaluated after data-model, contracts, and quickstart. No gate
changed. Two design facts are worth naming against principle IV: this feature **adds no
durable state at all**, so there is no second source of truth to drift from the log; and
authentication at upgrade means every open socket carries an identity, which is what lets
per-viewer filtering (IV's hidden-information clause) have no null case to get wrong.

## Project Structure

### Documentation (this feature)

```text
specs/006-ws-gateway/
├── plan.md                    # This file
├── spec.md                    # Feature specification
├── research.md                # D1 replay boundary, D2 filtering point, D3 envelope-only validation, D4 upgrade auth, D5 fan-out isolation
├── data-model.md              # In-memory only — no tables, no migration
├── quickstart.md              # Runnable validation, including the boundary check
├── contracts/
│   └── ws-protocol.md         # The frame shapes TASK-0016 codes against
├── checklists/requirements.md
└── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/server/
├── src/
│   ├── ws/
│   │   ├── gateway.ts         # NEW — upgrade handling, connection lifecycle
│   │   ├── protocol.ts        # NEW — Zod schemas for the frames (research D3)
│   │   ├── registry.ts        # NEW — sessionId -> subscribers, fan-out (research D5)
│   │   └── subscribe.ts       # NEW — the replay/live boundary (research D1)
│   ├── auth/session.ts        # EXISTING — validateSession consumed, NOT modified
│   ├── events/log.ts          # EXISTING — append/readFrom consumed, NOT modified
│   └── index.ts               # EXISTING — attaches the ws server to the http server
└── test/
    ├── ws.protocol.test.ts    # NEW — frame validation, no socket
    └── ws.integration.test.ts # NEW — real sockets: fan-out, replay, boundary, auth refusal
```

**Structure Decision**: The gateway lives in `apps/server/src/ws/` beside the existing
`auth/` and `events/`, matching the established shape. The replay/live boundary gets its own
module (`subscribe.ts`) rather than living inside the connection handler, because it is the
feature's one subtle algorithm and it must be readable and testable on its own — burying it
in a socket callback is how it becomes untestable and then quietly wrong. Nothing is added to
`packages/shared` yet: TASK-0016 will want the frame types, and moving them there when the
second consumer exists is cheaper than guessing the shape now.

## Complexity Tracking

> No Constitution Check violations. This section is empty by design.

All nine gates pass. The feature adds one dependency (`ws`, named in the constraints table)
and **zero tables** — the gateway is stateless across restarts by construction, which is what
makes in-memory subscribers acceptable.
