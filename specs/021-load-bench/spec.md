# Feature Specification: Load and stress benchmark

**Feature Branch**: `task-0030-load-bench`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Benchmark system: ingest scaling, concurrency, and stress limits
(TASK-0030). An ingest benchmark measures jobs-table throughput and latency as queued volume
grows and reports where it degrades. A concurrency benchmark measures HTTP and WebSocket
latency and errors as simulated users grow. Stress cases cover database connection exhaustion
and app restart mid-ingest. Each case declares its tier (every commit, on demand, or against
dev only); out-of-tier cases skip with a visible reason. Results are stored with config and
commit." Direction: doc-0001 "Added requirement: benchmarks" (tiering; heavy cases on demand or
against the hosted `dev`), decision-0005 (a worker split or real queue happens only on a
recorded measurement from this benchmark), doc-0002 (`dev` on vm-104).

## User Scenarios & Testing *(mandatory)*

The users are the operator, who decides from measurements whether the single in-process
ingest worker and the single Node process are enough (decision-0005), and CI, which must catch
a change that breaks the ingest queue or the realtime path under concurrent use.

### User Story 1 - Find where ingest degrades (Priority: P1)

The operator runs one command. It fills the ingest queue with synthetic documents in growing
steps, lets one or more workers drain each step, and prints throughput and latency per step.
It names the first step where ingest degrades, or states that none did.

**Why this priority**: decision-0005 blocks any worker split on this exact measurement. Without
it the split question stays an opinion.

**Independent Test**: run the on-demand ingest case on a worktree's test stack. It prints one
row per (queued volume, worker count) step and a degradation verdict per worker count.

**Acceptance Scenarios**:

1. **Given** a profile with queued volumes 10, 50, 100, 250, 500 and worker counts 1 and 2,
   **When** the operator runs the ingest case, **Then** the table has one row per step with
   throughput, queue wait p50/p95, service time p50/p95, and enqueue latency p95.
2. **Given** a step whose throughput falls below the profile's threshold fraction of the first
   step, **When** the run finishes, **Then** the verdict names that step's volume and the rule
   that fired.
3. **Given** a run where no rule fires, **When** the run finishes, **Then** the verdict reads
   "no degradation up to <largest volume>".

### User Story 2 - Find where concurrent users degrade (Priority: P1)

The operator runs one command. It simulates growing numbers of signed-in users, each making
HTTP requests and holding a WebSocket, and prints latency and error rate per step. It names
the first step where latency or errors cross the threshold.

**Why this priority**: the card's second criterion. It shows whether one Node process serves
a table of players.

**Independent Test**: run the on-demand concurrency case locally. It prints one row per
simulated-user count with HTTP p50/p95/p99, WebSocket connect and round-trip p95, and error
rate.

**Acceptance Scenarios**:

1. **Given** user counts 1, 10, 25, 50, 100, **When** the case runs, **Then** each step reports
   request count, error count, error rate, HTTP latency percentiles, and WebSocket latency
   percentiles.
2. **Given** a step whose HTTP p95 exceeds the threshold multiple of the one-user step, or whose
   error rate exceeds the threshold, **When** the run finishes, **Then** the verdict names that
   step.

### User Story 3 - See how the system fails under stress (Priority: P2)

The operator runs two stress cases. One exhausts the database's connection slots and records
how the app responds and how fast it recovers. The other kills a worker mid-job and records
whether every job still finishes exactly once and how long recovery takes.

**Why this priority**: the card's third criterion. These are the failures a hosted table meets
first.

**Independent Test**: run each stress case locally. Each prints its observations and a pass or
fail per expected behavior.

**Acceptance Scenarios**:

1. **Given** every free connection slot is held, **When** a client calls the app, **Then** the
   health check reports degraded, requests fail within a bounded time rather than hang, a
   WebSocket upgrade is refused as unavailable (never as signed-out), and the process stays up.
2. **Given** the held slots are released, **When** the case polls, **Then** it records the time
   until the health check reports ok and requests succeed again.
3. **Given** a worker is killed while a job is mid-stage, **When** a new worker starts, **Then**
   every job succeeds, the killed job shows two attempts, each book has exactly one stored
   document, and the case records the time from kill to reclaim.

### User Story 4 - Run the right cases in the right place (Priority: P1)

Every case declares one tier: every commit, on demand, or against dev only. A run names a
tier. Cases of other tiers are listed as skipped with the reason, never silently omitted.

**Why this priority**: doc-0001 requires cheap cases on every commit and heavy cases elsewhere.
A silent skip would look like a pass.

**Independent Test**: run the command with each tier. Each run lists every case: those of the
named tier run, the rest print "SKIP" with their tier and the reason.

**Acceptance Scenarios**:

1. **Given** the every-commit tier, **When** `pnpm test` runs with `REQUIRE_DATABASE=1`, **Then**
   the every-commit cases run and the others print a skip line naming their tier.
2. **Given** the dev tier with no dev URL or credentials configured, **When** the command runs,
   **Then** the dev case skips with "dev target not configured" and the command exits 0.
3. **Given** the dev tier without the explicit dev-consent flag, **When** the command runs,
   **Then** it refuses before any network call.

### User Story 5 - Compare runs over time (Priority: P2)

Every run writes one results file holding the tier, the profile config, the commit, the host,
the target, and every case's outcome, including skips with reasons. A report command lists
stored runs grouped by case and target.

**Why this priority**: the card's fifth criterion. The decision-0005 measurement must trace to
its config and commit.

**Independent Test**: run a tier twice; the report prints both runs' rows with commit and date.

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the operator lists the results directory, **Then** one new
   file exists, named by date, short commit, and run id, and it validates against the schema.
