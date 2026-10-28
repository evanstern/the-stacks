# Implementation Plan: Talk CONFLICT retry

**Branch**: `task-0157-talk-conflict-retry` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/052-talk-conflict-retry/spec.md`. Q1–Q6 resolved at
their recommended defaults by the operator on 2026-10-27 (card commit 8a3105a).

## Summary

Concurrent gate writes to one session race on the `expectedLastSeq` guard and lose three
times in a row, so players see `CONFLICT` and lose their line. The gate gets a per-session
in-process queue: one session's writes (`handle`, `submit`, `recordPresence`) run one at a time
in arrival order, and different sessions run in parallel. The guard and the 3-attempt retry
stay for writers outside the process, now with a 10–50 ms jittered wait between attempts. The
ws-integration resend workaround goes away, a burst test proves zero `CONFLICT`, the play client
gets a plain label for `CONFLICT`, and the frozen gate contract gains the policy amendment.
Design detail: [research.md](./research.md). Amendment text: [contracts/gate-api-amendment.md](./contracts/gate-api-amendment.md).

## Technical Context

**Language/Version**: TypeScript on Node 22 (`engines.node`), as the rest of the repo.

**Primary Dependencies**: none new. `node:crypto` `randomInt` (already imported in `gate.ts`).

**Storage**: Postgres event log, unchanged. No migration.

**Testing**: Vitest. DB suites run with `REQUIRE_DATABASE=1` against the worktree test database.

**Target Platform**: the one Node server process (`apps/server/src/index.ts`) and the web client.

**Project Type**: web service plus SSR web app (pnpm monorepo).

**Performance Goals**: SC-003 — the `concurrency-smoke` WebSocket round-trip p95 stays within
its existing threshold. The reproduction showed comparable wall time with ordering.

**Constraints**: no wire change (FR-010); no new writer under the write boundary; frozen 029
contract changes only by the ruled amendment text.

**Scale/Scope**: a table of 3–6 humans plus the AI DM per session.

## Constitution Check

*Constitution 2.0.0. Checked before research and re-checked after design: no change.*

- [x] **I. Agent-operable** — the AI DM (`gate.submit`), the playtest seat and humans
      (`gate.handle` over WebSocket) all get the same order and retry policy. No human-only
      path is added (CR-001).
- [x] **II. Content contract** — not applicable: no codex entity.
- [x] **III. Data planes** — the queue is transient process state with no game meaning; it
      belongs to no plane and holds nothing a projection needs. Session state stays in the
      session log.
- [x] **IV. Event sourcing** — every write still passes the gate and appends only planned rows;
      a refused or conflicted request appends nothing; no event type or payload changes (CR-002).
- [x] **V. Citations** — not applicable: no library claim.
- [x] **VI. 5e engine boundary** — not applicable: no mechanics touched.
- [x] **VII. Structured first** — not applicable: no generated artifact.
- [x] **VIII. Operator-owned content** — ships no rulebook content.
- [x] **IX. Self-hostable** — no new container, service or dependency.

**Stack conformance** — within the Architecture Constraints table. One Node process is exactly
the assumption the queue relies on; the retained guard covers a future second process.

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/052-talk-conflict-retry/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/gate-api-amendment.md
├── checklists/requirements.md
└── tasks.md
```

### Files touched

| File | Phase | Change |
|---|---|---|
| `apps/server/test/gate.integration.test.ts` | 1, 2 | New describe "gate — per-session ordering"; retry-wait assertions in "gate — sequence conflicts". |
| `apps/server/src/gate/gate.ts` | 2 | Per-session queue around `run` and `recordPresence`; `GateDeps.retryDelayMs`; jittered wait between attempts. |
| `apps/server/test/ws.integration.test.ts` | 3 | `sendTalkAndAwait` loses its resend branch and the `conflictRefusals` counter; new all-in-flight burst test. |
| `apps/web/app/play/labels.ts` | 3 | `CONFLICT` label; `refusalLabel` doc comment. |
| `apps/web/test/play/reduce-frame.test.mjs` | 3 | A `CONFLICT` error frame yields the label. |
| `specs/029-proposal-gate/contracts/gate-api.md` | 4 | Step 7 edit and the TASK-0157 amendment block, verbatim from contracts/gate-api-amendment.md. |
| `docs/wiki/proposal-gate.md`, `docs/wiki/websocket-gateway.md`, `docs/wiki/play-route.md`, `docs/wiki/presence.md`, `docs/wiki/test-suite.md`, `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | 5 | Re-ground. |
| `docs/design/m3-table-sweep-runbook.md` | 5 | TASK-0143 row filled (PR #76, `b983945`); TASK-0157 row added. |

**Migrations**: none. **New runtime dependencies**: none.

**Not touched**: `apps/server/src/events/log.ts`, `apps/server/src/ws/gateway.ts`,
`apps/server/src/dm/nodes/resolve.ts`, `apps/server/src/bench/load/*`,
`specs/029-proposal-gate/contracts/ws-delivery.md`, `docs/wiki/ws-protocol.md` frame shapes.

## Phase plan (see tasks.md)

1. Failing gate-level zero-`CONFLICT` tests (AC #1).
2. Per-session queue and jittered retry, with a mutation check (AC #1).
3. WebSocket burst test, resend workaround removed, bench run, client label (AC #1).
4. Gate contract amendment (AC #2).
5. Wiki re-ground and runbook rows (AC #1, AC #2).

## Risks

- **Deadlock by re-entry.** A queued write that awaits another write for the same session
  never finishes. Mitigation: listeners are synchronous; the contract states the rule; Phase 2
  greps the `onAppended` listeners and the DM worker for any awaited same-session gate call.
- **WS flakiness.** The gateway tests are known-flaky. A failure in a test this feature did not
  touch is re-run once and reported, not fixed.
- **Hidden latency.** A long fold now delays the next write in the session instead of racing
  it. The bench p95 (scenario 4 in quickstart.md) is the check.

## Complexity Tracking

None.
