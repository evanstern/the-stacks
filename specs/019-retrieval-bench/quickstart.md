# Quickstart: Retrieval benchmark

## 1. Per-commit case (no key, no network)

```sh
pnpm env:up                         # this worktree's stack; writes TEST_DATABASE_URL to .env
pnpm --filter @the-stacks/server db:migrate
REQUIRE_DATABASE=1 pnpm test        # includes test/bench/retrieval.integration.test.ts
```

Expect the bench case to pass and print its 10-row table.

## 2. Run the CI matrix by hand and save a result

```sh
pnpm bench:retrieval run --matrix matrices/ci.json
pnpm bench:retrieval report
```

A new file appears in `apps/server/bench/retrieval/results/`. Commit it if the run is worth
keeping.

## 3. Update the baseline (after a deliberate corpus, question, or matrix change)

```sh
pnpm bench:retrieval run --matrix matrices/ci.json --write-baseline --no-save
```

Commit `baseline.json` with the change that moved it, and say why in the commit message.

## 4. Full matrix against real providers (on demand, OPERATOR CHECKPOINT)

1. Copy `matrices/full.example.json` to a scratch matrix naming the operator's embed purposes.
2. Set `AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES`, and the key variables in `.env` (operator).
3. Run `pnpm bench:retrieval run --matrix <scratch> --dry-run` and hand the estimate to the
   operator. Stop until the operator signs off.
4. Run `pnpm bench:retrieval run --matrix <scratch> --allow-paid`.
5. Commit the results file. Never commit the scratch matrix if it names anything private.

## 5. Clean up

```sh
pnpm env:down
pnpm env:prune --check              # must exit 0
```
