---
name: database-schema
description: The session- and auth-plane tables and their constraints — events (composite PK, positive-seq/positive-version CHECKs, no extra index), users/auth_sessions/invitations — and the append-only trigger hand-added to the generated migration, which really does make Postgres refuse a DELETE. Library-plane tables are [[library-schema]].
kind: component
sources:
  - apps/server/src/schema/events.ts
  - apps/server/src/schema/auth.ts
  - apps/server/drizzle/0000_mushy_thor_girl.sql
verified_against: 83ebc51d97b55808bd9a3843de33b1fb8be35efd
---

# Database Schema

This note covers the session and auth planes. Four tables across two Drizzle schema files:
`events` (`apps/server/src/schema/events.ts`, the session plane) and `users` / `auth_sessions`
/ `invitations` (`apps/server/src/schema/auth.ts`). The library plane's three tables
(`library_documents`/`library_chunks`/`library_embeddings`, TASK-0022) are documented
separately in [[library-schema]] — same repo, same pattern for its own immutability trigger,
different concept.

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

## Connections

Consumed by [[event-log]] (`events`), [[session-auth]] (`users`, `auth_sessions`), and
[[invitations]] (`invitations`). Generated and applied per [[migrations]]. `events`'
append-only trigger is the first instance of a pattern [[library-schema]] repeats for its own
three tables (a different trigger function, `library_immutable`, refusing `UPDATE` only —
library rows are deletable, `events` rows are not).

## Operational notes

The append-only trigger means any attempt to correct or purge event-log data — including by
an operator with direct database access — must go through a new compensating event, not a
mutation of history. There is no soft-delete or archival path for `events` at this commit.
