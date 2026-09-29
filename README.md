# the-stacks

## Quickstart

Requires Docker with Compose. Nothing else — no Node, no pnpm, no Postgres on the host.

```sh
git clone <repo> && cd the-stacks
cp .env.example .env          # then edit: set a real POSTGRES_PASSWORD
docker compose up -d
```

Check progress with `docker compose ps` — both services reach `healthy` within a couple
of minutes on a cold start (image build included).

See `.env.example` for every variable the stack reads.

## Stopping the stack

```sh
docker compose down
```

Stops and removes the containers. Your database data is untouched — it lives in a named
volume and survives this, an image rebuild, and any ordinary restart.

**`docker compose down -v` is different and DESTROYS your data.** The `-v` flag also
removes the named volume, permanently deleting everything in the database. Only use it
when you mean to wipe the database (e.g. starting over from scratch).

## Checks

Every pull request and push to `main` runs `pnpm ci:check`. Reproduce it locally with the
same throwaway test database CI uses (spec 020):

```sh
TEST_DB_PORT=5432 docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgres://stacks:stacks@localhost:5432/stacks
export TEST_DATABASE_URL=$DATABASE_URL REQUIRE_DATABASE=1
pnpm install --frozen-lockfile
pnpm --filter @the-stacks/server db:migrate
pnpm ci:check
docker compose -f docker-compose.test.yml down -v
```

Expect exit 0. Confirm the test summary reports 0 skipped tests.

To add a suite: define a script, then append `&& pnpm <script>` to `ci:check`.
