---
name: operator-provisioning
description: The first account — OPERATOR_USERNAME/OPERATOR_PASSWORD, the check-before-prompt ordering that keeps non-interactive runs from hanging, and hasOperator(db), the one shared existence check the CLI and createOperator both call. Ships in dist, so it runs the same way on the host and in the runtime container.
kind: component
sources:
  - apps/server/src/cli/create-operator.ts
  - apps/server/src/auth/provisioning.ts
verified_against: 3c443e13c3bbd97340ff5d8d09a0e65cd8244bf0
---

# Operator Provisioning

The first account on a fresh install is created by `apps/server/src/cli/create-operator.ts`,
the documented, no-default-credential path — there is no seeded operator account and no
default password anywhere in this codebase. As a `src/` file it compiles into
`dist/cli/create-operator.js` (TASK-0036), which the runtime image already ships (see
[[container-image]]), so the same entry point runs two ways: `pnpm auth:create-operator` on a
host with the toolchain, or `docker compose exec app node dist/cli/create-operator.js` against
any running stack, including a self-hoster's or vm-104's `dev` (no host build step, no source
in the container).

## How it works

The CLI reads `OPERATOR_USERNAME` (default `"operator"`) and the password from
`OPERATOR_PASSWORD` if set, otherwise an interactive `readline` prompt (`readPassword()`). **It
checks for an existing operator before doing either of those**, via `hasOperator(db)`
(`auth/provisioning.ts`): a `users` query for any row with `role = 'operator'`, `limit(1)`.
This ordering is deliberate and load-bearing, not incidental — prompting first would make an
operator type a secret that is then thrown away, and worse, a **non-interactive** run (CI, a
provisioning script, `docker compose exec -T`) would **hang** waiting on a prompt for input
that will never arrive, instead of failing fast with a clear message. If an operator already
exists, the CLI refuses immediately (exit code 1, no prompt, no changes) rather than creating a
second one or overwriting the first — provisioning is meant to run exactly once per install.

**The CLI imports `auth/provisioning.ts` directly** — `hasOperator(db)` for its own
pre-prompt check, then `createOperator(db, input)` to do the write. Before TASK-0036 it
couldn't: the script ran via `node --experimental-strip-types` (raw TypeScript execution,
outside `tsc`'s build), and `provisioning.ts` imports its schema module the `.js`-suffixed way
every other `src/` file does, which raw execution can't resolve one level deep (see
[[migrations]] for the same constraint on `scripts/migrate.ts`, which still runs this way).
Moving the CLI into `src/cli/` put it on the normal `tsc`-built, `.js`-import path, so it now
shares one query (`hasOperator`) with `createOperator`'s own internal check instead of two
copies of the same logic — `createOperator` calls `hasOperator` too, and treats a `{created:
false}` result (an existing operator, or a race) as the refusal case the CLI already prints for.
Both paths resolve `DATABASE_URL`/`TEST_DATABASE_URL` on the **host** the same way
[[migrations]] describes; inside the container, `TEST_DATABASE_URL` is blank so `DATABASE_URL`
applies with no env var needed (see [[configuration]]).

Once no operator is found, the CLI hashes the password (`hashPassword`, see
[[password-hashing]]) via `createOperator`, which inserts a `users` row with `role:
"operator"`, `displayName: username` (no separate display name is collected).

## Connections

Depends on [[password-hashing]] and [[database-access]] (`createDb`, same host/container URL
precedence as [[migrations]]). Creates the first row in [[database-schema]]'s `users` table
that [[session-auth]] can then sign in. Ships in [[container-image]]'s `dist/cli/`. Run for
real on vm-104 per [[hosted-dev]]'s runbook section.

## Operational notes

Env vars: `OPERATOR_USERNAME` (default `"operator"`), `OPERATOR_PASSWORD` (if unset, prompts
interactively). A run with no existing operator and an empty password (neither env var set
nor typed) throws rather than creating an account with a blank password. `hasOperator(db)` is
also asserted directly in `auth.integration.test.ts` (T028) alongside `createOperator`.
