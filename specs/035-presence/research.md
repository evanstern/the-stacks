# Research: Presence

Every decision below is bound by decision-0024 (D16). Entries record the implementation choices
the decision leaves open.

## R1 — Carriage

- **Decision**: option D — the opt-in `presence` frame for the UI, plus the `presence.recorded`
  marker at decision reads.
- **Rationale**: operator ruling at C2 (2026-10-26), citing Constitution IV.
- **Alternatives**: A, B, C, E and deduplicated markers; see decision-0024.

## R2 — Heartbeat mechanism

- **Decision**: WebSocket protocol-level ping from the server every `HEARTBEAT_INTERVAL_MS`
  (10 s). A connection whose `alive` flag is still false at the next tick is `terminate()`d;
  a `pong` sets `alive = true`.
- **Rationale**: browsers answer protocol pings without page code, so no client change and no
  new frame. `ws` exposes `ping()` and the `pong` event already.
- **Alternatives**: an application-level `ping` frame (needs a frame change and client code);
  TCP keepalive (minutes, not seconds, and not tunable per socket portably).

## R3 — Grace period

- **Decision**: the tracker starts a `PRESENCE_GRACE_MS` (5 s) timer when a user's last
  connection for a table leaves. A join for that user and table inside the timer cancels it and
  emits nothing.
- **Rationale**: `useSession` reconnects within about a second, so a reload never flickers.

## R4 — Bounds

- Clean leave: close → 5 s grace → snapshot. Bound 10 s.
- Silent loss: up to two heartbeat ticks to detect (≤ 20 s) → `terminate()` → close → 5 s grace.
  ≤ 25 s; bound 30 s.

## R5 — Where the marker is written

- **Decision**: `gate.recordPresence`, called by the DM worker before each `turn` pipeline.
- **Rationale**: the write boundary allows only `apps/server/src/gate/` to append catalogued
  events, and the assemble node is "no model call, no write". The worker already owns
  pre-pipeline work and never calls `gate.submit`; `recordPresence` is a separate gate entry,
  so that worker rule holds.
- **Alternatives**: appending from assemble (breaks the node contract); folding the marker into
  resolve's batch (the Director reads presence before resolve runs, so its context would not be
  a projection of the log at read time).

## R6 — Display names

- **Decision**: the gateway reads `users.display_name` once at upgrade, beside the identity, and
  stores it on the `Connection`.
- **Rationale**: one indexed read per connection; the frame never needs a second lookup.
- **Alternatives**: a lookup per snapshot (repeated reads); carrying names in the marker (names
  are account data, not game state; the log uses user ids everywhere else).

## R7 — Stale-client safety

- **Decision**: the frame is opt-in, and `reduceFrame` gains a `default` branch.
- **Rationale**: today's `reduceFrame` returns `undefined` for an unknown frame type. A stale tab
  never opts in, so it never sees the frame. The marker reaches every client as an ordinary
  `event` frame; a stale bundle's `decodeEvent` reports `unknown-type` and the fold skips it.
