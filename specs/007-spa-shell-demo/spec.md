# Feature Specification: React SPA shell and the two-browser echo demo

**Feature Branch**: `007-spa-shell-demo`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "React SPA shell and the two-browser echo demo"

**Board task**: TASK-0016 · **Milestone**: M0 · **Depends on**: TASK-0014 (session auth,
spec 005), TASK-0015 (WebSocket gateway, spec 006) — both merged.

**This feature completes M0.** Its User Story 4 *is* the milestone demo from
`docs/design/milestones.md`: "two browsers sign in; a message from one appears in the other
via the event log." Nothing else in the sweep remains.

## Binding inputs

This feature is a **consumer** of two frozen contracts. It does not change them, and it does
not reimplement what they already provide.

| contract | status | what this feature may assume |
|---|---|---|
| `specs/006-ws-gateway/contracts/ws-protocol.md` | **binding on this feature, by its own header** | frame shapes, upgrade auth, ordering guarantees |
| `specs/005-session-auth/contracts/http-auth.md` | documented; changes go through the spec route | endpoint shapes, cookie behaviour |

Changing a WebSocket frame shape is an operator checkpoint, not an implementer decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The SPA is served by the app container (Priority: P1)

A self-hoster runs `docker compose up` from a clean clone, opens the app's port in a browser,
and is served a working single-page application — not a 404, and not a separate dev server
they had to start themselves.

