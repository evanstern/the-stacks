# Phase 0 — Research: Drizzle, migrations, and the session event log

The spec carries no `[NEEDS CLARIFICATION]` markers. Architecture A4 fixes the table's
columns, constitution IV fixes append-only/versioned/visibility semantics, and the
Architecture Constraints table fixes Postgres 17 + Drizzle. What remains is not "which
technology" but "how to use the mandated ones so the guarantees actually hold." Four
decisions, below.

D1 is the one the sweep runbook flags as this task's single real judgment call.

## D1 — Gapless per-session sequencing via a transaction-scoped advisory lock

**Decision**: An append runs inside one transaction that first takes a transaction-scoped
Postgres advisory lock keyed on the session identifier, then inserts the event with
`seq = COALESCE(MAX(seq), 0) + 1` computed for that session. The table's primary key
`(session_id, seq)` is the correctness backstop. The lock releases at commit or rollback;
nothing is held across requests.

**Rationale**: The spec's guarantee is stronger than "no duplicates" — FR-002 and SC-002
demand **no gaps**, and that requirement is what eliminates the otherwise-obvious options.
Gaplessness is load-bearing because of how A4 defines reconnect: a client replays from a
cursor, so it must be able to tell "position 7 does not exist yet" from "position 7 will
never exist." A permanently missing position makes those two states indistinguishable, and
a replaying client either stalls waiting for an event that is never coming or silently
skips a hole it cannot see. Advisory locks are the mechanism Postgres provides for exactly
this — serializing a critical section by application key rather than by row — and keying it
per session means two different sessions never block each other, which is what FR-003
requires anyway. Because the lock is transaction-scoped, a failed append releases it on
rollback having consumed nothing, which is precisely the spec's "append fails partway"
edge case: the next writer computes the same `MAX` and takes the same position.

**Alternatives considered**:

- **A Postgres sequence or `GENERATED ... AS IDENTITY` column** — rejected, and this is the
  important rejection. Sequences are explicitly non-transactional: a value handed to a
  transaction that later rolls back is *consumed*, never reissued. That is a deliberate
  design choice for performance and it is correct for surrogate keys, but it produces a
  gappy sequence by construction. It also cannot produce a *per-session* counter without
  one sequence per session, which is unbounded DDL driven by user data. Disqualified on
  gaplessness before any performance discussion starts.
- **Optimistic insert with retry on unique violation** (compute `MAX+1`, insert, catch
  `23505`, retry) — rejected as the primary mechanism, though it is genuinely correct: the
  primary key rejects the loser and the retry recomputes. Two reasons it loses. First,
  under READ COMMITTED the failure rate grows with concurrency — at the 50-writer bar in
  SC-003 a meaningful share of appends retry, some repeatedly, and a retry budget is a new
  failure mode to specify and test. Second, it converts a routine concurrent write into an
  error path, so the system's normal operation depends on exception handling being right.
  The advisory lock makes the common path linear and keeps the unique constraint as a
  backstop that should never fire — which is the better place for a constraint to live.
- **`SERIALIZABLE` isolation with retry on serialization failure** — rejected for the same
  retry-budget reason, plus a broader blast radius: the isolation level applies to the whole
  transaction, so an append batched with unrelated work inherits serialization conflicts
  that have nothing to do with sequencing. The advisory lock scopes the serialization to
  exactly the thing that needs it.
- **A per-session counter row updated with `UPDATE ... RETURNING`** — rejected on scope.
  Row-level locking would work and is a common pattern, but it requires a session registry
  table to hold the counter, and the spec deliberately keeps `session_id` opaque with no
  sessions table in M0. It also adds a second write to every append.
- **Application-level locking (a mutex in the Node process)** — rejected outright. It holds
  only while exactly one process writes. Architecture A2 runs one Node process *today*, but
  a guarantee that silently breaks on the first horizontal scale-out is not a guarantee, and
  an in-process mutex cannot protect against a migration script or an operator's `psql`
  session appending. The lock belongs in the database because the invariant does.

**Collision note**: `pg_advisory_xact_lock` takes integer keys, so a non-integer session
identifier must be hashed into one. Two sessions whose identifiers collide serialize against
each other — a performance effect, never a correctness one, since the sequence is still
computed per session. Use the two-argument form with a fixed namespace key so this feature's
locks cannot collide with any other advisory-lock user in the process.

## D2 — Race-safety is proven against a real database, never against a fake

**Decision**: The concurrency tests in this feature run against a real Postgres instance —
the one `docker compose up -d db` already provides — and are the evidence for AC#5. They are
skipped **loudly** (a printed notice, not a silent pass) when no database URL is configured,
and the task's PR evidence must show them having actually run.

