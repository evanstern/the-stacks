# Quickstart — 020 test compose stack

Run from a task worktree.

```sh
pnpm env:up                                   # test stack + app stack
pnpm --filter @the-stacks/server db:migrate   # migrates the TEST database (TEST_DATABASE_URL)
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test
pnpm env:down                                 # removes both stacks
```

To migrate the APP stack's database from the host, override `TEST_DATABASE_URL` for one
command (Node's `--env-file-if-exists` never overrides a set variable):

```sh
set -a; . ./.env; set +a
TEST_DATABASE_URL=postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB \
  pnpm --filter @the-stacks/server db:migrate
```

## Worktree already up before this change

Run `pnpm env:down && pnpm env:up`. The next `env:up` refuses while the old app port is
bound, and it rewrites `TEST_DATABASE_URL`.

## Reproduce CI

```sh
TEST_DB_PORT=5432 docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgres://stacks:stacks@localhost:5432/stacks
export TEST_DATABASE_URL=$DATABASE_URL REQUIRE_DATABASE=1
pnpm --filter @the-stacks/server db:migrate
pnpm ci:check
docker compose -f docker-compose.test.yml down -v
```

## AC #5 proof (20 runs, app stack up)

The app stack's database must be migrated, or its worker has no `jobs` table to poll and
the proof proves nothing.

```sh
pnpm env:up
# migrate both databases (above), then:
docker compose -p stacks-$(basename "$PWD") ps app   # expect: healthy
for i in $(seq 1 20); do
  REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/library/worker.integration.test.ts \
    || { echo "FAIL run $i"; break; }
done
```