**Why this priority**: Principle IX ("`docker compose up` from a clean clone MUST produce a
working install") makes this the foundation every other story stands on. Today the image
builds only the server and serves no static files at all; until this story lands, there is no
client to sign into. It is also the story most likely to be mis-scoped, because the card's
AC#1 reads like a build step and is in fact a Dockerfile change plus a server change.

**Independent Test**: Build the image and run the stack with no dev server running. Request
`/` and receive the SPA's HTML shell; request a hashed asset path and receive the asset.

**Acceptance Scenarios**:

1. **Given** a clean clone and a configured `.env`, **When** the operator runs
   `docker compose up`, **Then** the app container serves the built SPA at `/`.
2. **Given** the running stack, **When** a browser requests a client-side route directly
   (a deep link, not `/`), **Then** the server returns the SPA shell rather than a 404, so
   the client router can resolve the route.
3. **Given** the running stack, **When** any request targets `/health`, `/api/*`, `/auth/*`,
   or `/ws`, **Then** it reaches its existing handler and is **never** shadowed by the SPA
   fallback.

---

### User Story 2 - A person signs in and stays signed in across reload (Priority: P1)

Someone with an account opens the app, is shown a sign-in view, enters their username and
password, and lands in the application. Reloading the page leaves them signed in.

**Why this priority**: Every later story needs an authenticated identity — the WebSocket
upgrade is refused without one. Persistence across reload is what distinguishes a real
session from a variable in memory.

**Independent Test**: Sign in through the UI, reload, and confirm the signed-in view returns
without re-entering credentials. Then sign out and confirm the reload shows sign-in.

**Acceptance Scenarios**:

1. **Given** a signed-out browser, **When** the SPA loads, **Then** it asks the server who
   the caller is and shows the sign-in view when the answer is "nobody".
2. **Given** valid credentials, **When** the person submits the sign-in form, **Then** they
   are shown the signed-in view with their own display name.
3. **Given** a signed-in browser, **When** the person reloads the page, **Then** they remain
   signed in, **and** the SPA learns this by asking the server — not by reading a stored copy
   of the identity.
4. **Given** wrong credentials, **When** the person submits, **Then** they see a single
   failure message that does not reveal whether the username exists.
5. **Given** a signed-in browser, **When** the person signs out, **Then** the signed-out view
   returns and a reload does not restore the session.

---

### User Story 3 - A signed-in person sees the session's events, live and on reload (Priority: P1)

A signed-in person opens the play view. Events already recorded in that session appear. New
events appear as they happen, without a reload.

**Why this priority**: This is the read half of the demo. It is also where a client most
easily goes subtly wrong — by assuming `seq` is contiguous, or by treating replayed and live
events as different kinds of thing.

**Independent Test**: With events already in the log, open the view and confirm the history
renders; then append another event from a second connection and confirm it appears without
reload.

**Acceptance Scenarios**:

1. **Given** a session with prior events, **When** the person opens the play view, **Then**
   the prior events render in order.
2. **Given** the view is open, **When** a new event is appended to that session, **Then** it
   appears without a reload, after the replayed events and in order.
3. **Given** the view is open, **When** the person reloads, **Then** prior events render
   again from the log rather than an empty view.
4. **Given** a reconnect, **When** the client resubscribes, **Then** it asks to resume from
   **the highest `seq` it was actually delivered**, and it does not assume the sequence it
   received was gap-free.
5. **Given** the connection is refused with `401`, **When** the client handles it, **Then**
   it returns the person to sign-in; **given** `503`, **Then** it retries rather than
   signing them out.

---

### User Story 4 - Two browsers, two people, one message crossing between them (Priority: P1)

Two different people are signed in, in two browsers, looking at the same play session. One
types a message and sends it. It appears in the other person's browser. Both reload and the
message is still there.

**Why this priority**: **This story is the M0 milestone.** A sweep that lands every other
story and not this one has not produced M0. It is also the only story that proves the seams
compose rather than merely exist.

**Independent Test**: Two browser contexts with **separate cookie jars**, signed in as two
different accounts, subscribed to one session id. A message sent in one appears in the other.
This must be verified **by running it**, not inferred from passing tests.

**Acceptance Scenarios**:

1. **Given** two browsers signed in as different users on the same session, **When** one
   sends a message, **Then** it appears in the other's view.
2. **Given** the same setup, **When** one sends a message, **Then** it appears in the
   **sender's** view too — arriving as the recorded event, not echoed locally on submit.
3. **Given** messages have been exchanged, **When** either browser reloads, **Then** the
   prior messages replay from the log.
4. **Given** the whole flow, **When** it is performed from `docker compose up` on a clean
   clone, **Then** it works with no step outside the documented quickstart.

---

### Edge Cases

- **A `send` is never acknowledged.** Confirmation is the resulting `event` frame arriving.
  A client that waits for an ack waits forever; a client that echoes locally on submit will
  double-render when the real event lands.
- **`seq` gaps are correct, not missed events.** A viewer filtered out of an event never
  receives it and never learns it existed. A client that treats a gap as loss re-requests
  forever.
- **The session cookie is `HttpOnly`.** The SPA cannot read it and must not try. Identity
  comes from asking the server.
- **Two tabs in one browser profile share one cookie jar** — and therefore one identity.
  That configuration cannot demonstrate User Story 4 and must not be mistaken for it.
- What does the view show for a session with no events yet — and how does that differ
  visibly from "still loading"?
- What happens when the socket closes mid-session (server restart, network drop)?
- What happens when a message is submitted while the socket is not open?
- What happens when the person is signed out server-side (session expired) while the view is
  open?

## Requirements *(mandatory)*

### Functional Requirements

**Serving and build**

- **FR-001**: The app container MUST serve the built SPA. The image MUST build the client and
  carry its output into the runtime stage.
- **FR-002**: The server MUST serve static assets and MUST return the SPA shell for unmatched
  **non-API** paths, so client-side routes survive a direct load or reload.
- **FR-003**: The SPA fallback MUST NOT shadow `/health`, `/api/*`, `/auth/*`, or `/ws`.
  These keep their existing behaviour, including their existing 404 shape for unknown paths
  beneath them.
- **FR-004**: The runtime image MUST NOT gain client build tooling — the existing
  build/runtime split stands.

**Client application**

- **FR-005**: The client MUST be a React 19 + Vite single-page application, per the
  constitution's Architecture Constraints. Not SSR.
- **FR-006**: The client MUST use TanStack Router for routing and TanStack Query for server
  state.
- **FR-007**: The client MUST determine identity by asking the server on load. It MUST NOT
  persist the identity itself as the source of truth.

**Auth flows**

- **FR-008**: A person MUST be able to sign in, and MUST be returned to the signed-out view
  on sign-out.
- **FR-009**: A failed sign-in MUST surface one message that does not disclose whether the
  account exists.

**Event flows**

- **FR-010**: The client MUST connect to the gateway and subscribe to a session, rendering
  replayed and live events through **one** path — the protocol deliberately gives both the
  same frame shape.
- **FR-011**: The client MUST track the **highest delivered `seq`** and resume from it. It
  MUST NOT assume contiguity.
- **FR-012**: The client MUST send messages as `send` requests carrying only what the
  protocol permits. It MUST NOT send `actor`, `seq`, or `ts` — a client that could set those
  could forge history.
- **FR-013**: The client MUST render a sent message only when its recorded `event` frame
  arrives, not optimistically on submit.
- **FR-014**: The client MUST distinguish a `401` upgrade refusal (sign in again) from a
  `503` (retry). Treating a datastore blip as "signed out" logs people out spuriously.
- **FR-015**: A refused frame (`error`) MUST NOT tear down the connection.

**The demo**

- **FR-016**: The system MUST support two concurrently signed-in people in separate browser
  contexts exchanging a message through the event log, from `docker compose up` on a clean
  clone.
- **FR-017**: The repository MUST document how to run the demo, including how the two
  accounts are created and how both browsers reach the same session id.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The SPA MUST NOT become a human-only path. Every capability
  it exposes — sign in, subscribe, send — MUST remain drivable through the same HTTP and
  WebSocket interfaces the client itself uses, with no capability reachable only by clicking.
  *Interface an agent uses*: `POST /auth/sign-in` and the `/ws` protocol, unchanged.
- **CR-005** (VIII. Operator-owned content): The client MUST NOT bundle or reproduce rulebook
  content. Demo content is operator-typed messages only.
- **CR-006** (IX. Self-hostable): The demo MUST run from `docker compose up` on a clean clone
  with no step outside the documented quickstart, and MUST NOT require a separately started
  dev server.
- **CR-007** (VII. Structured before styled): Rendered events MUST be driven by the recorded
  event data. Styling is minimal and deliberately so — M0 proves seams, not visual design.

*Rows deliberately omitted*: CR on content contracts (II) — this feature creates no entities;
CR on citations (V) — it makes no library claims; CR on system-agnosticism (VI) — it encodes
no game mechanics.

### Key Entities

- **Session (play session)**: an opaque identifier that events belong to. **No registry
  exists** — spec 004 left `session_id` opaque and the WebSocket protocol explicitly provides
  no session creation or listing. A client subscribes to an identifier it already knows, and
  this feature MUST NOT invent a registry to fix that.
- **Event**: one recorded fact in a session — carrying `seq`, `actor`, `type`, `payload`,
  `payloadVersion`, `visibility`, `ts`. Assigned by the server; never by the client.
- **User**: `id`, `displayName`, `role` — as returned by the auth endpoints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean clone, `docker compose up` plus the documented account-creation
  step yields a browser-reachable signed-in application, with no dev server started by hand.
- **SC-002**: Two browsers with separate cookie jars, signed in as different accounts on one
  session: a message sent in one appears in the other. **Verified by running it**, with the
  evidence recorded.
- **SC-003**: After exchanging messages, reloading either browser renders the prior messages
  rather than an empty view.
- **SC-004**: A sent message appears in the sender's own view exactly once — no duplicate
  from an optimistic render.
- **SC-005**: A client resuming after a disconnect receives every event it missed, none
  twice, including across a `seq` gap caused by visibility filtering.
- **SC-006**: All gates green in the worktree: `pnpm install && pnpm typecheck && pnpm lint &&
  pnpm test && pnpm build`, with literal output recorded in the PR.

## Assumptions

- **Accounts for the demo are created through existing paths.** The operator account comes
  from the existing `auth:create-operator` script; the second person comes from the existing
  invitation endpoints. This feature adds no new account-creation path.
- **The session id is supplied, not discovered.** With no registry by design, the demo
  reaches one session id by a documented means (both browsers opening the same URL). Building
  a session registry is out of scope and would exceed the card.
- **Styling is minimal on purpose.** M0 is a walking skeleton. A visual design pass is not in
  this card and would be design work this tier is not scoped for.
- **No client-side test framework is mandated by this card.** The repo has no browser test
  runner today; adding one is a judgement call the card does not make. Verification of the
  demo is by running it, per the milestone.
- **The existing server behaviours are correct and verified** (spec 006's live verification).
  This feature consumes them and does not re-derive them.

## Out of Scope

- CI (TASK-0017) — the gates are run by hand and pasted into the PR, as this whole sweep has.
- A session registry, session creation UI, or session listing.
- Presence, typing indicators, or room membership — the protocol reserves no space for them.
- Any change to the WebSocket frame shapes or auth endpoint contracts.
- PixiJS, the tabletop, or any M1+ surface.