**Rationale**: This feature's central guarantee is a concurrency property, and concurrency
properties are exactly what test doubles cannot observe. A fake that hands out sequence
numbers proves only that the fake is internally consistent; it cannot exhibit a lost update,
a unique-constraint race, or a lock that was never taken. This project has already paid for
that lesson once: the T016 finding (sweep runbook, 2026-09-22) documents a crash that reached
`main` because every existing test injected a fake probe, so no test ever constructed a real
connection — "only booting the real stack and stopping the real database could find it." The
same shape of blind spot applies here with higher stakes, because a sequencing defect
corrupts durable history rather than crashing a process.

**Alternatives considered**:

- **Skip the integration tests silently when no database is present** — rejected, and this is
  the distinction that matters: a *silent* skip and a *fake* pass are both green, and green
  is what gets trusted. A loud skip is visible in the output, so a run that proved nothing
  looks different from a run that proved something.
- **An embedded or in-memory Postgres substitute** — rejected on two counts: it adds a
  dependency the Architecture Constraints table does not carry, and advisory-lock semantics
  are precisely the kind of server behavior a substitute is most likely to approximate.
  Testing the mechanism against an approximation of the mechanism proves little.
- **Assert race-safety by code review alone** — rejected. SC-003 states a number (50+
  concurrent writers). A stated number that is never executed is decoration.

## D3 — Migrations are generated files, committed, and applied by one command

**Decision**: Schema changes are authored as Drizzle schema definitions, compiled to SQL
migration files by `drizzle-kit generate`, committed to the repository, and applied by a
single documented command that runs Drizzle's migrator. The generated SQL is the artifact of
record; the migrator tracks which files have been applied.

**Rationale**: FR-010 and FR-011 require a fresh database to reach the same schema as an
existing one, and require re-application to be a no-op. A migrator with a tracking table
gives both properties directly. Committing the generated SQL — rather than generating it at
deploy time — is what makes SC-006 checkable: the file that ran in development is byte-for-byte
the file that runs on a self-hoster's machine, so the schema cannot drift between them.
Constitution IX's self-hosting requirement makes this concrete: the operator runs one command,
not a sequence of environment-dependent steps.

**Alternatives considered**:

- **`drizzle-kit push`** (diff the schema against the live database and apply directly) —
  rejected for anything but local scratch work. It leaves no committed artifact, so there is
  nothing to review, nothing to replay, and no way to prove two databases agree. It also
  computes the change against whatever the target currently is, which is precisely the drift
  FR-011 exists to prevent.
- **Hand-written SQL migrations** — rejected. It duplicates the schema in two places (the
  Drizzle definitions the application types against, and the SQL that actually runs) with no
  mechanism keeping them honest. Generation makes drift structurally impossible.
- **Applying migrations automatically at server start** — rejected as the *only* path, though
  the command may be invoked that way by the container. Migration is a deployment action with
  different failure semantics than serving traffic; binding it to process start means a failed
  migration is a crash loop rather than a failed command with an error message. A documented
  command satisfies FR-010 and leaves the choice of when to run it to the operator.

## D4 — The log stores payloads opaquely; ordering and immutability are its only promises

**Decision**: `payload` is stored as a structured JSON column with no schema enforced at the
database layer, alongside a separate integer payload-version column. `type` is stored as text.
The append path validates the envelope — that a session, actor, type, visibility, and version
are present — and does not inspect payload contents.

**Rationale**: Constitution IV puts payload validation at the server, against the *active
system module*, and VI forbids the core from assuming 5e mechanics. The system-module
interface does not exist until M3, so any payload schema enforced here would necessarily be a
guess at one system's shape, embedded in the one table that can never be rewritten in place.
Keeping payloads opaque is what lets FR-012's requirement hold — a reader returns event types
and payload versions it does not recognize — and it is the property that makes A4's "the AI DM
is just another actor" work, since an agent's events are stored by the same path as a human's
with no type registry to update. The version column is separate from the payload rather than
inside it so a reader can filter and route on version without parsing the payload at all.

**Alternatives considered**:

- **A discriminated union of event payload schemas validated at append** — rejected for M3, not
  forever. This is the right eventual design and the system module will bring it; doing it now
  would bake one system's assumptions into the log, violating VI, and would make every new event
  type a schema migration.
- **Storing the payload as text and parsing on read** — rejected: it forfeits the ability to
  query into payloads later (Postgres indexes JSON; it does not index arbitrary text usefully)
  for no gain, since the column is written and read as structured data either way.
- **Putting the schema version inside the payload** — rejected. A reader deciding whether it can
  interpret a payload would have to parse the payload first, which is backwards, and the version
  would be unavailable to a database-level query or index.
