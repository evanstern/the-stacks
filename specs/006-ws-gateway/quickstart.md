# Quickstart — validating the WebSocket gateway

Commands run from the repository root.

## Prerequisites

- The compose stack, migrated (spec 004 quickstart steps 1–2, and note `db:migrate` prefers
  `TEST_DATABASE_URL` because it runs on the host).
- `TEST_DATABASE_URL` exported, or the integration suites skip and prove nothing.
- An operator account (`pnpm --filter @the-stacks/server auth:create-operator`) and a player
  invited through it — the two-browser check needs two distinct people.

## 1. Run the test suite

```bash
pnpm test
```

**Expected**: append-on-message, fan-out to multiple subscribers, replay from a cursor,
refusal of unauthenticated connections, and refusal of malformed messages (FR-015).

**Read the output.** A skipped integration suite is a green run that proved nothing.

## 2. The replay/live boundary — the check that matters

This is the case research D1 exists for, and the one a naive implementation fails while
passing every quiet test.

Subscribe a client from a cursor **while another client is actively sending**. Then compare
what the subscriber received against the log.

**Expected**: the subscriber's received positions are ascending, contain no duplicate, and
contain **no gap** between the replayed range and the live range. An event appended during
the replay must arrive exactly once — not dropped (subscribe-after-replay) and not delivered
out of order (subscribe-before-replay).

Verify against the log directly:

```sql
SELECT seq FROM events WHERE session_id = '<session>' ORDER BY seq;
```

Every position in that list at or after the cursor must appear exactly once in what the
subscriber received.

## 3. Authority — a client cannot forge history

Send a `send` frame carrying an `actor` that is not you, a `seq`, and a `ts`:

**Expected**: the recorded event carries **your** authenticated identity, a server-assigned
position, and a server clock (FR-005, FR-006). If any of the three came from the client, a
client can forge history and the log is not a record of what happened.

Then send malformed JSON and an unknown `type`:

**Expected**: an `error` frame, the connection stays open, and **nothing is appended** —
confirm with a log read that no gap and no stray event appeared (FR-003, US2 scenario 4).

## 4. Unauthenticated connections never open

Connect without a session cookie:

**Expected**: the upgrade is refused with `401`. Not "connects then closes" — the socket must
never open (research D4). A socket that opens is a socket that consumed a slot and could be
held indefinitely.

## 5. One dead subscriber does not break the others

With three subscribers, kill one abruptly (not a clean close) and send a message.

**Expected**: the remaining two both receive it (FR-012, SC-007). A `Promise.all` over sends
would fail the whole broadcast on the dead socket — the append has already committed, so the
log and every other client would silently diverge.

## 6. The M0 demo — two browsers

```bash
docker compose up
```

Sign in as two different people in two browsers, both subscribed to the same session. Send
from one.

**Expected**: it appears in the other. Reload either browser: prior events replay rather than
showing an empty view.

**This is SC-008 and half the M0 milestone. Verify it by running it**, not by trusting the
tests — that is the lesson the T016 finding paid for.
