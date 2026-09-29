---
name: error-contract
description: The {error:{kind,message,issues?}} JSON shape every route returns, the seven typed error classes that produce it, STATUS_BY_KIND, and the fixed internal-error message that never leaks cause details. Load for error-handling or "what does a failed request look like" questions.
kind: pattern
sources:
  - apps/server/src/errors.ts
verified_against: c732622ca88b9055779079909e330d034bb329d6
---

# Error contract

Every error response from the server has the same JSON shape:
`{ error: { kind: ErrorKind, message: string, issues?: ErrorIssue[] } }`. `ErrorKind` is a
closed union — `"validation" | "internal" | "not_found" | "unauthorized" | "forbidden" |
"conflict" | "too_large"` — and `ErrorIssue` is `{ path: string, message: string }`, used only
by validation errors. This is a fixed seam contract (per the file's own comment, pointing at
`specs/003-hono-server/contracts/errors.md`).

## How it works

Seven error classes, one per kind, all extending `Error` with a fixed `name` and a default
`message`: `ValidationError` (carries `issues: ErrorIssue[]`), `NotFoundError`,
`UnauthorizedError`, `ForbiddenError`, `ConflictError`, and, added by TASK-0024
(specs/017-ingestion-pipeline), `PayloadTooLargeError` — thrown when an upload's declared
(`Content-Length`) or streamed size exceeds `UPLOAD_MAX_BYTES` (see [[ingestion]] and
[[configuration]]). Route handlers throw these directly; there is no eighth `InternalError`
class — `internal` is the fallback for anything else Hono catches.

`STATUS_BY_KIND` maps each kind to its HTTP status as a `const` object: `validation: 400`,
`not_found: 404`, `unauthorized: 401`, `forbidden: 403`, `conflict: 409`, `too_large: 413`,
`internal: 500`.

`errorHandler` (registered as `app.onError` in [[server-entrypoint-and-app]]) is an
`instanceof` chain over the five thrown classes, each returning `c.json(errorBody(kind,
err.message, issues), STATUS_BY_KIND[kind])`. Anything that isn't one of the five falls
through to `console.error(err)` followed by a response using a **fixed, generic message**:
`INTERNAL_ERROR_MESSAGE = "An internal error occurred."` — the actual thrown error's message
is logged server-side but never sent to the client, so no internal detail (stack traces,
driver errors, file paths) leaks through a 500. `notFoundHandler` (registered as
`app.notFound`) independently returns the same `not_found` shape for requests that hit no
route at all.

`UnauthorizedError`'s default message and its doc comment specifically call out that sign-in
uses this error for both an unknown username and a correct-username-wrong-password case,
deliberately with the same message — distinguishing them would let an attacker enumerate
valid usernames. `ForbiddenError` is kept distinct from `UnauthorizedError`: "who are you"
(401) versus "you can't do that" (403), used for example when an authenticated non-operator
calls an operator-only route.

## Connections

Registered in [[server-entrypoint-and-app]] (`app.onError`/`app.notFound`). Thrown by
[[session-auth]]'s auth routes and [[ingestion]]'s upload route, and consumed by anything
reading route responses, including [[client-session-hook]] on the client side.

## Operational notes

Any uncaught exception in a route handler — not just an intentional throw — is caught by
`errorHandler` and surfaces as a generic 500 with `INTERNAL_ERROR_MESSAGE`; the real cause is
only visible in server logs (`console.error`). There is no environment-based toggle to
expose more detail in development.
