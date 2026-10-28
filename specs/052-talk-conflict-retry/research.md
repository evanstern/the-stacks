# Research: Talk CONFLICT retry (TASK-0157)

All decisions below follow the operator's ruling of 2026-10-27 (spec.md, "Open questions").
No NEEDS CLARIFICATION remains.

## R1 — Remove in-process conflicts by ordering each session's gate work

- **Decision**: `createGate` keeps a private `Map<sessionId, Promise<void>>` of queue tails.
  Every gate write (`handle`, `submit`, `recordPresence`) chains its whole retry loop onto its
  session's tail. A session's requests run one at a time, in arrival order. Different sessions
  run in parallel.
- **Rationale**: every conflict observed is between two requests in one process, because one
  gate instance serves the WebSocket gateway and the DM worker (`apps/server/src/index.ts:62`).
  The measured reproduction (spec.md, "Background and root cause") dropped from 27–73%
  `CONFLICT` to 0% with this ordering, at comparable wall time. Appends are already serialised
  by the log's per-session advisory lock, so ordering adds no real throughput cost; it removes
  the wasted projection folds of lost attempts.
- **Alternatives considered**: wider retry with backoff (rate falls, never reaches zero);
  client resend (needs a request id on the wire, fixes only the web client); `talk` skips the
  guard (fixes one kind, weakens the character-control check). See spec.md Q1.

## R2 — Queue mechanics

- **Decision**:
  - Parse the request (`ProposalSchema` / `GateRequestSchema`) before it joins the queue. A
    malformed request is refused at once and never waits.
  - The queued unit is the whole `run` (all attempts, the waits between them, and the
    `onAppended` calls) or the whole `recordPresence` loop.
  - The tail is chained with both handlers (`prev.then(fn, fn)`), and the stored tail swallows
    the result (`next.then(noop, noop)`), so a refusal or a thrown error never blocks the next
    request. The caller still receives its own rejection.
  - When a request finishes and its tail is still the session's current tail, the map entry is
    deleted. An idle session holds no entry.
- **Rationale**: FR-003 and FR-004; no memory growth with the number of sessions ever served.
  Calling `onAppended` inside the queued unit means listeners see sessions' rows in `seq`
  order, which is what `gateway.publish` already assumes.
- **Hazard**: code running inside the queued unit must never `await` another gate write for
  the same session, or that session deadlocks. Today nothing does: `onAppended` listeners are
  synchronous (`(sessionId, events) => void`) and the DM worker's re-queue only enqueues a job.
  The contract amendment states this rule.

## R3 — Residual retry policy

- **Decision**: `MAX_ATTEMPTS` stays 3. After a `SeqConflictError` on attempt 1 or 2, the gate
  waits a random 10–50 ms (`10 + randomInt(0, 41)`), then retries. No wait follows attempt 3.
  The wait comes from a new optional dep, `retryDelayMs?: (attempt: number) => number`, so tests
  inject `() => 0` or record calls. The wait happens inside the queued unit: the conflict is
  with an outside writer, and holding the queue keeps this session's order.
- **Rationale**: spec.md Q3. Two processes retrying in lockstep is the only remaining way to
  lose three times; jitter breaks lockstep.

## R4 — What stays unchanged

- `appendBatch` and its `expectedLastSeq` guard (`apps/server/src/events/log.ts`).
- The `CONFLICT` refusal code, its `internal` error kind and every frame shape (FR-010).
- The DM resolve node's own `CONFLICT` wrapper (`CONFLICT_DELAYS_MS`, `dm/nodes/resolve.ts`).
- The write boundary (`apps/server/test/write-boundary.test.ts`): no new writer, no new import.

## R5 — Client wording

- **Decision**: add `CONFLICT: "The table was busy, so your line was not sent. Send it again."`
  to `REFUSAL_LABEL` in `apps/web/app/play/labels.ts`. The notice then reads that text plus
  `(CONFLICT)`. The doc comment on `refusalLabel` drops "floor": it now labels more than floor
  codes.
- **Rationale**: spec.md Q4. The composer behaviour is unchanged.

## R6 — Tests that prove it

- Gate level (`apps/server/test/gate.integration.test.ts`, new describe "gate — per-session
  ordering"): concurrent `gate.handle` talk bursts with zero socket latency. These fail on
  today's code; the reproduction measured 4–41 refusals for the same shapes.
- WebSocket level (`apps/server/test/ws.integration.test.ts`): `sendTalkAndAwait` loses its
  resend branch and fails on any `CONFLICT`. A new test sends 3 senders × 5 lines with every
  line in flight at once.
- Bench (`concurrency-smoke`): unchanged code; it already counts a refusal as `ws_refused`.
