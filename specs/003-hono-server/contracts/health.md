# Contract — `GET /health`

**Status: FIXED SEAM CONTRACT.** TASK-0011's compose healthcheck is written against this
shape. Per the sweep runbook, changing it is an operator checkpoint, not an implementer
decision — a change invalidates the sibling task already coded against it.

## Request

`GET /health` — no authentication (none exists until TASK-0014), no parameters, no body.

## Response

Always `200 OK` with a JSON body. **The status code is deliberately not the health
signal**: a non-2xx would be indistinguishable from the server being unreachable, and the
whole point is to report a *degraded* process that is nonetheless answering. Consumers
read the body.

```json
{
  "status": "ok" | "degraded",
  "process": { "uptimeSeconds": <number> },
  "database": { "reachable": <boolean> }
}
```

- `status` is `"ok"` only when every dependency below is healthy; otherwise `"degraded"`.
  It is a derived convenience — a consumer may read the facts directly and ignore it.
- `process.uptimeSeconds` — seconds since the process started. Its presence in a response
  is itself the proof of liveness.
- `database.reachable` — whether a bounded liveness query succeeded. A timeout is
  `false`, never an error and never a hang (see research D1).

## Guarantees

1. **Bounded**: responds within 5 seconds in every case, including an unreachable or hung
   database (SC-002).
2. **Honest**: never reports `status: "ok"` while any dependency fact is false.
3. **Recovering**: reports `"ok"` again on a later poll once the database recovers, with
   no restart required (User Story 1, scenario 3).

## Consumer notes for TASK-0011

A compose healthcheck should treat the container as healthy when the request returns and
`status == "ok"`. Because the endpoint always returns `200`, a plain HTTP-status check is
**not sufficient** — it would report a database-down process as healthy. Parse the body.
