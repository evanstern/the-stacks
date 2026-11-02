---
name: m0-demo
description: The M0 milestone check itself — two browsers with separate cookie jars, signed in as different accounts, exchanging a message through the event log, with reload replaying history; the session id is a hand-generated UUID and there is no session registry by design. Since the React Router migration (TASK-0040), the per-PR procedure also runs against a standalone built container image, and browser automation is pinned to Brave.
kind: pipeline
sources:
  - specs/007-spa-shell-demo/quickstart.md
  - specs/007-spa-shell-demo/spec.md
  - specs/025-frontend-stack/quickstart.md
  - apps/web/app/routes/play.tsx
verified_against: 095b85f615387975ce3ae59a3c95aa46ca903b10
---

# M0 demo

The procedure in `specs/007-spa-shell-demo/quickstart.md` is TASK-0016's AC#7 and, per that
spec's header, *is* the M0 milestone from `docs/design/milestones.md`: "two browsers sign in;
a message from one appears in the other via the event log." Every note under Realtime and
Client exists to make this procedure work. `specs/025-frontend-stack/quickstart.md` §4–§5
runs the same procedure against the React Router app (TASK-0040): §4 against a per-worktree
compose stack (port `$APP_PORT`, not the fixed `3000` the 007 quickstart assumes), and §5
against a standalone `docker build`+`docker run` of the image, proving the demo works outside
`env:up`'s own build path too. Both variants are recorded per-PR (runbook amendment: "two demo
runs", card AC #7).

## How it works

**Setup** is `docker compose up` from a clean clone (see [[compose-stack]]), then migrating
the database and creating two accounts: the operator, via the `auth:create-operator` script
(see [[operator-provisioning]]), and a second person via an invitation the operator creates
and that person redeems (see [[invitations]]). There is no self-serve signup by design — this
two-account step is unavoidable, not a shortcut worth skipping.

**The two browsers must not share a cookie jar.** The session cookie is `HttpOnly`
([[session-auth]]); two tabs in one browser profile are one identity and would prove nothing.
The quickstart calls for two different browsers, or a browser plus a private window, or two
separate profiles — since TASK-0040 the per-PR gates pin browser automation to Brave, run as
two `--user-data-dir` profiles (or two isolated `playwright-core` persistent contexts) rather
than Chrome.

**The session id is a hand-generated UUID, opened directly.** There is no session-creation or
session-listing affordance anywhere in the stack — [[ws-protocol]] states this is deliberate
("No play-session creation or listing... a client subscribes to an identifier it already
knows"), and `routes.ts`'s `play/:sessionId` route, resolved in `play.tsx`'s `clientLoader`
(`{ sessionId: params.sessionId }`, see [[react-router-app]]), carries the same D6 intent the
pre-migration `router.tsx` comment stated: the session id rides the URL — no registry exists
to look it up through, so both browsers reach one session by opening the same link. The id
must be a **valid UUID**, because `session_id` is a `uuid` column in the event log (see
[[database-schema]]) — the quickstart has the operator run `uuidgen | tr 'A-Z' 'a-z'` and both
browsers open `http://localhost:$APP_PORT/play/<that-uuid>`, one signed in as `operator`, the
other as the invited account.

**The check itself:** (TASK-0047 replaced `play.tsx`'s echo page - an event list and a bare
send box that sent `chat` events - with the table in [[play-route]]; the message is now a
`talk` request typed in the composer and rendered in the transcript. The quickstart's wording
predates this.) Type a message in one browser; it appears in the other, and also in the
sender's own view exactly once — because [[client-session-hook]] renders on the arriving
`event` frame, never optimistically, so the sender sees their own message the same way
everyone else does. Send one back. Then **reload either browser** — the prior messages replay
from the log (see [[replay-live-boundary]]) rather than showing an empty view, because
[[client-session-hook]] resubscribes with `afterSeq` set to the highest `seq` it had already
been delivered.

## Connections

Exercises the full realtime path end to end: [[websocket-gateway]] → [[event-log]] →
[[replay-live-boundary]] / [[subscriber-registry]] → [[client-session-hook]] →
[[react-router-app]]'s `play/:sessionId` route (rendered by [[play-route]]). The automated counterpart is [[test-suite]]'s integration
files, which [[ci-pipeline]] runs against a real database on every PR and push to main;
this manual procedure remains the check that the demo works in real browsers, which no
automated suite covers.

## Operational notes

Common first-run failures per the quickstart's own troubleshooting table: `DATABASE_URL` vs
`TEST_DATABASE_URL` confusion (see [[configuration]]), a taken `DB_PORT`/`APP_PORT`, and both
browsers accidentally sharing one cookie jar (looks like "both browsers show the same
person").
