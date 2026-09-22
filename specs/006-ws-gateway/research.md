# Phase 0 — Research: WebSocket gateway, append, and cursor replay

The spec carries no `[NEEDS CLARIFICATION]` markers. Architecture A4 settles the model and
the constraints table fixes the transport (`ws`, one Node process). Both seams this feature
consumes — spec 004's `append`/`readFrom` and spec 005's `validateSession` — are merged
contracts. Five decisions remain about how to compose them correctly.

## D1 — The replay/live boundary: buffer live events during replay, then drain

**Decision**: When a client subscribes from a cursor, the connection immediately joins the
session's subscriber set but its outbound delivery is **queued, not sent**. Replay then
reads from the log in bounded batches until it reaches the position that was newest at
subscribe time. The queued live events are then drained, skipping any whose position the
replay already covered, and the connection switches to direct delivery.

**Rationale**: This is the one genuinely hard part of the feature, and the naive orderings
both fail. **Replay first, then subscribe** loses every event appended in the window between
the last replayed row and the subscription — invisible in a quiet test, guaranteed in a busy
session, and the loss is silent: the client's cursor advances past events it never saw.
**Subscribe first, then replay** delivers live events before the older ones they follow,
violating FR-007's ordering and SC-003's no-duplicate requirement at the boundary. Joining
first but holding the outbound queue closes the window while preserving order: nothing can
be appended without either being in the replay or being in the queue, and the position-based
skip makes the overlap harmless rather than duplicated.

SC-003's phrasing — "including events appended during the replay itself" — exists because
this is precisely the case a naive implementation gets wrong and no simple test catches.

**Alternatives considered**:

- **Replay, then subscribe** — rejected: the gap described above. It is the obvious
  implementation and it is wrong.
- **Subscribe, then replay, and let clients sort by position** — rejected: it pushes an
  ordering guarantee the server owns (FR-007) onto every client, and a client cannot know
  whether a low position it receives late is a replay or a gap it should re-request.
- **Lock the session's log during replay** — rejected: it makes one reconnecting client
  block every writer in that session, turning a routine reconnect into a stall.
- **An in-memory ring buffer of recent events to replay from** — rejected: a cache with an
  invalidation problem and no M0 driver. The log is the source of truth and it is indexed on
  exactly the read this performs.

## D2 — Visibility is filtered per recipient at send time, never at read time

**Decision**: Both the replay path and the live path read the session's events unfiltered,
and filtering happens once per recipient immediately before writing to that recipient's
socket. A filtered-out event is skipped silently; nothing is sent in its place.

**Rationale**: Spec 004's contract is explicit that `readFrom` filters nothing, and this is
why — the log cannot filter per viewer because it does not know who is reading. Filtering at
the single send point means there is exactly one place where "may this person see this" is
decided, for live and replayed events alike (FR-011). Two filtering points is how the replay
path and the live path drift, which would be a disclosure bug rather than a display bug.

**The consequence must be stated because it looks like a defect**: a filtered recipient's
received positions have holes — they may see 4, 5, 8. That is correct, and the client's
cursor must track the highest position *delivered to it*, not assume contiguity. The spec's
US4 scenario 4 names this so a client implementer does not "fix" it.

**Alternatives considered**:

- **Filter inside the log read** — rejected: it would require passing a viewer into
  `readFrom`, changing a frozen contract, and it would make the log's behavior depend on who
  is asking, which is exactly what the projection is for.
- **Deliver everything and filter in the client** — rejected outright. An event delivered to
  a browser has been disclosed regardless of what the interface renders. This is the failure
  the `visibility` field exists to prevent.
- **Send a placeholder for filtered events** ("something happened you cannot see") — rejected
  for M0: it leaks the existence and timing of hidden activity, which for a DM's private
  notes is often the thing worth hiding. Revisit if a feature needs it.

## D3 — The client message envelope is validated by schema; the payload is not

**Decision**: Every inbound message is parsed and validated against a declared envelope
schema (a `type` discriminator plus the fields that type requires). A message failing
validation is refused with an error frame and **nothing is appended**. The event payload
inside is stored opaquely, exactly as spec 004 stores it.

**Rationale**: FR-003 requires validation before action, and FR-014 requires that no path
exists for a client to write unvalidated. Validating the envelope is what makes the gateway
safe without making it a rules engine — payload semantics belong to the system module
arriving in M3 (constitution VI), and a gateway that interpreted payloads now would bake one
game system's assumptions into the transport layer. The envelope is the security boundary;
the payload is data in transit.

**Alternatives considered**:

- **Validate the payload too** — rejected for M3, not forever: there is no system module to
  validate against, so any schema now would be a guess, and every new event type would
  become a gateway change.
- **Accept anything and let the log reject it** — rejected: the log stores payloads opaquely
  by design, so it would reject nothing, and a malformed message would become a permanent
  malformed event in an append-only table.

## D4 — Authentication happens at upgrade, not after connect

**Decision**: The session token is extracted from the upgrade request's cookie header and
validated **before** the WebSocket handshake completes. An invalid session means the upgrade
is refused; the socket never opens. A datastore failure during validation is refused
distinctly (FR-013), since a client should retry that differently.

**Rationale**: A socket that opens and then closes after a rejected first message is a socket
that existed — it consumed a connection slot, it could be held open by a client that simply
never sends, and every message handler must then defend against "not yet authenticated"
state. Refusing at upgrade means every open connection has an identity, which is what lets
the fan-out filter by viewer without a null check on every send.

Spec 005's contract was written for exactly this call site: `validateSession` takes a token
string and no `Request`, because the upgrade handler has no Hono context.

**Alternatives considered**:

- **Authenticate with a first message after connect** — rejected for the reasons above. It is
  common in tutorials because it is easier to write, and it moves an authorization check into
  every subsequent handler.
- **A token in the WebSocket URL's query string** — rejected: URLs are logged by proxies and
  servers, and a session token in a log is a credential leak. The cookie is already
  `HttpOnly` and is sent on the upgrade request.

## D5 — One dead socket must not fail a broadcast

**Decision**: Fan-out iterates subscribers and sends to each independently, catching and
discarding per-socket failures and removing sockets that are no longer open. A send failure
to one recipient never propagates to the others or to the append that preceded it.

**Rationale**: FR-012 and SC-007 require this, and it is easy to get wrong: an `await
Promise.all(...)` over sends rejects on the first failure, so a single client that closed its
laptop mid-broadcast silently deprives everyone else of that event. The append has already
committed by then, so the log and the clients diverge — subscribers would have to reconnect
to discover an event they should have received live.

**Alternatives considered**:

- **`Promise.all` over sends** — rejected for the reason above. Named explicitly because it
  is the natural thing to write.
- **Remove a failing subscriber immediately and retry the send** — rejected as scope: a
  disconnected client's recovery path is reconnect-with-cursor, which already delivers
  exactly what it missed. Retrying into a dead socket buys nothing the cursor does not.
