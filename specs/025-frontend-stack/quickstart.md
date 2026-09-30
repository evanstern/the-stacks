# Quickstart — 025 frontend stack migration

Run every step from the worktree root, `.worktrees/task-0040`. This worktree's compose
project is `stacks-task-0040`. `pnpm env:up` writes `APP_PORT=3040` into `.env`. Never print
`.env`.

Browser automation uses Brave, not Chrome:
`/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`.

## 1. Build

```sh
pnpm install
pnpm build
```

Expect `apps/web/build/client/` and `apps/web/build/server/index.js` to exist.

## 2. Dev mode (hot reload)

`pnpm dev` runs the Hono server with Vite in middleware mode (research R8). It serves on
`APP_PORT` against the stack's test database. HMR uses `WEB_HMR_PORT` (default 24678).

Start the stack's database, stop the app container to free the port, and migrate:

```sh
pnpm env:up
set -a; . ./.env; set +a
docker compose -p stacks-task-0040 stop app
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @the-stacks/server db:migrate
DATABASE_URL="$TEST_DATABASE_URL" pnpm dev
```

Record this check in `ci-evidence.txt`:

1. Open `http://localhost:$APP_PORT/` in Brave. Sign in. Edit a visible string in
   `apps/web/app/routes/home.tsx`. Expect the page to update without a reload.
2. Run `curl -s -b "session=<token>" "http://localhost:$APP_PORT/" | grep -c '<display
   name>'`. Expect 1 or more. Record no token.
3. Run `curl -s -o /dev/null -w '%{http_code} %{content_type}\n'` against `/health`,
   `/auth/me`, and `/library/nope`. Expect JSON for each, never `text/html`.
4. Run step 4's items 3–7 against the dev server. Expect the echo over `/ws`.
5. Run `grep -nE 'from "vite"|import\("vite"\)' apps/server/dist/index.js`. Expect zero
   hits.

Stop with Ctrl-C. Run `docker compose -p stacks-task-0040 start app` to return to the
container.

## 3. Build and run the image

`pnpm env:up` builds the image from this branch (`up --build`) and starts it on `APP_PORT`.

```sh
pnpm env:up
set -a; . ./.env; set +a
curl -s "http://localhost:$APP_PORT/health"
```

Expect `"status":"ok"` and `"reachable":true`.

Migrate the app database from the host:

```sh
TEST_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB" \
  pnpm --filter @the-stacks/server db:migrate
```

Confirm SSR, signed out:

```sh
curl -s "http://localhost:$APP_PORT/" | grep -c 'Sign in'
```

Expect a count of 1 or more. The HTML holds the form before any script runs.

Confirm a reserved path never returns page HTML:

```sh
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://localhost:$APP_PORT/library/nope"
```

Expect `404 application/json`.

## 4. M0 demo on the per-worktree stack

Use the image from step 3. The full procedure is `specs/007-spa-shell-demo/quickstart.md`
§4–§6. Replace port 3000 with `$APP_PORT`.

1. Create the operator:

   ```sh
   export OPERATOR_PASSWORD='local proof password'
   docker compose -p stacks-task-0040 exec -T -e OPERATOR_PASSWORD app node dist/cli/create-operator.js
   ```

2. Create the second account. Sign in as the operator with `curl`, create an invitation,
   and redeem it as `player` (007 quickstart §4).
3. Generate a session id: `uuidgen | tr 'A-Z' 'a-z'`.
4. Open Brave with two separate profiles, so the cookie jars differ:

   ```sh
   BRAVE="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
   "$BRAVE" --user-data-dir=/tmp/brave-a --new-window "http://localhost:$APP_PORT/play/<uuid>" &
   "$BRAVE" --user-data-dir=/tmp/brave-b --new-window "http://localhost:$APP_PORT/play/<uuid>" &
   ```

5. Sign in as `operator` in one window and `player` in the other.
6. Send a message from one window. Expect it once in each window.
7. Send a reply from the other window. Expect it once in each window.
8. Reload either window. Expect the history to replay.
9. Sign out in one window. Expect the sign-in form.

Record the steps and their results in the PR body. Record no password.

## 5. M0 demo against the container image, standalone

This proves the image runs outside `env:up`'s build path.

1. Build and tag the image:

   ```sh
   docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) -t stacks-web-check:task-0040 .
   ```

2. Run it on the stack's network, against the stack's database:

   ```sh
   docker run --rm -d --name stacks-web-check \
     --network stacks-task-0040_default --env-file .env \
     -e TEST_DATABASE_URL= -e APP_PORT=3999 -p 3999:3999 \
     stacks-web-check:task-0040
   ```

3. Confirm `curl -s localhost:3999/health` shows `"reachable":true`.
4. Repeat step 4's items 3–9 against `http://localhost:3999`. Reuse the accounts from step 4.
5. Confirm the image holds no build tooling:

   ```sh
   docker exec stacks-web-check sh -c 'ls /app/apps/web/node_modules/.bin 2>/dev/null; ls /app/apps/web'
   ```

   Expect no `vite`, `react-router`, or `tailwindcss` binary. Expect `build` and
   `package.json`, and no `app` source directory.
   Also run `docker exec stacks-web-check sh -c 'ls /app/node_modules/.pnpm | grep -c "^vite@"'`.
   Expect `0`.

6. Stop it: `docker stop stacks-web-check`.

Record the image id, the commit, and the results in the PR body.

## 6. Checks

```sh
set -a; . ./.env; set +a
REQUIRE_DATABASE=1 pnpm ci:check
```

Expect exit 0 and zero skipped database suites.

## 7. Tear down

```sh
pnpm env:down
pnpm env:prune --check
rm -rf /tmp/brave-a /tmp/brave-b
```

Expect exit 0 from both `pnpm` commands.