2. **Given** results from local and dev targets, **When** the report runs, **Then** local and
   dev rows are never mixed in one group.

### Edge Cases

- The load database name equals the base database name: the command refuses.
- The load database host is not loopback for a local case: the command refuses. Local cases
  never touch a shared server.
- A step fails to drain within its timeout: the step records `timedOut`, the case fails, and
  later steps of that worker count are skipped with the reason.
- The dev target's health check is unreachable: the dev case fails before sign-in.
- The dev run is interrupted: the bench still signs out in its cleanup path.
- A killed worker's job finishes before the kill lands: impossible by construction; the killed
  worker's embed stage is held open until the kill (research R6).
- Two runs start on one worktree at once: the second refuses because the load database is in
  use.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The ingest case MUST enqueue synthetic documents directly into the jobs queue in
  cumulative steps of growing volume, drain each step with a configured number of worker
  processes, and record per step: volume, worker count, total jobs-table rows, wall time,
  throughput, queue wait p50/p95, service time p50/p95, enqueue latency p95, and failed count.
- **FR-002**: Synthetic documents MUST be generated from original text only. No rulebook text,
  SRD or otherwise, is required or committed by this feature.
- **FR-003**: The ingest verdict MUST name the first degraded step and the rule that fired. A
  step degrades when throughput falls below a fraction of the first step's, when service p95
  rises above a multiple of the first step's, or when enqueue p95 rises above a multiple of the
  first step's (above an absolute floor). The thresholds live in the profile and in the results.
- **FR-004**: The concurrency case MUST simulate a configured number of signed-in users per
  step. Each user loops HTTP reads and holds a WebSocket for the step's duration. The case MUST
  record per step: users, requests, errors, error rate, HTTP p50/p95/p99, WebSocket connect
  p95, and WebSocket round-trip p95.
- **FR-005**: The concurrency verdict MUST name the first step where HTTP p95 exceeds a multiple
  of the one-user step (above an absolute floor) or the error rate exceeds a threshold.
- **FR-006**: The connection-exhaustion case MUST hold every free connection slot of the load
  database's server, probe the app, release the slots, and record: health status, request
  outcome and time, WebSocket upgrade status, process liveness, and time to recovery.
- **FR-007**: The restart case MUST kill a worker process while a job is mid-stage, start a new
  worker, and record: each job's final status, the killed job's attempts, stored documents per
  book, and time from kill to reclaim.
- **FR-008**: Every case MUST declare exactly one tier: `commit`, `demand`, or `dev`.
- **FR-009**: A run MUST name one tier. Every case outside it MUST print a skip line naming its
  tier and the reason, and the results file MUST record it as skipped with that reason.
- **FR-010**: `commit` cases MUST run inside `pnpm test`, finish in under 30 seconds together,
  and assert correctness only, never timing.
- **FR-011**: Local cases MUST run against a dedicated load database that no app process polls,
  on a loopback host, recreated per run.
- **FR-012**: `dev` cases MUST require the dev URL, dev credentials, and an explicit consent
  flag. They MUST perform only reads plus one sign-in and one sign-out, and MUST NOT write to
  the library, the jobs queue, or the event log.
- **FR-013**: Each run MUST write one results file holding schema version, run id, times,
  commit sha, dirty flag, host facts, tier, target, the profile config, and every case outcome.
- **FR-014**: A report command MUST print stored results grouped by case and target.
- **FR-015**: Results files MUST NOT hold credentials, cookies, tokens, URLs with credentials,
  or document text.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST drive every case through the same CLI and the
  same exported case functions CI and the operator use.
- **CR-002** (III. Data planes): Local cases MUST write only to their own load database. Dev
  cases MUST write nothing to the library or session planes.
- **CR-003** (VIII. Operator-owned content): The feature MUST commit no rulebook text. Results
  hold numbers, ids, and fixed strings only.
- **CR-004** (IX. Self-hostable): The feature MUST add no container, service, or new runtime
  dependency.

### Key Entities

- **Case**: id, tier, description, and a run function that returns steps and a verdict.
- **Profile**: the axis values and thresholds for one tier.
- **Step**: one measured point (a volume and worker count, or a user count).
- **Verdict**: the first degraded step and its rule, or none.
- **Run**: one execution of one tier, with provenance and case outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The every-commit cases add under 30 seconds to the test run.
- **SC-002**: One on-demand run produces the ingest verdict decision-0005 requires, traceable to
  its commit and profile.
- **SC-003**: Every case not run in a tier appears in that run's output and results with a
  reason. Zero silent omissions.
- **SC-004**: A dev run leaves no library, job, event, or session record behind on `dev`.
- **SC-005**: A dev run completes in under 3 minutes and never exceeds 25 simulated users.

## Assumptions

- Ingest is driven by direct enqueue, not HTTP upload. The upload route's streaming was
  measured by TASK-0024's merge condition; this benchmark measures the queue and the worker.
- The embed stage uses the gateway's fake provider, so no key, network, or cost is involved.
- Local latency numbers compare only within one host. The results record the host.
- The dev target uses an existing dev account the operator names. The bench creates no account.
- Heavy ingest on vm-104 hardware is out of scope: it would need commands on vm-104. A later
  card can add it.
- The measurement informs decision-0005; the worker-split decision itself is a later decision
  record, not this feature.

## Clarifications

None asked. The card, doc-0001, doc-0002, decision-0005, the runbook's TASK-0030 merge
condition, and the dispatch's design calls settle every open point. Each design call is
recorded with its rationale in research.md.
