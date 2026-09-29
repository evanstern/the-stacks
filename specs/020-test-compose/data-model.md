# Data model — 020 test compose stack

No database tables. This amends `specs/010-worktree-stacks/data-model.md`.

## StackIdentity (amended)

| Field | Source | Example |
|---|---|---|
| `env`, `project`, `appPort`, `dbPort` | unchanged (010) | `task-0033`, `stacks-task-0033`, `3033`, `15033` |
| `testProject` | `${project}-test` | `stacks-task-0033-test` |
| `testDbPort` | research R3: `25000+n`, or `25000+k` | `25033` |

`mainIdentity()` is unchanged: no `testProject`, no `testDbPort`.

## RunningStack

Unchanged. A test stack appears as its own entry (its own `com.docker.compose.project`),
with the same `org.the-stacks.env` and `org.the-stacks.worktree` as its app stack.

## Env file merge (amended)

Derived keys: `APP_PORT`, `DB_PORT`, `TEST_DB_PORT`, `STACKS_ENV`, `TEST_DATABASE_URL`.
`TEST_DATABASE_URL` = `postgres://stacks:stacks@localhost:<TEST_DB_PORT>/stacks`.
