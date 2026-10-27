---
name: database-schema
description: The session- and auth-plane tables and their constraints — events (composite PK, positive-seq/positive-version CHECKs, no extra index), users/auth_sessions/invitations — and the append-only trigger hand-added to the generated migration, which really does make Postgres refuse a DELETE. Library-plane content tables are [[library-schema]]; the shared operational jobs table (ingest plus DM turn/floor/companion/chronicle kinds) is here.
kind: component
sources:
  - apps/server/src/schema/events.ts
  - apps/server/src/schema/auth.ts
  - apps/server/src/schema/jobs.ts
  - apps/server/src/schema/dm-model-calls.ts
  - apps/server/drizzle/0000_mushy_thor_girl.sql
  - apps/server/drizzle/0003_dazzling_cargill.sql
  - apps/server/drizzle/0004_glamorous_warlock.sql
  - apps/server/drizzle/0005_unknown_lizard.sql
  - apps/server/drizzle/0006_fearless_jamie_braddock.sql
  - apps/server/drizzle/0007_aromatic_baron_zemo.sql
verified_against: 4af9ecbd6436d6529ceb61b058a9df75fb805925
---

# Database Schema

This note covers the session and auth planes, plus the library plane's operational `jobs`
table. Five tables across three Drizzle schema files: `events` (`apps/server/src/schema/
events.ts`, the session plane), `users` / `auth_sessions` / `invitations`
(`apps/server/src/schema/auth.ts`), and `jobs` (`apps/server/src/schema/jobs.ts`, TASK-0024).
The library plane's three *content* tables (`library_documents`/`library_chunks`/
`library_embeddings`, TASK-0022) are documented separately in [[library-schema]] — same repo,
same pattern for its own immutability trigger, different concept.

## How it works

