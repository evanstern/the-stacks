---
name: event-log
description: The append-only session event log — append and readFrom. How seq is assigned inside a pg_advisory_xact_lock (without it, 21-23 of 50 concurrent appends were lost per run; with it, 50/50 gapless), visibility default, and the bounded cursor read.
kind: component
sources:
  - apps/server/src/events/log.ts
  - apps/server/src/schema/events.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Event Log

`apps/server/src/events/log.ts` is the only writer and the only bounded reader of the
`events` table (see [[database-schema]]). Every event a client sees — live or replayed —
passed through `append` first and comes back out through `readFrom`. Play state is
event-sourced with server authority: a client never writes to the log directly, it asks
the server to append, and the server assigns position, timestamp, and actor.

## How it works

**`append(db, input)`** inserts one event at the end of a session's stream and returns it
with the position it received. `seq` and `ts` are assigned here, never by the caller —
`append` throws synchronously if the input object carries a `seq` or `ts` key at all, because
a caller that could supply `seq` could create a gap, and one that could supply `ts` could
rewrite the server's ordering authority. This is a runtime guard, not just a TypeScript one,
because a caller may hand `append` an object built from untrusted JSON.

The insert runs inside `db.transaction`, and the transaction's first statement is
`SELECT pg_advisory_xact_lock(EVENT_LOG_LOCK_NAMESPACE, hashtext(sessionId))` — the
**transaction-scoped** form, not the session-scoped `pg_advisory_lock`. The xact form
releases automatically at commit or rollback, so a pooled connection can never be handed back
to another caller while still holding a lock. `EVENT_LOG_LOCK_NAMESPACE` is a fixed constant
(`0x4556_4c47`, ASCII "EVLG") so this feature's per-session locks can never collide with an
unrelated advisory-lock user elsewhere in the process, whatever key that user picks. Because
session ids are UUIDs and `pg_advisory_xact_lock`'s two-argument form needs an integer key,
`hashtext(sessionId)` folds the id into one; a hash collision serializes two unrelated
sessions against each other, which is a performance effect, never a correctness one, since
`seq` is still computed per session.

Only after that lock is held does the insert compute
`seq = COALESCE((SELECT MAX(seq) FROM events WHERE session_id = $1), 0) + 1` for the same
session — safe against concurrent writers **only** because the lock has already serialized
every other appender to this session. The `(session_id, seq)` composite primary key (see
[[database-schema]]) stays as a correctness backstop, but the lock is what keeps it from ever
actually firing.

**This was measured, not assumed.** With the lock removed, an independent 50-concurrent-writer
probe against a real Postgres lost events every run: 28/50, 29/50, 27/50 events actually
stored — 21 to 23 of 50 appends lost per run, silently. With the lock restored, the same probe
stored 50/50, 50/50, 50/50 across three runs, positions 1..50, gapless and duplicate-free. A
separate probe confirmed the lock is per-session, not global: 25 concurrent appends to each of
two different sessions numbered 1..25 independently (both sessions' writers ran fully
concurrently — a global lock would have passed the single-session test and broken this one).
After 200+ concurrent appends, zero advisory locks remained held in `pg_locks` — confirming the
xact-scoped form actually releases at commit rather than leaking into the pooled connection.

**`readFrom(db, input)`** returns a session's events strictly after a cursor
(`afterSeq`, default `0` — the origin), ascending by `seq`, bounded by `input.limit`. It
applies no filtering by visibility, type, or payload version — that is a projection's job
downstream (see [[replay-live-boundary]] and [[subscriber-registry]]), and `readFrom` can't
filter what the log has already hidden, since it hides nothing.

`visibility` defaults to the DB column default (`"public"`) when the caller omits it —
`append` deliberately leaves the key out of the insert `values` object entirely rather than
passing `undefined`, so the schema's default applies instead of an explicit null-ish write.

## Connections

Built on [[database-access]]'s `createDb`. The table shape is [[database-schema]]. Fed by
[[websocket-gateway]] (writes) and read by [[replay-live-boundary]] (the gap-free
replay-then-live handoff) and [[subscriber-registry]] (visibility-filtered fan-out).

## Operational notes

`append` and `readFrom` throw on any underlying database error — neither catches or converts
failures; callers propagate them. There is no retry logic anywhere in this path: the advisory
lock makes the common case linear, so there is nothing to retry against.
