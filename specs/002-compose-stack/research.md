# Phase 0 — Research: the compose stack

No `[NEEDS CLARIFICATION]` markers remained in the spec: architecture A1 and the
constitution's Architecture Constraints table settle the topology, the database version,
and the extension. What follows are the decisions those ratified choices still leave open.

## D1 — The healthcheck must read the body, not the status code

**Decision**: The application service's healthcheck requests `GET /health` and treats the
service as healthy only when the parsed body reports an overall `ok`.

**Rationale**: Spec 003's contract makes `GET /health` return `200` in every case,
deliberately — a non-2xx would be indistinguishable from an unreachable server, and the
endpoint exists precisely to describe a *degraded but answering* process. The consequence
for this feature is sharp: **a healthcheck that only checks HTTP status would mark a
container healthy while its database is down**, which is the exact failure FR-007 forbids.
This is the single most likely implementation mistake in this task.

**Alternatives considered**: Check the HTTP status only — rejected: silently wrong in the
one case that matters. Have the app return 503 when degraded — rejected: that is spec
003's contract to define, it is already fixed, and changing it is an operator checkpoint
that would invalidate the sibling task.

## D2 — Convergence, not crash-looping, when the database lags

**Decision**: The application service declares a dependency on the database reaching a
healthy state, AND the application's own healthcheck is given start-up grace before
failures count against it.

**Rationale**: FR-008 requires the stack to converge without operator intervention.
Postgres routinely takes seconds to accept connections on a cold start, and an
unconditioned dependency plus an immediately-counting healthcheck produces a container
that restarts faster than the database becomes ready. Both halves are needed: ordering
alone does not cover a database that is up but not yet accepting connections.

**Alternatives considered**: Ordering alone — rejected: "started" is not "accepting
connections". Retry logic inside the application — rejected for this task: it belongs to
spec 003's connection handling, and duplicating it here splits one concern across two
tasks. A fixed sleep — rejected: guesses, and is either too short on slow hosts or wasted
time on fast ones.

## D3 — The example file is the authoritative configuration list

**Decision**: A committed example environment file enumerates every variable the stack
requires, with safe placeholder values and no real secret. The operator's filled-in copy
is git-ignored.

**Rationale**: SC-004 says an operator must never discover a required variable by reading
source or hitting a runtime error. That makes the example file a *contract*, not a
convenience — it is the interface between this project and a stranger's machine. FR-006's
second half matters just as much: an operator who edits the example in place must not find
their real credentials staged for commit, which is why the ignore rule ships with this
feature rather than later.

**Alternatives considered**: Defaults baked into the compose file — rejected: it hides the
required set and encourages shipping a real credential as a default. Documenting variables
in the README only — rejected: prose drifts from the code that reads it; an example file
can at least be diffed against reality.

## D4 — Postgres 17 with pgvector comes from a prebuilt image

**Decision**: Use a published Postgres 17 image that already includes pgvector, rather
than building a custom image that installs the extension.

**Rationale**: Every custom image is something the operator must trust and the project
must maintain. A published image with the extension already present is fewer moving parts
for a stack whose entire promise is "this works on your machine". The extension needs only
to be *available* in M0 — enabling it in a database is a migration concern, which is
TASK-0012.

**Alternatives considered**: Build a custom Postgres image — rejected: maintenance and
trust cost for no M0 benefit. Plain Postgres 17 and add the extension later — rejected:
User Story 3's whole point is that an operator who sets up today should not have to
migrate their datastore when retrieval arrives.

## D5 — A multi-stage application image

**Decision**: Build the application image in stages, so build tooling and dev dependencies
do not reach the runtime image.

**Rationale**: This image is what self-hosters download. A runtime image carrying the
full build toolchain is larger and has more surface for no operational benefit. The
monorepo makes this slightly more involved than a single-package build — the workspace
must be installed so the server's dependency on the shared package resolves — which is
exactly why it is a recorded decision rather than an assumption.

**Alternatives considered**: Single-stage build — rejected: simpler to write, worse to
distribute, and distribution is this feature's entire purpose. Building only the server
package in isolation — rejected: it depends on `packages/shared` through the workspace,
so the workspace context is required.
