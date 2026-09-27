# Quickstart: validate spec 009

## Local reproduction (the documented command)

    docker compose up -d db
    export DATABASE_URL=postgres://stacks:stacks@localhost:5432/stacks
    export TEST_DATABASE_URL=$DATABASE_URL REQUIRE_DATABASE=1
    pnpm install --frozen-lockfile
    pnpm --filter @the-stacks/server db:migrate
    pnpm ci:check

Expected: exit 0; the test summary shows 0 skipped. (Match the credentials to your
`.env` — the compose file reads them from there.)

## Negative checks (run once, revert each)

1. Add `import "@the-stacks/server";` to a file in `apps/web/src/` → `pnpm lint` fails.
2. Delete one fixture's rule from `biome.json` → `pnpm check:boundaries` fails.
3. Add `const x: number = "a";` to a file in `apps/server/test/` → `pnpm typecheck`
   fails.
4. Stop the db and run `pnpm test` with `REQUIRE_DATABASE=1` → fails, does not skip.

## CI

Open the PR. The `CI` workflow runs and goes green; its log shows 0 skipped tests and
the boundary proof line. Paste the run URL into the PR body.
