# Quickstart — 024 chat UI

Run every step from the worktree root, `.worktrees/task-0028`. The compose project is
`stacks-task-0028`. `pnpm env:up` writes `APP_PORT` into `.env`. Never print `.env`. Never
put a real password in a file or a commit.

Browser automation uses Brave, not Chrome:
`/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`.

## 1. Bring up the stack

```sh
pnpm install
pnpm env:up
set -a; . ./.env; set +a
curl -s "http://localhost:$APP_PORT/health"
```

Expect `"status":"ok"` and `"reachable":true`.

Migrate the app database from the host. Host scripts read `TEST_DATABASE_URL` first, so point
it at the app database for this command:

```sh
APP_DB_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB"
TEST_DATABASE_URL="$APP_DB_URL" pnpm --filter @the-stacks/server db:migrate
```

Ask needs the `answering` purpose, inherited from the root checkout's `.env` (spec 022).
Without it, Ask shows the `config` error as Interrupted, which is correct but not a demo.

## 2. Create the operator

Use the same override, so the account lands in the app database:

```sh
read -rs OPERATOR_PASSWORD; export OPERATOR_PASSWORD
TEST_DATABASE_URL="$APP_DB_URL" pnpm --filter @the-stacks/server auth:create-operator
```

Expect `Operator account created: operator`. `OPERATOR_USERNAME` overrides the name.

## 3. Invite and redeem a player

```sh
PORT=$APP_PORT
curl -s -c /tmp/op.cookies -X POST "localhost:$PORT/auth/sign-in" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"operator\",\"password\":\"$OPERATOR_PASSWORD\"}"
curl -s -b /tmp/op.cookies -X POST "localhost:$PORT/auth/invitations" \
  -H 'content-type: application/json' -d '{}'
```

Copy the `token`. It is shown once.

```sh
read -rs PLAYER_PASSWORD; export PLAYER_PASSWORD
curl -s -X POST "localhost:$PORT/auth/invitations/redeem" \
  -H 'content-type: application/json' \
  -d "{\"token\":\"<paste>\",\"username\":\"player\",\"displayName\":\"Player\",\"password\":\"$PLAYER_PASSWORD\"}"
```

Expect `{"user":{…,"role":"player"}}`.

## 4. Upload the SRD fixture as "Basic Rules"

1. Open `http://localhost:$APP_PORT/` in Brave. Sign in as `operator`.
2. Expect a redirect to `/ask` and "Import a book to start asking." with a link to Library.
3. Open Library (`/books`). Expect "Your library is empty. Upload your first book to start
   asking questions."
4. Choose `apps/server/bench/retrieval/corpus/combat.md`. Expect the Book title to read
   `combat`.
5. Set the Book title to `Basic Rules`. Press Upload.
6. Expect an upload card with the file name, size, and a progress bar.
7. Expect Recent imports to show "Basic Rules" moving through the stepper, updating without a
   reload, until the pill reads Ready (or Search-only when no `embed` purpose is set).

The same upload without the UI, for an agent:

```sh
curl -s -b /tmp/op.cookies -F 'book=Basic Rules' \
  -F 'file=@apps/server/bench/retrieval/corpus/combat.md' \
  "localhost:$PORT/library/uploads"
```

## 5. Ask "How does grappling work?"

1. Open Ask. Type `How does grappling work?`. Press Ask.
2. Expect text to arrive progressively and a "Stop generating" pill while it streams.
3. Expect citation markers such as `[1]` inline, and no error at the end.
4. Click `[1]`. Expect the source pane to show "Basic Rules", a section path such as
   "Combat › …", and the quoted words inside a highlight.
5. Press Sources. Expect a panel sliding in from the right, listing "Basic Rules · Ready".
   Press Escape. Expect focus back on the Sources button.
6. Resize the window to 390px wide. Expect the bottom tab bar and a Chat | Source control.
   Click a citation. Expect the Source view. Press "Back to answer".

## 6. AC #4: the piloted two-browser run

Two Brave profiles give two cookie jars.

```sh
BRAVE="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
TABLE=$(uuidgen | tr 'A-Z' 'a-z')
"$BRAVE" --user-data-dir=/tmp/brave-op --new-window "http://localhost:$APP_PORT/" &
"$BRAVE" --user-data-dir=/tmp/brave-pl --new-window "http://localhost:$APP_PORT/" &
echo "$TABLE"
```

Follow these steps and check each result by eye.

1. Window A: sign in as `operator`. Expect Ask, with Ask, Library, Table, and Settings in the
   sidebar.
2. Window B: sign in as `player`. Expect the Table landing, with only Table in the sidebar.
3. Window B: paste the table id into "Join a table". Press Join.
4. Window A: open Table. Paste the same id. Press Join.
5. Window A: send `hello from the operator`. Expect it once in each window.
6. Window B: send `hello from the player`. Expect it once in each window.
7. Window A: open Library. Upload `apps/server/bench/retrieval/corpus/conditions.md` as
   `Conditions`. Expect the pill to reach Ready or Search-only.
8. Window A: open Ask. Ask `How does grappling work?`. Open a citation.
9. Window B: expect the Table unchanged, with no book text.
10. Window B: open `http://localhost:$APP_PORT/ask`. Expect "Asking the library is available
    to the operator only."
11. Window B: open `http://localhost:$APP_PORT/books`. Expect "The library is available to
    the operator only."
12. Window A: return to Table. Expect the history intact.

Record the steps and results in the PR body. Record no password.

### The recording

The script drives the same run in Brave with two contexts, and records each as webm.

```sh
APP_PORT=$APP_PORT OPERATOR_PASSWORD="$OPERATOR_PASSWORD" PLAYER_PASSWORD="$PLAYER_PASSWORD" \
  node specs/024-chat-ui/evidence/record-ac4.mjs
ls -la specs/024-chat-ui/evidence/
cat specs/024-chat-ui/evidence/ac4-player-requests.txt
```

Expect `ac4-operator.webm` and `ac4-player.webm`, each under 8 MB, and a `/library` request
count of 0 for the player. `PLAYWRIGHT_DIR` overrides the out-of-tree `playwright-core`
location (default `/Users/evanstern/.claude/jobs/a48ac8bd/tmp`).

## 7. Dev loop

`pnpm dev` serves on `APP_PORT` against the test database, with hot reload (spec 025 D7).

```sh
docker compose -p stacks-task-0028 stop app
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @the-stacks/server db:migrate
DATABASE_URL="$TEST_DATABASE_URL" pnpm dev
```

The test database has no accounts. Create the operator there too:
`pnpm --filter @the-stacks/server auth:create-operator` (it reads `TEST_DATABASE_URL`).

Edit a string in `apps/web/app/routes/books.tsx`. Expect the page to update without a reload.
Stop with Ctrl-C. Run `docker compose -p stacks-task-0028 start app` to return to the
container.

## 8. Tear down

```sh
pnpm env:down
pnpm env:prune --check
```

Expect exit 0 from the prune check.
