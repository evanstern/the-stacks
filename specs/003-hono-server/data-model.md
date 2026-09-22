# Phase 1 — Data model

**This feature persists nothing.** It introduces no table, no migration, and no state in
any of the three planes (constitution III). Schema and the event log are TASK-0012.

The entities below are *response shapes* — data crossing the API boundary, not data at
rest. They are recorded here because they are the contracts later features consume.

## Health report

Reported by `GET /health`. See [contracts/health.md](contracts/health.md).

| Field | Type | Meaning |
|---|---|---|
| `status` | `"ok" \| "degraded"` | Derived: `"ok"` only when every dependency fact is healthy |
| `process.uptimeSeconds` | number | Seconds since process start; its presence proves liveness |
| `database.reachable` | boolean | Bounded liveness query succeeded. A timeout is `false` |

**Validation rule**: `status` is never `"ok"` while any dependency fact is false. It is a
convenience over the facts, never a substitute for them.

## Structured error

Every client-visible failure. See [contracts/errors.md](contracts/errors.md).

| Field | Type | Meaning |
|---|---|---|
| `error.kind` | `"validation" \| "internal" \| "not_found"` | The discriminator FR-007 requires |
| `error.message` | string | Human-readable and safe to display |
| `error.issues[]` | `{path, message}[]` | Present only for `kind: "validation"` |

**Validation rule**: `kind: "internal"` carries a fixed generic message and no `issues` —
it must not vary with the underlying exception, because variation is itself a disclosure.

## Echo request / response

The typed route's payload. See [contracts/echo-route.md](contracts/echo-route.md). Modeled
deliberately thin (research D5); it represents no domain concept.

| Field | Type | Rule |
|---|---|---|
| request `message` | string | 1–500 characters |
| response `message` | string | Echoed from the request |
| response `receivedAt` | ISO-8601 string | Server-generated |

## Where these schemas live

`packages/shared` (research D4), so TASK-0016's client imports the same object rather
than keeping a copy that drifts — constitution II's single-source rule in practice.
