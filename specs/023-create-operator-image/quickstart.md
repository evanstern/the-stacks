# Quickstart — 023 create-operator in the runtime image

Run every step from the worktree root. `P` is this worktree's compose project,
`stacks-task-0036`.

## 1. Build the image and start the stack

```sh
pnpm env:up
```

`env:up` builds the image from this branch (`up --build`).

## 2. Confirm the entry point is in the image

```sh
docker compose -p stacks-task-0036 exec -T app ls dist/cli/create-operator.js
```

Expect the path printed. Expect no `scripts/` directory under `/app/apps/server`.

## 3. Migrate the app database

The runtime image holds no `drizzle/` folder. Migrate from the host. Source `.env` without
printing it.

```sh
set -a; . ./.env; set +a
TEST_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB" \
  pnpm --filter @the-stacks/server db:migrate
```

## 4. Create the operator, non-interactively

```sh
export OPERATOR_PASSWORD='local proof password'
docker compose -p stacks-task-0036 exec -T -e OPERATOR_PASSWORD app node dist/cli/create-operator.js
```

Expect `Operator account created: operator` and exit 0.

Sign in:

```sh
curl -s -X POST "http://localhost:$APP_PORT/auth/sign-in" \
  -H 'content-type: application/json' \
  -d '{"username":"operator","password":"local proof password"}'
```

Expect a body with `"role":"operator"`.

## 5. Refuse on the second run, in the exact `dev` shape

Unset the password, so a prompt would hang. Use the runbook's compose flags, with
`STACKS_COMMIT` unset, as on vm-104.

```sh
unset OPERATOR_PASSWORD
DEV_ENV_FILE="$PWD/.env" docker compose -p stacks-task-0036 \
  -f docker-compose.yml -f deploy/dev/compose.dev.yml --env-file .env \
  exec -T app node dist/cli/create-operator.js; echo "exit=$?"
```

Expect the refusal message, `exit=1`, and no prompt. A hang fails the proof. The run also
proves `compose exec` resolves `app` with `STACKS_COMMIT` unset (research R5).

## 6. Host command still works

```sh
TEST_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/$POSTGRES_DB" \
  pnpm --filter @the-stacks/server auth:create-operator; echo "exit=$?"
```

Expect the refusal and `exit=1`: the operator from step 4 exists.

## 7. Tear down

```sh
pnpm env:down
pnpm env:prune --check
```

Expect exit 0 from both.

## After merge (operator steps, not this PR)

1. The operator waits for the deploy of the merge commit to `dev`.
2. The operator runs the runbook's "Create the first operator" command on vm-104.
3. The operator runs TASK-0030 T026 (the dev load run). Its results file lands under
   TASK-0030.