**`events`** — composite primary key `(session_id, seq)`, plus two CHECK constraints:
`events_seq_positive` (`seq > 0`) and `events_payload_version_positive`
(`payload_version > 0`). `seq` is a plain `bigint`, never a Postgres sequence or identity
column — those are non-transactional and gappy by construction, and gaplessness is exactly
what [[event-log]] exists to guarantee. `visibility` defaults to `'public'` at the column
level. **No index beyond the primary key**: `(session_id, seq)` already serves the only read
this feature performs (`readFrom`'s `WHERE session_id = ? AND seq > ?` cursor scan), and a
redundant index would tax the hottest write path in the system for no read this codebase
makes.

**The append-only guard is a database trigger, not application logic**, hand-added to the
generated migration `apps/server/drizzle/0000_mushy_thor_girl.sql` (Drizzle's schema DSL has
no way to express a trigger, so it can't be generated). It really does refuse writes at the
database level:

```sql
CREATE FUNCTION "events_append_only"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "events_append_only_guard"
	BEFORE UPDATE OR DELETE ON "events"
	FOR EACH ROW EXECUTE FUNCTION "events_append_only"();
```

Any `UPDATE` or `DELETE` against `events` — from application code, a migration, or an
operator's own `psql` session — raises an exception and rolls back. This is a stronger
guarantee than "the app never does this"; it holds even against direct database access.

**`users`** — `role` is a CHECK-constrained `text` column (`'operator' | 'player'`), not a
Postgres enum, because adding a role later to an enum needs a migration some tooling handles
poorly. `username` uniqueness is enforced case-insensitively via a `uniqueIndex` on
`lower(username)` — "Alice" and "alice" cannot both exist, since two accounts differing only
in case is a phishing vector inside a table of people who trust each other. `passwordHash`
stores the encoded scrypt output (see [[password-hashing]]), never the password.

**`auth_sessions`** — deliberately **not** named `sessions`: `events.session_id` is a *play*
session, `auth_sessions` a signed-in browser, and an unqualified `sessions` table would invite
a later reader (or query) to join the wrong one. Stores `tokenHash` (never the raw token, see
[[session-auth]]), a unique index on `tokenHash` (the lookup key for every authenticated
request), an index on `userId` (this table is read-heavy and small, unlike `events`), and an
absolute `expiresAt` with no `last_used_at` — writing that on every validation would turn the
system's hottest read into a write, and it is the seed of an accidental sliding expiry.

**`invitations`** — `tokenHash` (unique index), `expiresAt` (bounded; an unexpiring invitation
is a permanent backdoor), and `redeemedAt`/`redeemedBy`, null meaning unredeemed and set
exactly once via a conditional `UPDATE` (see [[invitations]]) — never read-then-write.

**`jobs`** (TASK-0024; extended by TASK-0046, migration `0004_glamorous_warlock.sql`; react index in `0006_fearless_jamie_braddock.sql`) — one
shared queue table with five `kind`s: `ingest` (one row per upload), plus the DM runtime's
`turn`, `companion`, `chronicle` and (migration 0007, TASK-0050) `floor` ([[dm-runtime]], [[dm-turn-jobs]]). It tracks operational state
(`queued → running → succeeded|failed`, `stage`, `attempts`, a per-claim
`claim_token`/`heartbeat_at` lease). Unlike every table above, **it is not append-only or
immutable** — rows update in place as a job advances, and it carries no trigger.
`jobs_claim_idx` (`status`, `created_at`) serves the oldest-first claim query.

Migration 0004 made `book` nullable and added `session_id` (uuid, no FK). Checks:
`jobs_kind_valid` allows the five kinds; `jobs_book_required_for_ingest` (`kind <> 'ingest' OR
book IS NOT NULL`); `jobs_session_required_for_dm` (`kind = 'ingest' OR session_id IS NOT NULL`);
`jobs_stage_valid` now also admits the DM stages (`assemble`, `director`, `interpret`,
`adjudicate`, `resolve`, `narrate`, `audit`, `companion`, `chronicle`). Partial unique indexes:
`jobs_active_book_key` (on `lower(trim(book))`) is now scoped `WHERE kind = 'ingest' AND status
IN ('queued','running')`, so a finished book can be re-uploaded while a second concurrent upload
is refused; `jobs_turn_queued_key` and `jobs_chronicle_queued_key` allow one queued turn / one
queued chronicle per `session_id`; `jobs_companion_react_queued_key` (migration `0006_fearless_jamie_braddock.sql`, TASK-0114) allows one
queued `companion` job with `input->>'reason' = 'react'` per session;
`jobs_floor_queued_key` (migration `0007_aromatic_baron_zemo.sql`) allows one queued `floor` job per `(session_id, input->>'check', coalesce(input->>'actionId', ''))`;
`jobs_session_running_key` allows one running `turn`, `companion` or `floor` job per session (0007 recreated it). `jobs_dm_session_idx` is `(session_id, kind, status)`. Full
lease/fencing/recovery mechanics are [[ingestion]]'s (ingest claim) and [[dm-turn-jobs]]'s (DM claim).

**`dm_model_calls`** (TASK-0116, migration `0005_unknown_lizard.sql`) — the DM usage ledger,
operational state beside `jobs`: not an event, read by no projection. One row per DM model
attempt, inserted as the attempt ends and never updated. Identity `bigint` `id` (the paging
cursor, read in number mode), `job_id` uuid FK to `jobs.id` `ON DELETE CASCADE`, `session_id`
(no FK), `job_kind`, `job_attempt`, `purpose`, `prompt_version`, `call_attempt`, `outcome`,
`error_kind`, then nullable `provider`, `model`, `input_tokens`, `output_tokens`, `cost_usd`
(double; null when unpriced, never 0), `duration_ms`, `http_attempts`, and `created_at`. It has
no prompt or completion column. Checks: `dm_model_calls_job_kind_valid` (`turn`, `companion`,
`chronicle`), `dm_model_calls_call_attempt_valid` (1 or 2), `dm_model_calls_outcome_valid`
(`ok`, `invalid-json`, `error`, `aborted`). Indexes: `dm_model_calls_session_idx`
`(session_id, id)` and `dm_model_calls_job_idx` `(job_id)`. Who writes and reads it:
[[dm-turn-jobs]] and [[debug-view]].

## Connections

Consumed by [[event-log]] (`events`), [[session-auth]] (`users`, `auth_sessions`),
[[invitations]] (`invitations`), [[ingestion]] and [[dm-turn-jobs]] (`jobs`), [[dm-turn-jobs]] and [[debug-view]] (`dm_model_calls`). Generated and applied per
[[migrations]]. `events`' append-only trigger is the first instance of a pattern
[[library-schema]] repeats for its own three tables (a different trigger function,
`library_immutable`, refusing `UPDATE` only — library rows are deletable, `events` rows are
not); `jobs` deliberately breaks that pattern, since its whole point is in-place updates.

## Operational notes

The append-only trigger means any attempt to correct or purge event-log data — including by
an operator with direct database access — must go through a new compensating event, not a
mutation of history. There is no soft-delete or archival path for `events` at this commit.
