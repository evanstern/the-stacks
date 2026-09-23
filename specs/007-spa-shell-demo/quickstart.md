# Quickstart — running the M0 demo

**What this proves:** two people, signed in as different accounts in two browsers, exchange a
message through the Postgres event log; reloading either browser replays the history. That is
the M0 milestone (`docs/design/milestones.md`), and TASK-0016's AC#7.

Every step below runs from a clean clone. Nothing here needs a dev server — the SPA is served
by the app container (Principle IX).

## 1. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env`:

- Set `POSTGRES_PASSWORD` to any value and make `DATABASE_URL`'s password match.
- **Uncomment `TEST_DATABASE_URL`** and make its password match too.
- **Pick a free `DB_PORT`.** The default `5432` is often already taken. Any free port works;
  `TEST_DATABASE_URL` must point at the same one.

`DATABASE_URL` and `TEST_DATABASE_URL` differ on purpose, and mixing them up is the most
common first-run failure:

| variable | host part | who uses it |
|---|---|---|
| `DATABASE_URL` | `@db:5432` — a compose **service name** | the app **inside** the container |
| `TEST_DATABASE_URL` | `@localhost:<DB_PORT>` | anything on the **host**: tests, migrations |

`db` only resolves on the compose network, so a host process cannot use it. `localhost` inside
the container means the container itself, so compose blanks `TEST_DATABASE_URL` there
deliberately.

`.env` is gitignored. Never commit it.

## 2. Start the stack

```bash
docker compose up
```

Wait for the app container to report healthy. The health check parses `/health`'s body rather
than trusting a status code, so "healthy" really does mean the database is reachable.

Check it yourself:

```bash
curl -s localhost:${APP_PORT:-3000}/health
# {"status":"ok","process":{...},"database":{"reachable":true}}
```

## 3. Apply the database migrations

From the host, in another terminal:

```bash
pnpm --filter @the-stacks/server run db:migrate
```

This one script auto-loads `.env` (via `--env-file-if-exists`) and prefers
`TEST_DATABASE_URL`, because it runs on the host.

## 4. Create the two accounts

The demo needs two **different** people. There is no self-serve signup by design — the
operator invites everyone else.

**The operator** (the first account):

```bash
OPERATOR_PASSWORD='choose-a-password' \
  pnpm --filter @the-stacks/server run auth:create-operator
```

Setting `OPERATOR_PASSWORD` keeps it non-interactive. It refuses to create a second operator
or overwrite the first, so re-running it is safe.

Override the name with `OPERATOR_USERNAME` if you like; it defaults to `operator`.

**The second person** — an invitation, redeemed. Sign in as the operator to get a cookie,
create an invitation, then redeem it:

```bash
PORT=${APP_PORT:-3000}

# Sign in as the operator, keeping the session cookie.
curl -s -c /tmp/op.cookies -X POST localhost:$PORT/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"username":"operator","password":"choose-a-password"}'

# Create an invitation. The token is returned EXACTLY ONCE — only its hash is stored.
curl -s -b /tmp/op.cookies -X POST localhost:$PORT/auth/invitations \
  -H 'content-type: application/json' -d '{}'
# {"token":"<copy-this>","expiresAt":"..."}

# Redeem it as the second person.
curl -s -X POST localhost:$PORT/auth/invitations/redeem \
  -H 'content-type: application/json' \
  -d '{"token":"<paste>","username":"player","displayName":"Player","password":"another-password"}'
```

Redeeming signs that person in immediately, so they are not dumped at a login form to retype
the password they just chose.

## 5. Open the same session in two browsers

**The two browsers must not share a cookie jar.** The session cookie is `HttpOnly`, so two
tabs in one browser profile are one identity and would demonstrate nothing. Use two different
browsers, or one browser plus a private window, or two separate browser profiles.

There is **no session registry** — spec 004 left `session_id` opaque and the WebSocket
protocol deliberately provides no session creation or listing. Both browsers simply open the
same URL, and the session id lives in it. It must be a valid UUID, because `session_id` is a
`uuid` column. Generate one:

```bash
uuidgen | tr 'A-Z' 'a-z'
```

Then in **both** browsers open:

```
http://localhost:3000/play/<that-uuid>
```

Sign in as `operator` in one and `player` in the other.

## 6. Run the demo

1. Type a message in one browser and send it.
2. **It appears in the other.** It also appears in the sender's own view — exactly once,
   because it renders when the recorded event arrives, not optimistically on submit.
3. Send one back from the other browser.
4. **Reload either browser.** The prior messages replay from the event log instead of an
   empty view.

That is M0.

## What you are actually seeing

A message is not sent to the other browser. It is **appended to the event log first, then
broadcast** (FR-004) — nothing is delivered that is not durably recorded. Both browsers are
subscribers to the same session, and the sender is just another subscriber, which is why its
own message arrives the same way everyone else's does.

On reload, the client resubscribes from the **highest `seq` it was delivered** and the server
replays what it missed, then switches to live delivery with no gap and no duplicate.

## If something goes wrong

| symptom | cause |
|---|---|
| `/health` says `"reachable": false` | `DATABASE_URL` wrong, or migrations not applied |
| port already allocated on startup | `DB_PORT` or `APP_PORT` taken — pick another |
| host command cannot resolve host `db` | used `DATABASE_URL` where `TEST_DATABASE_URL` belongs |
| both browsers show the same person | they share a cookie jar — use separate profiles |
| sign-in fails with no detail | deliberate: one message for wrong password and unknown user alike, so the account list does not leak |
| a message appears twice for the sender | a client rendering optimistically *and* on the event (FR-013) |

## Tearing down

```bash
docker compose down        # keep the data
docker compose down -v     # also delete the database volume
```
