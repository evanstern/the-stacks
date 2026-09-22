# Contract — `validateSession`

**Status: FIXED SEAM CONTRACT.** TASK-0015's WebSocket gateway is written against this
shape before TASK-0014 finishes implementing it. Per the sweep runbook, changing it is an
**operator checkpoint, not an implementer decision** — a change invalidates the sibling
task already coded against it.

**Owner:** TASK-0014 (spec 005) implements it. **Consumer:** TASK-0015 (spec 006) calls it
from the WebSocket upgrade handler. 0014 merges first; 0015 merges `main` in and wires to
the real function. Until then 0015 codes against this signature.

**Why this file exists.** Lane 2 of this sweep shipped an `APP_PORT` defect because a seam
lived in prose instead of a contract file. This seam is larger: it is the only place the
system decides who someone is.

## Signature

```
validateSession(token: string): Promise<{ userId: string; role: Role } | null>
```

`Role` is `"operator" | "player"` — the two roles FR-002 requires and the constitution's
auth row names ("Operator plus invited players").

**How it is obtained (clarified 2026-09-22, no behavioral change).** The signature above is
what a **caller holds and invokes**. It is produced by a factory that captures the database
client at wiring time:

```ts
const validateSession = createValidateSession(db);   // once, in app wiring
const identity = await validateSession(token);       // per call — the signature above
```

This was raised by the implementer as a possible contract departure and is resolved here as
**conforming, not a change**: the value passed to and called by both the HTTP middleware and
the WebSocket upgrade handler has exactly the fixed shape — one string in, identity or
`null` out, no `Request`, no socket, no cookie header. Threading `db` per call would have
been the alternative (it is what `events/log.ts` does for `append`/`readFrom`), but that
would put a second parameter in the seam TASK-0015 consumes, which the contract forbids.
Capturing it in a closure keeps the seam's shape and avoids a singleton.

**TASK-0015 imports `createValidateSession`, calls it once during setup, and passes the
returned function around** — or, more simply, receives the already-wired function from the
app's composition. It must never call the factory per request.

## Semantics

- **Returns the identity** when the token names a live, unexpired session.
- **Returns `null`** when the token is unknown, malformed, expired, or belongs to a
  signed-out session. **One `null` covers every failure** (FR-004, FR-006): a caller must
  not be able to distinguish "no such token" from "expired token", because that
  distinction is an oracle for probing which tokens are real.
- **Throws only when validation could not be performed** — the datastore is unreachable
  (FR-009). This is emphatically *not* `null`. A caller handles it differently: refuse the
  connection with a server-error, never treat it as "not signed in". Collapsing the two
  would sign every user out during a database blip.
- **Has no observable side effects.** In particular it **does not extend the session's
  lifetime** (FR-008, SC-007). A sliding expiry, if implemented, is an explicit separate
  call. A validation that silently refreshed would mean a WebSocket connection polling for
  events keeps a session alive forever — exactly the case US2 scenario 4 names.

## Why one function serves both transports

FR-007 requires exactly one validation operation. Two code paths validating the same token
is how they drift: the HTTP path gets an expiry fix the WS path does not, and a signed-out
user keeps receiving events. One function, two callers:

- **HTTP middleware** reads the token from the session cookie.
- **WS upgrade handler** reads it from the upgrade request's cookie header.

Extracting the token from its transport is the **caller's** job; validating it is this
function's. The function never sees a `Request`, a socket, or a cookie header — only the
token string — which is also what makes it testable without either transport.

## What TASK-0015 needs from it, specifically

0015's AC#5 filters events by `visibility` per viewer. That filtering needs:

- a **stable identity per connection** — `userId`, for whisper-style per-person visibility;
- an **authorization level** — `role`, for DM-visible events.

Both fields are therefore load-bearing for the sibling task, not conveniences. That is why
they are fixed here rather than left to the implementer's discretion.

`userId` is also what 0015 writes as the event log's `actor` (spec 004 left `actor` an
opaque identifier with no foreign key precisely so this feature could supply its meaning).

## Not in this contract

- **Sign-in, sign-out, session creation, provisioning, and invitations.** They are
  TASK-0014's HTTP surface and have no second consumer, so they need no cross-task
  contract.
- **Cookie flags, hash algorithm, session lifetime, and the token's own format.** All
  TASK-0014's to choose (FR-001, FR-006, FR-010). **0015 treats the token as opaque and
  MUST NOT parse it** — if 0015 can read structure out of the token, the two tasks are
  coupled to a format that was supposed to be free to change.
- **Authorization decisions.** This returns *who the caller is*, never *what they may do*.
  A caller that needs "may this person do X" composes it from the returned role.
