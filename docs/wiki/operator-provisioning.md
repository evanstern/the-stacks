---
name: operator-provisioning
description: The first account — OPERATOR_USERNAME/OPERATOR_PASSWORD, the check-before-prompt ordering that keeps non-interactive runs from hanging, and why the CLI script inlines create-then-check logic instead of importing auth/provisioning.ts's createOperator.
kind: component
sources:
  - apps/server/scripts/create-operator.ts
  - apps/server/src/auth/provisioning.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Operator Provisioning

The first account on a fresh install is created by `pnpm auth:create-operator`
(`apps/server/scripts/create-operator.ts`), the documented, no-default-credential path —
there is no seeded operator account and no default password anywhere in this codebase.

## How it works

The script reads `OPERATOR_USERNAME` (default `"operator"`) and the password from
`OPERATOR_PASSWORD` if set, otherwise an interactive `readline` prompt
(`readPassword()`). **It checks for an existing operator before doing either of those**: it
queries `users` for any row with `role = 'operator'` first, and only reads/prompts for a
password if none exists. This ordering is deliberate and load-bearing, not incidental —
prompting first would make an operator type a secret that is then thrown away, and worse, a
**non-interactive** run (CI, a provisioning script, `docker compose run`) would **hang**
waiting on a prompt for input that will never arrive, instead of failing fast with a clear
message. If an operator already exists, the script refuses immediately (exit code 1, no
prompt, no changes) rather than creating a second one or overwriting the first — provisioning
is meant to run exactly once per install.

**The script does not import `auth/provisioning.ts`'s `createOperator`** — it inlines the
identical check-then-insert logic itself. This is a deliberate, documented constraint, not an
oversight: `create-operator.ts` runs via `node --experimental-strip-types` (raw TypeScript
execution, no `tsc` build step — see [[migrations]] for the identical pattern in
`scripts/migrate.ts`), and `provisioning.ts` imports its schema module the way every other
`src/` file does, with a `.js`-suffixed specifier (`../schema/auth.js`) that resolves under the
project's bundler-driven build but not under raw execution one level deeper than
`migrate.ts`'s own `.js`-import constraint already covers. `auth/provisioning.ts`'s exported
`createOperator(db, input)` — same check, same refusal, same `hashPassword` call — is used
instead by the test suite, which does go through the normal build/import graph. Both paths
resolve `DATABASE_URL`/`TEST_DATABASE_URL` on the host the same way [[migrations]] describes,
since `create-operator.ts` also runs on the host, not in the container.

Once no operator is found, the script hashes the password (`hashPassword`, see
[[password-hashing]]) and inserts a `users` row with `role: "operator"`,
`displayName: username` (no separate display name is collected).

## Connections

Depends on [[password-hashing]] and [[database-access]] (`createDb`, same host/container URL
precedence as [[migrations]]). Creates the first row in [[database-schema]]'s `users` table
that [[session-auth]] can then sign in.

## Operational notes

Env vars: `OPERATOR_USERNAME` (default `"operator"`), `OPERATOR_PASSWORD` (if unset, prompts
interactively). A run with no existing operator and an empty password (neither env var set
nor typed) throws rather than creating an account with a blank password.
