# Research — 023 create-operator in the runtime image

Decisions made against the code at `1ff15c8`.

## R1 — Entry point: move it to `apps/server/src/cli/create-operator.ts`

- **Decision**: move the script into `src/cli/`. tsc compiles it to
  `dist/cli/create-operator.js`, and the Dockerfile's existing
  `COPY --from=build /app/apps/server/dist apps/server/dist` ships it. The Dockerfile does
  not change. Delete `apps/server/scripts/create-operator.ts`.
- **Why**: `dist` is the only server output the runtime stage copies. A file under `src`
  reaches it with zero build or image changes. `src/bench/retrieval/cli.ts` is the
  precedent: a CLI that lives in `src` and runs from `dist`.
- **Imports**: as a `src` file it uses `.js`-suffixed imports, like every other `src` file.
  That removes the reason the script inlined `createOperator`'s logic (the strip-types
  constraint the `operator-provisioning` wiki note explains). The CLI now imports from
  `auth/provisioning.js`.
- **Alternatives rejected**:
  - *A second tsconfig include (`scripts`)*: `rootDir` is `src`. Widening it moves every
    output path (`dist/src/index.js`), which breaks `CMD`, `static.ts`'s module-relative
    root, and the bench CLI. A second tsconfig project adds a build graph node for one file.
  - *Copy `scripts/` plus strip-types into the runtime image*: ships source into the runtime
    stage (the `container-image` note: no source) and needs Node's experimental flag in
    production.
  - *Reuse the dev-only `migrate` service (build-stage image) with
    `run --rm migrate node --experimental-strip-types scripts/create-operator.ts`*: works on
    `dev` with no code change. Rejected: card AC #1 names the runtime image, and a
    self-hoster's base `docker-compose.yml` has no build-stage service. `exec app` works on
    every install.

## R2 — Keep refuse-before-prompt; reuse `createOperator` for the write

- **Decision**: export `hasOperator(db)` from `auth/provisioning.ts`. `createOperator` calls
  it for its own check. The CLI calls `hasOperator` first and refuses before prompting. Then
  it reads the password and calls `createOperator`. A `{created: false}` result (a race) is
  treated as the same refusal.
- **Why**: `createOperator` checks and inserts in one call, after the password is known.
  Calling it alone would prompt before the check, which the wiki calls load-bearing (a
  non-interactive run would hang). One shared query keeps the two checks identical.
- **Preserved as-is**: `OPERATOR_USERNAME` (default `operator`), `OPERATOR_PASSWORD`
  override, the empty-password error, the refusal message, exit codes,
  `TEST_DATABASE_URL || DATABASE_URL`, and `db.$client.end()` in `finally`.

## R3 — Host command: compile, then run from `dist`

- **Decision**: `"auth:create-operator": "tsc -b && node --env-file-if-exists=../../.env
  dist/cli/create-operator.js"`.
- **Why**: identical in shape to the existing `bench:retrieval` script. The command name,
  `.env` loading, and URL precedence do not change. `tsc -b` is incremental, so a built tree
  pays almost nothing.

## R4 — `check:host-scripts`: trim to what still runs under strip-types

- **Decision**: drop `auth/password.ts` and `schema/auth.ts` from `check:host-scripts`. Keep
  `config.ts` and `db.ts`, which `scripts/migrate.ts` still imports under
  `node --experimental-strip-types`.
- **Why**: those two imports existed only for `create-operator.ts`. After the move, nothing
  loads them under strip-types, so the check guards nothing. `migrate.ts`'s guard stays.
  Update the `config.ts` header comment, which names `scripts/create-operator.ts`.
- **Risk if kept instead**: none, just dead coverage. Flagged in the PR body as an operator
  checkpoint.

## R5 — `dev` invocation: `docker compose … exec app`, interactive

- **Decision**: run this from the vm-104 checkout, as `stacks`:

  ```sh
  docker compose -p stacks-dev -f docker-compose.yml -f deploy/dev/compose.dev.yml \
    --env-file /home/stacks/dev/.env exec app node dist/cli/create-operator.js
  ```

- **Why**:
  - `exec` into the running `app` container inherits its env: `DATABASE_URL` at `@db:5432`
    and `TEST_DATABASE_URL` blanked. No env plumbing, no new compose service.
  - `compose exec` allocates a TTY by default, so the prompt is interactive with no `-it`.
  - The password is typed at the prompt. It is never on the command line or in shell history.
  - The file flags match the runbook's existing "Inspect" command, so the operator uses one
    shape throughout.
  - `WORKDIR` is `/app/apps/server`, so `dist/cli/create-operator.js` resolves.
- **Probe needed**: the command leaves `STACKS_COMMIT` unset, so `app`'s `image:` resolves
  to `stacks-dev-app:` with a warning. The runbook's `ps` has the same shape. quickstart.md
  step 5 proves this exact shape against a local stack before the runbook claims it.
- **Non-interactive (agents, CI)**: `exec -T -e OPERATOR_PASSWORD app …`. The bare
  `-e NAME` passes the value from the caller's environment, so it is not on the command line.
- **Alternatives rejected**:
  - *`docker exec -it stacks-dev-app-1 …`*: shorter, but it hard-codes compose's container
    naming, and it departs from the runbook's compose shape.
  - *A one-shot `create-operator` compose service*: more YAML, and `dev`-only. `exec` needs
    no new service.

## R6 — Proof is local; the real `dev` run is the operator's

- **Decision**: quickstart.md proves the in-image command on a local `pnpm env:up` stack:
  non-interactive create, sign-in, refuse on the second run, and the exact `dev` compose
  shape. The operator runs the real `dev` command personally after merge and deploy.
- **Why**: vm-104 commands need operator consent (card AC #3).
