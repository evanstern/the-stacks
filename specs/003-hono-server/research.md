# Phase 0 — Research: Hono server, health and one typed route

The spec carries no `[NEEDS CLARIFICATION]` markers: architecture A1/A2 and the
constitution's Architecture Constraints table settle every technology question, and the
sweep runbook fixes the one cross-task ambiguity. What remains is not "which technology"
but "how to use the mandated ones correctly here." Those are recorded below.

## D1 — The health endpoint must be bounded, not merely correct

**Decision**: The database liveness probe runs under an explicit timeout, and a timeout is
reported as `database.reachable: false` rather than propagated as an error.

**Rationale**: The failure that matters operationally is not a database that is *down* —
that fails fast and is obvious. It is a database that is *hung*: accepting the TCP
connection but never answering. An unbounded probe inherits that hang, the health request
never returns, and the orchestrator's healthcheck times out with no information. SC-002
therefore states a bound rather than a latency target, and edge case 1 in the spec names
this case directly.

**Alternatives considered**: Let the driver's default timeout govern — rejected, because
it is neither guaranteed to exist nor visible in this feature's code, so the bound would
be an accident of configuration. Omit the probe and report only process liveness —
rejected: it makes the endpoint dishonest in exactly the situation an operator needs it,
and AC#2 of the board task requires database status.

## D2 — Two failure classes, distinguishable by the client

**Decision**: The structured error carries a machine-readable discriminator separating
client-caused failures (validation) from server-caused ones (internal), with validation
errors naming the offending input and internal errors naming nothing.

**Rationale**: FR-007 requires the distinction, and the two have opposite disclosure
rules. A validation error is *useful* precisely when specific — an agent reads it and
retries correctly (CR-001). An internal error must disclose nothing: stack traces, paths,
and driver messages all leak internals, which FR-006 forbids.

**Alternatives considered**: One opaque error shape for everything — rejected: it fails
FR-007 and strands an agent with no way to know whether retrying differently would help.
Rely on the status code alone — rejected: a status code is not a structured body, and the
spec's edge case for unknown paths requires the same *shape*, not merely the same class.

## D3 — The app is built separately from being served

**Decision**: Route composition and error handling are exported as a value that tests
exercise directly; binding a port happens only in the entrypoint.

**Rationale**: FR-008 requires tests for both endpoints in both states. Testing through a
real listening socket means allocating ports, waiting for readiness, and tearing down —
slow, and flaky in parallel test runs for no gain. The database-unreachable case is also
far easier to exercise when the app can be constructed against a deliberately broken
connection.

**Alternatives considered**: Test against a started server — rejected for the reasons
above. Export the routes but not the composed app — rejected: the error handling is part
of what the tests must cover, and it lives in the composition.

## D4 — Route schemas live in the shared package

**Decision**: The typed route's input and output schemas are defined in
`packages/shared` and imported by the server, rather than defined inside the server.

**Rationale**: Constitution II requires schemas be single-source across the API boundary,
the agent tool definition, and the client form. TASK-0016's web client will consume this
route; if the schema lives in the server, the client either imports across an app
boundary or keeps a copy that silently drifts. `packages/shared` exists for exactly this —
TASK-0010 created it with no consumer precisely so this seam would be available.

**Alternatives considered**: Define in the server and export — rejected: it makes
`apps/web` depend on `apps/server`, which is a dependency direction the monorepo layout
deliberately avoids. Duplicate in both — rejected outright: it is the failure mode the
single-source rule exists to prevent.

## D5 — The typed route's subject matter

**Decision**: The route is an echo-shaped endpoint: it accepts a small validated payload
and returns a validated response derived from it. It models no product concept.

**Rationale**: The board task asks for "at least one typed REST route" to prove the
validation seam. Any product-shaped route here would anticipate the codex or session
planes, which are M2 and TASK-0012 — inventing their shapes now is guessing, and a later
task would have to undo it. The spec's final assumption states this boundary.

**Alternatives considered**: A real campaign or session route — rejected as premature.
Reusing health as "the typed route" — rejected: health has no meaningful input, so it
cannot demonstrate input validation or the validation-failure path at all.
