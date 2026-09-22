# Contract — how the stack determines application health

## The trap this contract exists to prevent

`GET /health` — owned by spec 003 (TASK-0013) — **always returns `200`**, by design. It
reports a degraded-but-answering process in its body; a non-2xx would be
indistinguishable from an unreachable server.

Therefore: **a healthcheck that inspects only the HTTP status will report a container as
healthy while its database is unreachable.** That is precisely the failure FR-007 forbids,
and it is the most likely implementation mistake in this task (research D1).

## Required behavior

The application service's healthcheck MUST:

1. Request `GET /health` against the application inside the container.
2. Parse the response body.
3. Report healthy only when the overall status field reads `ok`.
4. Report unhealthy when the body reports `degraded` — including when
   `database.reachable` is false — even though the status code is `200`.

## Response shape it consumes

Restated from `specs/003-hono-server/contracts/health.md`, the authoritative source,
because that spec is on an unmerged sibling branch:

```json
{
  "status": "ok" | "degraded",
  "process": { "uptimeSeconds": <number> },
  "database": { "reachable": <boolean> }
}
```

## Startup behavior

The database is routinely slower to accept connections than the application is to start.
The healthcheck must allow a start-up grace period during which failures do not count
against the container, and the application service must wait on the database service
reaching its own healthy state (research D2). Both halves are required: service ordering
alone does not distinguish "started" from "accepting connections".

**Convergence is the requirement** (FR-008): the stack reaches healthy without operator
intervention. A container that restarts faster than the database becomes ready does not
satisfy this, even if it eventually succeeds.

## Changing this contract

Fixed by the sweep runbook before either task dispatched. A change invalidates the sibling
task already coded against it, so it is an operator checkpoint — not an implementer
decision on either side.
