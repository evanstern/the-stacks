# Quickstart — validating the event log

Runnable checks proving the feature works. Every command runs from the repository root.

## Prerequisites

- Node 22 and pnpm (repository baseline, TASK-0010).
- Docker, for the Postgres 17 + pgvector container (TASK-0011).
- `.env` present with `DATABASE_URL` and `APP_PORT` (copy `.env.example`).

## 1. Bring up the database

```bash
docker compose up -d db
```

The concurrency checks below need a real database. They are the evidence for the
race-safety criterion and cannot be satisfied by test doubles (research D2).

## 2. Apply migrations to a fresh database

```bash
pnpm --filter @the-stacks/server db:migrate
```

**Expected**: the command reports applied migrations and exits 0. The `events` table now
exists with the primary key, check constraints, and append-only guard from
[data-model.md](./data-model.md).

**Then run it a second time.** It must exit 0 and apply nothing (FR-011, SC-006). A second
run that re-applies or errors is a failure of this check, not a quirk.

## 3. Run the test suite

```bash
pnpm test
```

**Expected**: unit tests plus the integration tests covering append, cursor read-back, and
concurrent appends to one session.

**Read the output, do not just read the exit code.** The integration tests skip when no
database is reachable, and a skip prints a visible notice. A green run whose notice says
the database tests were skipped has proven nothing about race-safety — that is the whole
point of D2, and the reason the skip is loud rather than silent.

## 4. Confirm the guarantees by hand

With the database up, these are the checks a reviewer can run directly against
`psql` to confirm the tests are testing the truth.

**Gapless under concurrency** — after the concurrency test has run, for each session
exercised:

```sql
SELECT count(*) AS events,
       max(seq)  AS highest,
       count(DISTINCT seq) AS distinct_positions
FROM events
WHERE session_id = '<session uuid>';
```

**Expected**: all three numbers equal. `count = max` proves no gaps (positions run 1..max
with none missing); `count = distinct` proves no duplicates. If `max > count`, a position
was consumed and lost — the exact failure a sequence or identity column would produce
(research D1).

**Append-only is enforced at the database, not just in code**:

```sql
UPDATE events SET actor = 'tampered' WHERE session_id = '<session uuid>' AND seq = 1;
DELETE FROM events WHERE session_id = '<session uuid>' AND seq = 1;
```

**Expected**: both are rejected. This is the layer that protects against every client that
is not this application (data-model.md, Append-only enforcement).

## 5. Tear down

```bash
docker compose down
```

Data survives in the named volume. `docker compose down -v` also removes the volume, which
is how to get back to the fresh-database state for step 2.

## What this quickstart does not cover

Live subscription, per-viewer visibility filtering, and payload validation are out of
scope for this feature — see [contracts/event-log.md](./contracts/event-log.md), "What this
seam deliberately does NOT provide".
